import {scoreSubmission, ASSESSMENT_VERSIONS, SubmissionValidationError} from '../shared/score-assessment'
import {Backend} from './backend'
import {allowedRawResponses} from '../shared/submission-metadata'
import {phoneSecurity, sha256, stableJson} from './security'

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {super(message)}
}
function invalid(message = '请求内容无效'): never {throw new HttpError(400,'invalid_request',message)}
async function readJson(req: Request): Promise<any> {
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415,'unsupported_media_type','请求格式无效')
  const reader = req.body?.getReader()
  if (!reader) invalid()
  let size = 0; const chunks: Uint8Array[] = []
  for (;;) {
    const {done,value} = await reader.read()
    if (done) break
    size += value.length
    if (size > 1024*1024) {await reader.cancel(); throw new HttpError(413,'payload_too_large','提交内容过大')}
    chunks.push(value)
  }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) {bytes.set(chunk,offset); offset += chunk.length}
  try {return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))} catch {invalid('请提交有效的 JSON 内容')}
}
const iso = (value: string) => new Date(value).toISOString()
function reportResponse(row: any) {return {report:row.report,reportGeneratedAt:iso(row.report_generated_at),reportRevision:row.report_revision}}
function pageValue(value: unknown, fallback: number, max: number): number {
  if (value === undefined || value === null) return fallback
  if (!/^[1-9]\d*$/.test(String(value))) invalid('查询参数无效')
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number > max) invalid('查询参数无效')
  return number
}
export function createHandler(backend: Backend) {
  const {config} = backend
  const security = phoneSecurity(config.phoneEncryptionKey,config.phoneLookupSecret)
  return async (req: Request): Promise<Response> => {
    const headers = new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Request-Id':crypto.randomUUID()})
    const json = (body: unknown, status=200) => new Response(status === 204 ? null : JSON.stringify(body),{status,headers})
    try {
      const origin = req.headers.get('origin')
      if (origin && origin !== config.origin) throw new HttpError(403,'forbidden_origin','请求来源无效')
      if (origin === config.origin) headers.set('Access-Control-Allow-Origin',origin)
      headers.set('Access-Control-Allow-Headers','Content-Type, Authorization, apikey, x-client-info')
      headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS')
      headers.set('Access-Control-Expose-Headers','Retry-After, X-Request-Id')
      if (req.method === 'OPTIONS') return json(null,204)
      const url = new URL(req.url)
      const path = url.pathname.replace(/^\/functions\/v1\/assessment-api(?=\/|$)/,'').replace(/^\/assessment-api(?=\/|$)/,'')
      const projectId = await backend.projectId()
      if (req.method === 'GET' && path === '/health') return json({status:'ok'})
      const sec = await security
      if (req.method === 'POST' && path === '/admin/login') {
        const body = await readJson(req)
        if (!body || typeof body.username !== 'string' || typeof body.password !== 'string' || body.username.length > 100 || body.password.length > 256) invalid()
        const username = body.username.trim().toLowerCase()
        if (!/^[a-z0-9_-]{3,100}$/.test(username) || !body.password) throw new HttpError(401,'invalid_credentials','账号或密码错误')
        // Username-only login. The email is a private Auth identifier, never user input;
        // no email delivery, OTP, or email verification participates in this flow.
        // Reserve the attempt atomically before password verification. Shared across isolates.
        const key = await sec.hash(`login:${username}`)
        const retry = await backend.rpc('assessment_rate_limit',{p_project_key:config.projectKey,p_key:key,p_max:5,p_seconds:900})
        if (retry > 0) {headers.set('Retry-After',String(retry));throw new HttpError(429,'rate_limited','登录尝试过多，请稍后再试')}
        const accounts = await backend.rows(`app_project_admins?select=auth_email&project_id=eq.${projectId}&username=eq.${encodeURIComponent(username)}`)
        if (accounts.length !== 1) throw new HttpError(401,'invalid_credentials','账号或密码错误')
        const auth = await backend.call('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:accounts[0].auth_email,password:body.password})})
        if (!auth.ok) throw new HttpError(auth.status === 429 ? 429 : 401,'invalid_credentials','账号或密码错误')
        const session = await auth.json()
        if (!session.access_token || !await backend.admin(session.access_token,projectId)) throw new HttpError(403,'forbidden','该账号没有本项目管理权限')
        await backend.rows(`admin_login_attempts?project_id=eq.${projectId}&client_key_hash=eq.${key}`,{method:'DELETE'})
        return json({accessToken:session.access_token,expiresAt:session.expires_at ?? Math.floor(Date.now()/1000)+session.expires_in})
      }
      if (path.startsWith('/admin/')) {
        const authorization = req.headers.get('authorization') || ''
        const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
        if (!await backend.admin(token,projectId)) throw new HttpError(401,'unauthorized','请先登录')
        if (req.method === 'POST' && path === '/admin/logout') {
          const result = await backend.call('/auth/v1/logout?scope=local',{method:'POST'},token)
          if (!result.ok && result.status !== 401) throw new Error('Logout failed')
          return json(null,204)
        }
        if ((req.method === 'GET' && path === '/admin/assessments') || (req.method === 'POST' && path === '/admin/assessments/search')) {
          const search = req.method === 'POST'
          let body: any = {}
          if (search) {if (url.search) invalid();body = await readJson(req)}
          else for (const key of url.searchParams.keys()) if (!['name','page','pageSize'].includes(key) || url.searchParams.getAll(key).length !== 1) invalid('查询参数无效')
          const page = pageValue(search ? body.page : url.searchParams.get('page'),1,1000000)
          const pageSize = pageValue(search ? body.pageSize : url.searchParams.get('pageSize'),20,100)
          const params = new URLSearchParams({select:'id,student_name,phone_masked,grade,completed_at,status,report_revision',project_id:`eq.${projectId}`,order:'completed_at.desc,id.desc',limit:String(pageSize),offset:String((page-1)*pageSize)})
          if (search) {
            if (typeof body.phone !== 'string') invalid('手机号格式不正确')
            let phone: string
            try {phone=sec.normalize(body.phone)} catch {invalid('手机号格式不正确')}
            params.set('phone_lookup_hash',`eq.${await sec.hash(phone)}`)
          } else {
            const name = url.searchParams.get('name')?.trim()
            if (name && name.length > 20) invalid('查询参数无效')
            if (name) params.set('student_name',`ilike.*${name.replace(/[\\%_*]/g,'\\$&')}*`)
          }
          const response = await backend.call(`/rest/v1/assessments?${params}`,{headers:{Prefer:'count=exact'}})
          if (!response.ok) throw new Error('List failed')
          const rows = await response.json()
          return json({items:rows.map((r:any)=>({id:r.id,studentName:r.student_name,phoneMasked:r.phone_masked,grade:r.grade,completedAt:iso(r.completed_at),status:r.status,reportRevision:r.report_revision})),total:Number(response.headers.get('content-range')?.split('/')[1] || 0),page,pageSize})
        }
        const match = path.match(/^\/admin\/assessments\/([0-9a-f-]{36})(\/regenerate)?$/i)
        if (match && ((req.method === 'GET' && !match[2]) || (req.method === 'POST' && match[2]))) {
          if (url.search) invalid()
          const row = await backend.detail(match[1],projectId)
          if (!row) throw new HttpError(404,'assessment_not_found','测评记录不存在')
          const phone = await sec.decrypt(row.phone_encrypted)
          if (match[2]) {
            const body = await readJson(req)
            if (!body || Array.isArray(body) || Object.keys(body).length) invalid()
            const scored = scoreSubmission({name:row.student_name,phone,grade:row.grade,foreignLanguage:row.foreign_language,selectedSubjects:row.selected_subjects,responses:row.responses,bankVersion:ASSESSMENT_VERSIONS.bank,scoringVersion:ASSESSMENT_VERSIONS.scoring,mappingVersion:ASSESSMENT_VERSIONS.mapping})
            const replaced = await backend.rpc('replace_assessment_report_snapshot',{p_id:row.id,p_project_key:config.projectKey,p_report:scored.report,p_report_generated_at:new Date().toISOString()})
            if (!replaced?.[0]) throw new Error('Report replacement failed')
            return json(reportResponse({...replaced[0],report:scored.report}))
          }
          return json({id:row.id,student:{name:row.student_name,phone,phoneMasked:row.phone_masked,grade:row.grade,foreignLanguage:row.foreign_language,selectedSubjects:row.selected_subjects},completedAt:iso(row.completed_at),status:row.status,versions:{bank:row.bank_version,scoring:row.scoring_version,mapping:row.mapping_version},...reportResponse(row),createdAt:iso(row.created_at),updatedAt:iso(row.updated_at)})
        }
      }
      if (req.method === 'POST' && path === '/assessments') {
        const payload = await readJson(req)
        const scored = scoreSubmission(payload)
        if (typeof payload.submissionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.submissionId)) invalid('提交标识无效')
        const phoneHash = await sec.hash(scored.intake.phone)
        const retry = await backend.rpc('assessment_rate_limit',{p_project_key:config.projectKey,p_key:await sec.hash(`submit:${phoneHash}`),p_max:20,p_seconds:3600})
        if (retry > 0) {headers.set('Retry-After',String(retry));throw new HttpError(429,'rate_limited','提交次数较多，请稍后再试')}
        // Store only fields used to rescore, never client-provided report or scoring data.
        const responses = allowedRawResponses(payload)
        const hash = await sha256(stableJson({intake:{...scored.intake,phone:phoneHash},responses,versions:{...ASSESSMENT_VERSIONS,bank:payload.bankVersion}}))
        const time = new Date().toISOString()
        const result = await backend.rpc('create_or_find_assessment',{p_id:crypto.randomUUID(),p_project_key:config.projectKey,p_submission_id:payload.submissionId,p_submission_payload_hash:hash,p_student_name:scored.intake.name,p_phone_encrypted:await sec.encrypt(scored.intake.phone),p_phone_lookup_hash:phoneHash,p_phone_masked:scored.intake.phone.slice(0,3)+'****'+scored.intake.phone.slice(-4),p_grade:scored.intake.grade,p_foreign_language:scored.intake.foreignLanguage,p_selected_subjects:scored.intake.selectedSubjects,p_responses:responses,p_report:scored.report,p_bank_version:payload.bankVersion,p_scoring_version:ASSESSMENT_VERSIONS.scoring,p_mapping_version:ASSESSMENT_VERSIONS.mapping,p_report_generated_at:time,p_completed_at:time,p_status:'ready'})
        if (!result?.[0]) throw new Error('Submission failed')
        if (!result[0].matches_payload) throw new HttpError(409,'submission_conflict','这份作答编号已被使用，请重新开始测评')
        const stored = await backend.detail(result[0].id,projectId)
        if (!stored || stored.status !== 'ready') throw new HttpError(409,'submission_not_ready','提交正在处理，请稍后重试')
        return json({assessmentId:stored.id,...reportResponse(stored)},result[0].created ? 201 : 200)
      }
      throw new HttpError(404,'not_found','请求的接口不存在')
    } catch (error) {
      if (error instanceof SubmissionValidationError) return json({error:{code:'invalid_submission',message:error.message}},400)
      if (error instanceof HttpError) return json({error:{code:error.code,message:error.message}},error.status)
      console.error('Assessment API failed',{requestId:headers.get('X-Request-Id'),errorName:error instanceof Error ? error.name : 'Error'})
      return json({error:{code:'internal_error',message:'服务暂时不可用，请稍后重试'}},500)
    }
  }
}

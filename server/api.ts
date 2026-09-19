import { createHash, randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

import type { ServerConfig } from './config'
import type { AssessmentDatabase, AssessmentDetail, AssessmentListItem } from './database'
import type { SecurityService } from './security'
import {
  ASSESSMENT_VERSIONS,
  scoreSubmission,
  SubmissionValidationError,
  type AssessmentSubmissionPayload,
} from './score-assessment'

const MAX_JSON_BYTES = 1024 * 1024
const ADMIN_COOKIE_NAME = 'meta_ability_admin'
const ADMIN_SESSION_MAX_AGE = 8 * 60 * 60
const ADMIN_LIST_QUERY_KEYS = new Set(['page', 'pageSize', 'name'])
const ADMIN_PHONE_SEARCH_KEYS = new Set(['phone', 'page', 'pageSize'])
const MAX_LOGIN_RATE_LIMIT_CLIENTS = 10_000

interface ApiLogger {
  error(message: string, details?: unknown): void
}

export interface ApiDependencies {
  database: AssessmentDatabase
  security: SecurityService
  config: Pick<
    ServerConfig,
    | 'appOrigin'
    | 'adminUsername'
    | 'secureCookies'
    | 'adminLoginRateLimitMaxAttempts'
    | 'adminLoginRateLimitWindowMs'
  >
  now?: () => Date
  requestId?: () => string
  logger?: ApiLogger
}

class RequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message)
    this.name = 'RequestError'
  }
}

function configureResponse(
  request: IncomingMessage,
  response: ServerResponse,
  appOrigin: string,
  requestId: string,
): void {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Request-Id', requestId)

  if (request.headers.origin === appOrigin) {
    response.setHeader('Access-Control-Allow-Origin', appOrigin)
    response.setHeader('Access-Control-Allow-Credentials', 'true')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.setHeader('Vary', 'Origin')
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const serialized = JSON.stringify(body)
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Content-Length', Buffer.byteLength(serialized))
  response.end(serialized)
}

function readJson(request: IncomingMessage): Promise<unknown> {
  const declaredLength = request.headers['content-length']
  if (declaredLength !== undefined) {
    const length = Number(declaredLength)
    if (Number.isFinite(length) && length > MAX_JSON_BYTES) {
      request.resume()
      return Promise.reject(new RequestError('payload_too_large', '提交内容过大'))
    }
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let byteLength = 0
    let tooLarge = false

    request.on('data', (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      byteLength += bytes.length
      if (byteLength > MAX_JSON_BYTES) {
        tooLarge = true
        chunks.length = 0
        return
      }
      if (!tooLarge) chunks.push(bytes)
    })
    request.on('end', () => {
      if (tooLarge) {
        reject(new RequestError('payload_too_large', '提交内容过大'))
        return
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown)
      } catch {
        reject(new RequestError('invalid_json', '请提交有效的 JSON 内容'))
      }
    })
    request.on('aborted', () => reject(new RequestError('invalid_json', '请提交有效的 JSON 内容')))
    request.on('error', reject)
  })
}

function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

function adminCookie(token: string, secure: boolean, maxAge = ADMIN_SESSION_MAX_AGE): string {
  return [
    `${ADMIN_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null

  const matches = header
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`))
    .map((part) => part.slice(name.length + 1))

  return matches.length === 1 && matches[0] ? matches[0] : null
}

interface LoginRateLimitBucket {
  failures: number
  expiresAt: number
}

function createLoginRateLimiter(maxAttempts: number, windowMs: number) {
  const buckets = new Map<string, LoginRateLimitBucket>()

  function activeBucket(key: string, nowMs: number): LoginRateLimitBucket | undefined {
    const bucket = buckets.get(key)
    if (bucket && bucket.expiresAt <= nowMs) {
      buckets.delete(key)
      return undefined
    }
    return bucket
  }

  function makeRoom(nowMs: number): void {
    if (buckets.size < MAX_LOGIN_RATE_LIMIT_CLIENTS) return

    for (const [key, bucket] of buckets) {
      if (bucket.expiresAt <= nowMs) buckets.delete(key)
    }
    while (buckets.size >= MAX_LOGIN_RATE_LIMIT_CLIENTS) {
      const oldestKey = buckets.keys().next().value as string | undefined
      if (oldestKey === undefined) break
      buckets.delete(oldestKey)
    }
  }

  return {
    retryAfterSeconds(key: string, nowMs: number): number {
      const bucket = activeBucket(key, nowMs)
      if (!bucket || bucket.failures < maxAttempts) return 0
      return Math.max(1, Math.ceil((bucket.expiresAt - nowMs) / 1_000))
    },

    recordFailure(key: string, nowMs: number): void {
      const bucket = activeBucket(key, nowMs)
      if (bucket) {
        bucket.failures += 1
        return
      }

      makeRoom(nowMs)
      buckets.set(key, { failures: 1, expiresAt: nowMs + windowMs })
    },

    clear(key: string): void {
      buckets.delete(key)
    },
  }
}

function loginClientKey(request: IncomingMessage): string {
  return request.socket.remoteAddress?.replace(/^::ffff:/, '') || '<unknown-client>'
}

function hasAdministratorSession(
  request: IncomingMessage,
  security: SecurityService,
  username: string,
  now: Date,
): boolean {
  const token = cookieValue(request.headers.cookie, ADMIN_COOKIE_NAME)
  if (!token) return false
  return security.verifySession(token, now)?.username === username
}

function sendUnauthorized(response: ServerResponse): void {
  sendJson(response, 401, {
    error: { code: 'unauthorized', message: '请先登录' },
  })
}

function sendAssessmentNotFound(response: ServerResponse): void {
  sendJson(response, 404, {
    error: { code: 'assessment_not_found', message: '测评记录不存在' },
  })
}

function invalidQuery(): never {
  throw new RequestError('invalid_query', '查询参数无效')
}

function optionalUniqueQueryValue(parameters: URLSearchParams, key: string): string | undefined {
  const values = parameters.getAll(key)
  if (values.length > 1) invalidQuery()
  return values[0]
}

function positiveQueryInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  if (!/^[1-9]\d*$/.test(value)) invalidQuery()

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) invalidQuery()
  return parsed
}

function adminListQuery(url: URL) {
  for (const key of url.searchParams.keys()) {
    if (!ADMIN_LIST_QUERY_KEYS.has(key)) invalidQuery()
  }

  const page = positiveQueryInteger(optionalUniqueQueryValue(url.searchParams, 'page'), 1)
  const pageSize = positiveQueryInteger(
    optionalUniqueQueryValue(url.searchParams, 'pageSize'),
    20,
  )
  if (pageSize > 100 || (page - 1) * pageSize > Number.MAX_SAFE_INTEGER) invalidQuery()

  const rawName = optionalUniqueQueryValue(url.searchParams, 'name')
  const name = rawName?.trim()
  if (name && name.length > 20) invalidQuery()

  return {
    page,
    pageSize,
    ...(name ? { name } : {}),
  }
}

function positiveJsonInteger(value: unknown, fallback: number): number {
  if (value === undefined) return fallback
  if (!Number.isSafeInteger(value) || (value as number) < 1) invalidQuery()
  return value as number
}

function adminPhoneSearchQuery(value: unknown, security: SecurityService) {
  if (!isRecord(value)) invalidQuery()
  if (Object.keys(value).some((key) => !ADMIN_PHONE_SEARCH_KEYS.has(key))) invalidQuery()
  if (typeof value.phone !== 'string') invalidQuery()

  const page = positiveJsonInteger(value.page, 1)
  const pageSize = positiveJsonInteger(value.pageSize, 20)
  if (pageSize > 100 || (page - 1) * pageSize > Number.MAX_SAFE_INTEGER) invalidQuery()

  try {
    return {
      page,
      pageSize,
      phoneLookupHash: security.phoneLookupHash(value.phone),
    }
  } catch {
    invalidQuery()
  }
}

function safeAssessmentListItem(item: AssessmentListItem): AssessmentListItem {
  return {
    id: item.id,
    studentName: item.studentName,
    phoneMasked: item.phoneMasked,
    grade: item.grade,
    completedAt: item.completedAt,
    status: item.status,
    reportRevision: item.reportRevision,
  }
}

function sendAssessmentList(
  response: ServerResponse,
  result: ReturnType<AssessmentDatabase['findAssessments']>,
): void {
  sendJson(response, 200, {
    items: result.items.map(safeAssessmentListItem),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  })
}

function assessmentDetailResponse(detail: AssessmentDetail, phone: string) {
  return {
    id: detail.id,
    student: {
      name: detail.studentName,
      phone,
      phoneMasked: detail.phoneMasked,
      grade: detail.grade,
      foreignLanguage: detail.foreignLanguage,
      selectedSubjects: detail.selectedSubjects,
    },
    completedAt: detail.completedAt,
    status: detail.status,
    versions: detail.versions,
    report: detail.report,
    reportGeneratedAt: detail.reportGeneratedAt,
    reportRevision: detail.reportRevision,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  }
}

function requireEmptyObject(value: unknown): void {
  if (!isRecord(value) || Object.keys(value).length > 0) {
    throw new RequestError('invalid_request', '请求内容无效')
  }
}

function requireAdminJsonRequest(request: IncomingMessage, appOrigin: string): void {
  const mediaType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase()
  if (mediaType !== 'application/json') {
    throw new RequestError(
      'unsupported_media_type',
      'Content-Type 必须为 application/json',
      415,
    )
  }

  const origin = request.headers.origin
  if (origin !== undefined && origin !== appOrigin) {
    throw new RequestError('forbidden_origin', '请求来源无效', 403)
  }

  const hasBrowserFetchMetadata =
    request.headers['sec-fetch-site'] !== undefined ||
    request.headers['sec-fetch-mode'] !== undefined ||
    request.headers['sec-fetch-dest'] !== undefined
  if (origin === undefined && hasBrowserFetchMetadata) {
    throw new RequestError('forbidden_origin', '请求来源无效', 403)
  }
}

function parseRequestTarget(value: string | undefined): URL {
  try {
    return new URL(value ?? '/', 'http://localhost')
  } catch {
    throw new RequestError('invalid_target', '请求地址无效')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function invalidMetadata(): never {
  throw new SubmissionValidationError('作答元数据无效')
}

function finiteNonNegativeNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) invalidMetadata()
  return value
}

function nonNegativeInteger(value: unknown): number {
  const number = finiteNonNegativeNumber(value)
  if (!Number.isInteger(number)) invalidMetadata()
  return number
}

function positiveInteger(value: unknown): number {
  const number = nonNegativeInteger(value)
  if (number < 1) invalidMetadata()
  return number
}

function positiveIntegerOrNull(value: unknown): number | null {
  return value === null ? null : positiveInteger(value)
}

function stringOrNull(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string') invalidMetadata()
  return value
}

function validatedSelectionEvents(value: unknown): unknown[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) invalidMetadata()

  return value.map((event) => {
    if (!isRecord(event) || typeof event.optionId !== 'string') invalidMetadata()
    return {
      itemIndex: nonNegativeInteger(event.itemIndex),
      optionId: event.optionId,
      elapsedSinceTaskStartMs: finiteNonNegativeNumber(event.elapsedSinceTaskStartMs),
    }
  })
}

const OPTION_AUDIT_MODES = new Set([
  'shuffle',
  'diagram-labels',
  'diagram-shuffle',
  'spatial-fixed',
])

function validatedOptionAudit(value: unknown): unknown[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) invalidMetadata()

  return value.map((audit) => {
    if (
      !isRecord(audit) ||
      typeof audit.mode !== 'string' ||
      !OPTION_AUDIT_MODES.has(audit.mode) ||
      !Array.isArray(audit.options)
    ) {
      invalidMetadata()
    }

    const options = audit.options.map((option) => {
      if (
        !isRecord(option) ||
        typeof option.originalId !== 'string' ||
        typeof option.displayId !== 'string' ||
        (option.spatialPosition !== undefined && typeof option.spatialPosition !== 'string')
      ) {
        invalidMetadata()
      }
      return {
        originalId: option.originalId,
        originalPosition: positiveInteger(option.originalPosition),
        displayPosition: positiveInteger(option.displayPosition),
        displayId: option.displayId,
        ...(option.spatialPosition !== undefined
          ? { spatialPosition: option.spatialPosition }
          : {}),
      }
    })

    return {
      itemIndex: nonNegativeInteger(audit.itemIndex),
      mode: audit.mode,
      options,
      selectedOriginalId: stringOrNull(audit.selectedOriginalId),
      selectedOriginalPosition: positiveIntegerOrNull(audit.selectedOriginalPosition),
      selectedDisplayPosition: positiveIntegerOrNull(audit.selectedDisplayPosition),
      selectedDisplayId: stringOrNull(audit.selectedDisplayId),
    }
  })
}

function elapsedNumberOrNull(value: unknown): number | null {
  return value === null ? null : finiteNonNegativeNumber(value)
}

function validatedMemoryInterval(value: unknown): unknown | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value) || typeof value.presentationId !== 'string') invalidMetadata()

  return {
    presentationId: value.presentationId,
    submittedAt: finiteNonNegativeNumber(value.submittedAt),
    elapsedToTaskMs: elapsedNumberOrNull(value.elapsedToTaskMs),
    elapsedToSubmitMs: elapsedNumberOrNull(value.elapsedToSubmitMs),
  }
}

function allowedRawResponses(payload: unknown): unknown[] {
  return (payload as AssessmentSubmissionPayload).responses.map((item) => {
    const selectionEvents = validatedSelectionEvents(item.response.selectionEvents)
    const optionAudit = validatedOptionAudit(item.optionAudit)
    const memoryInterval = validatedMemoryInterval(item.memoryInterval)
    if (item.submittedAt !== undefined && typeof item.submittedAt !== 'string') invalidMetadata()

    return {
      position: item.position,
      response: {
        kind: item.response.kind,
        answers: { ...item.response.answers },
        ...(selectionEvents !== undefined ? { selectionEvents } : {}),
      },
      ...(item.durationMs !== undefined ? { durationMs: item.durationMs } : {}),
      ...(item.submittedAt !== undefined ? { submittedAt: item.submittedAt } : {}),
      ...(optionAudit !== undefined ? { optionAudit } : {}),
      ...(memoryInterval !== undefined ? { memoryInterval } : {}),
    }
  })
}

function validSubmissionId(payload: unknown): string {
  const submissionId = isRecord(payload) ? payload.submissionId : undefined
  if (
    typeof submissionId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId)
  ) {
    throw new SubmissionValidationError('提交标识无效')
  }
  return submissionId
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function assessmentPayloadHash(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex')
}

export function createApiServer(dependencies: ApiDependencies): Server {
  const now = dependencies.now ?? (() => new Date())
  const createRequestId = dependencies.requestId ?? randomUUID
  const logger = dependencies.logger ?? console
  const loginRateLimiter = createLoginRateLimiter(
    dependencies.config.adminLoginRateLimitMaxAttempts,
    dependencies.config.adminLoginRateLimitWindowMs,
  )

  const handleRequest = async (request: IncomingMessage, response: ServerResponse) => {
    const requestId = createRequestId()
    configureResponse(request, response, dependencies.config.appOrigin, requestId)
    let requestPath = '<invalid-target>'

    try {
      const url = parseRequestTarget(request.url)
      requestPath = url.pathname

      if (request.method === 'OPTIONS') {
        response.statusCode = 204
        response.end()
        return
      }

      if (request.method === 'GET' && url.pathname === '/health') {
        dependencies.database.findAssessments({ page: 1, pageSize: 1 })
        sendJson(response, 200, { status: 'ok' })
        return
      }

      if (request.method === 'POST' && url.pathname === '/api/admin/login') {
        requireAdminJsonRequest(request, dependencies.config.appOrigin)
        const credentials = await readJson(request)
        const username = isRecord(credentials) && typeof credentials.username === 'string'
          ? credentials.username
          : ''
        const password = isRecord(credentials) && typeof credentials.password === 'string'
          ? credentials.password
          : ''
        const loginNow = now()
        const clientKey = loginClientKey(request)
        const retryAfter = loginRateLimiter.retryAfterSeconds(clientKey, loginNow.getTime())
        if (retryAfter > 0) {
          response.setHeader('Retry-After', retryAfter)
          sendJson(response, 429, {
            error: { code: 'rate_limited', message: '登录尝试过多，请稍后再试' },
          })
          return
        }

        if (!dependencies.security.verifyAdminCredentials(username, password)) {
          loginRateLimiter.recordFailure(clientKey, loginNow.getTime())
          sendJson(response, 401, {
            error: { code: 'invalid_credentials', message: '用户名或密码错误' },
          })
          return
        }

        loginRateLimiter.clear(clientKey)

        response.setHeader(
          'Set-Cookie',
          adminCookie(
            dependencies.security.createSession(dependencies.config.adminUsername, loginNow),
            dependencies.config.secureCookies,
          ),
        )
        response.statusCode = 204
        response.end()
        return
      }

      if (url.pathname === '/api/admin' || url.pathname.startsWith('/api/admin/')) {
        if (
          !hasAdministratorSession(
            request,
            dependencies.security,
            dependencies.config.adminUsername,
            now(),
          )
        ) {
          sendUnauthorized(response)
          return
        }

        if (request.method === 'POST' && url.pathname === '/api/admin/logout') {
          requireAdminJsonRequest(request, dependencies.config.appOrigin)
          requireEmptyObject(await readJson(request))
          response.setHeader(
            'Set-Cookie',
            adminCookie('', dependencies.config.secureCookies, 0),
          )
          response.statusCode = 204
          response.end()
          return
        }

        if (request.method === 'GET' && url.pathname === '/api/admin/assessments') {
          const query = adminListQuery(url)
          sendAssessmentList(response, dependencies.database.findAssessments(query))
          return
        }

        if (
          request.method === 'POST' &&
          url.pathname === '/api/admin/assessments/search'
        ) {
          requireAdminJsonRequest(request, dependencies.config.appOrigin)
          if (url.search) invalidQuery()
          const query = adminPhoneSearchQuery(await readJson(request), dependencies.security)
          sendAssessmentList(response, dependencies.database.findAssessments(query))
          return
        }

        const regenerateMatch = url.pathname.match(
          /^\/api\/admin\/assessments\/([^/]+)\/regenerate$/,
        )
        if (request.method === 'POST' && regenerateMatch) {
          requireAdminJsonRequest(request, dependencies.config.appOrigin)
          if (url.search) invalidQuery()
          requireEmptyObject(await readJson(request))
          const detail = dependencies.database.findAssessmentById(regenerateMatch[1])
          if (!detail) {
            sendAssessmentNotFound(response)
            return
          }

          const scored = scoreSubmission({
            name: detail.studentName,
            phone: dependencies.security.decryptPhone(detail.phoneEncrypted),
            grade: detail.grade,
            foreignLanguage: detail.foreignLanguage,
            selectedSubjects: detail.selectedSubjects,
            bankVersion: ASSESSMENT_VERSIONS.bank,
            scoringVersion: ASSESSMENT_VERSIONS.scoring,
            mappingVersion: ASSESSMENT_VERSIONS.mapping,
            responses: detail.responses,
          })
          const reportGeneratedAt = now().toISOString()
          const replaced = dependencies.database.replaceReportSnapshotAtomically(detail.id, {
            report: scored.report,
            generatedAt: reportGeneratedAt,
          })
          if (!replaced) {
            sendAssessmentNotFound(response)
            return
          }

          sendJson(response, 200, {
            report: scored.report,
            reportGeneratedAt: replaced.reportGeneratedAt,
            reportRevision: replaced.reportRevision,
          })
          return
        }

        const detailMatch = url.pathname.match(/^\/api\/admin\/assessments\/([^/]+)$/)
        if (request.method === 'GET' && detailMatch) {
          if (url.search) invalidQuery()
          const detail = dependencies.database.findAssessmentById(detailMatch[1])
          if (!detail) {
            sendAssessmentNotFound(response)
            return
          }

          const phone = dependencies.security.decryptPhone(detail.phoneEncrypted)
          sendJson(response, 200, assessmentDetailResponse(detail, phone))
          return
        }
      }

      if (request.method === 'POST' && url.pathname === '/api/assessments') {
        const payload = await readJson(request)
        const result = scoreSubmission(payload)
        const submissionId = validSubmissionId(payload)
        const responses = allowedRawResponses(payload)
        const phoneLookupHash = dependencies.security.phoneLookupHash(result.intake.phone)
        const payloadHash = assessmentPayloadHash({
          intake: { ...result.intake, phone: phoneLookupHash },
          responses,
          versions: { ...ASSESSMENT_VERSIONS, bank: (payload as { bankVersion: string }).bankVersion },
        })
        const reportGeneratedAt = now().toISOString()
        const storedSubmission = dependencies.database.createOrFindAssessment({
          submissionId,
          payloadHash,
          studentName: result.intake.name,
          phoneEncrypted: dependencies.security.encryptPhone(result.intake.phone),
          phoneLookupHash,
          phoneMasked: maskPhone(result.intake.phone),
          grade: result.intake.grade,
          foreignLanguage: result.intake.foreignLanguage,
          selectedSubjects: result.intake.selectedSubjects,
          responses,
          report: result.report,
          versions: { ...ASSESSMENT_VERSIONS, bank: (payload as { bankVersion: string }).bankVersion },
          completedAt: reportGeneratedAt,
          reportGeneratedAt,
          status: 'ready',
        })

        if (!storedSubmission.matchesPayload) {
          throw new RequestError('submission_conflict', '这份作答编号已被使用，请重新开始测评', 409)
        }
        const stored = dependencies.database.findAssessmentById(storedSubmission.id)
        if (!stored || stored.status !== 'ready') {
          throw new RequestError('submission_not_ready', '提交正在处理，请稍后重试', 409)
        }

        sendJson(response, storedSubmission.created ? 201 : 200, {
          assessmentId: stored.id,
          report: stored.report,
          reportGeneratedAt: stored.reportGeneratedAt,
          reportRevision: stored.reportRevision,
        })
        return
      }

      sendJson(response, 404, {
        error: { code: 'not_found', message: '请求的接口不存在' },
      })
    } catch (error) {
      if (error instanceof RequestError) {
        sendJson(response, error.status, {
          error: { code: error.code, message: error.message },
        })
        return
      }
      if (error instanceof SubmissionValidationError) {
        sendJson(response, 400, {
          error: { code: 'invalid_submission', message: error.message },
        })
        return
      }

      logger.error('Assessment API request failed', {
        requestId,
        method: request.method,
        path: requestPath,
        errorName: error instanceof Error ? error.name : typeof error,
      })
      sendJson(response, 500, {
        error: {
          code: 'internal_error',
          message: '服务暂时不可用，请稍后重试',
          id: requestId,
        },
      })
    }
  }

  return createServer((request, response) => {
    void handleRequest(request, response).catch(() => {
      try {
        if (!response.headersSent) {
          sendJson(response, 500, {
            error: {
              code: 'internal_error',
              message: '服务暂时不可用，请稍后重试',
            },
          })
        } else {
          response.destroy()
        }
      } catch {
        response.destroy()
      }
    })
  })
}

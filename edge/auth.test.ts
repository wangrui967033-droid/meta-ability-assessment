// @vitest-environment node
import {describe, it, expect, vi} from 'vitest'
import {Backend} from './backend'
import {createHandler} from './handler'

const config = {url:'https://example.supabase.co',key:'server-only-key',projectKey:'meta-ability-assessment',origin:'https://school.example',phoneEncryptionKey:'a'.repeat(32),phoneLookupSecret:'b'.repeat(32)}
const projectId = 'project-a'
function setup({retry=0,member=true,validPassword=true,known=true}={}) {
  const fetcher = vi.fn(async (input: string | URL | Request, init?:RequestInit) => {
    const url = new URL(String(input))
    const response = (value:unknown,status=200)=>new Response(JSON.stringify(value),{status})
    if (url.pathname.endsWith('/app_projects')) return response([{id:projectId}])
    if (url.pathname.endsWith('/assessment_rate_limit')) return response(retry)
    if (url.pathname.endsWith('/app_project_admins')) {
      expect(url.searchParams.get('project_id')).toBe(`eq.${projectId}`)
      return response(url.searchParams.get('select') === 'auth_email' ? (known ? [{auth_email:'internal-id@example.invalid'}] : []) : (member ? [{user_id:'user-1'}] : []))
    }
    if (url.pathname.endsWith('/token')) {
      expect(JSON.parse(String(init?.body))).toEqual({email:'internal-id@example.invalid',password:'test-only-password'})
      return validPassword ? response({access_token:'valid-session',expires_in:3600}) : response({},400)
    }
    if (url.pathname.endsWith('/user')) return response({id:'user-1'},new Headers(init?.headers).get('authorization') === 'Bearer valid-session' ? 200 : 401)
    if (url.pathname.endsWith('/admin_login_attempts') && init?.method === 'DELETE') return new Response(null,{status:204})
    throw new Error('Unexpected request '+url.pathname)
  })
  return {fetcher,handler:createHandler(new Backend(config,fetcher as typeof fetch))}
}
const login = (username='feifan',password='test-only-password') => new Request('https://example.supabase.co/functions/v1/assessment-api/admin/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:config.origin},body:JSON.stringify({username,password})})
describe('Supabase username authentication',()=>{
  it('accepts a username and password without requiring an email or sending mail',async()=>{
    const {handler,fetcher}=setup()
    const result=await handler(login())
    expect(result.status).toBe(200)
    const body=await result.json()
    expect(body.accessToken).toBe('valid-session')
    expect(body.expiresAt).toBeGreaterThan(Date.now()/1000)
    expect(JSON.stringify(body)).not.toMatch(/email|password|server-only-key/)
    expect(fetcher.mock.calls.some(([url])=>String(url).includes('/otp'))).toBe(false)
  })
  it.each([{known:false},{validPassword:false}])('uses a generic failure for unknown account or incorrect password: %j',async options=>{
    const result=await setup(options).handler(login())
    expect(result.status).toBe(401)
    expect((await result.json()).error.message).toBe('账号或密码错误')
  })
  it('does not accept an email address as username',async()=>{
    const {handler,fetcher}=setup()
    expect((await handler(login('a@example.com'))).status).toBe(401)
    expect(fetcher.mock.calls.some(([url])=>String(url).includes('/token'))).toBe(false)
  })
  it('limits login attempts before password verification',async()=>{
    const {handler,fetcher}=setup({retry:400})
    const result=await handler(login())
    expect(result.status).toBe(429)
    expect(result.headers.get('Retry-After')).toBe('400')
    expect(fetcher.mock.calls.some(([url])=>String(url).includes('/token'))).toBe(false)
  })
  it('rejects authenticated accounts not authorized for this project',async()=>{
    expect((await setup({member:false}).handler(login())).status).toBe(403)
  })
  it.each(['','Bearer forged','Bearer server-only-key'])('rejects unauthorized admin reads: %s',async authorization=>{
    const result=await setup().handler(new Request('https://example.supabase.co/functions/v1/assessment-api/admin/assessments',{headers:{authorization}}))
    expect(result.status).toBe(401)
  })
  it('rejects unrelated browser origins',async()=>{
    const req=login();req.headers.set('Origin','https://other.example')
    const {handler,fetcher}=setup()
    expect((await handler(req)).status).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()
  })
})

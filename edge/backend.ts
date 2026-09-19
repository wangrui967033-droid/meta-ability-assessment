export interface EdgeConfig {
  url: string; key: string; projectKey: string; origin: string;
  phoneEncryptionKey: string; phoneLookupSecret: string;
}
export class Backend {
  constructor(readonly config: EdgeConfig, readonly fetcher: typeof fetch = fetch) {}
  async call(path: string, init: RequestInit = {}, token = this.config.key): Promise<Response> {
    const headers = new Headers(init.headers)
    headers.set('apikey', this.config.key)
    headers.set('Authorization', `Bearer ${token}`)
    if (init.body) headers.set('Content-Type', 'application/json')
    return this.fetcher(`${this.config.url}${path}`, {...init,headers,signal:AbortSignal.timeout(15000)})
  }
  async rows(path: string, init: RequestInit = {}): Promise<any> {
    const response = await this.call(`/rest/v1/${path}`,init)
    if (!response.ok) throw new Error('Database request failed')
    return response.status === 204 ? null : response.json()
  }
  async rpc(name: string, input: Record<string, unknown>): Promise<any> {
    return this.rows(`rpc/${name}`, {method:'POST',body:JSON.stringify(input)})
  }
  async projectId(): Promise<string> {
    const rows = await this.rows(`app_projects?select=id&project_key=eq.${encodeURIComponent(this.config.projectKey)}`)
    if (rows.length !== 1) throw new Error('Project not configured')
    return rows[0].id
  }
  async admin(token: string, projectId: string): Promise<boolean> {
    if (!token || token === this.config.key || token.length > 8192) return false
    const result = await this.call('/auth/v1/user',{},token)
    if (!result.ok) return false
    const user = await result.json()
    if (!user.id) return false
    const members = await this.rows(`app_project_admins?select=user_id&project_id=eq.${projectId}&user_id=eq.${encodeURIComponent(user.id)}`)
    return members.length === 1
  }
  async detail(id: string, projectId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined
    return (await this.rows(`assessments?select=*&project_id=eq.${projectId}&id=eq.${id}`))[0]
  }
}

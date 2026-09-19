export function apiEndpoint(path: string, root = import.meta.env.VITE_ASSESSMENT_API_URL || ''): string {
  if (!root) return path
  const url = new URL(root)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('API 地址配置无效')
  if (!path.startsWith('/api/')) throw new Error('API 路径无效')
  return root.replace(/\/$/,'') + path.slice(4)
}
export const usesEdgeApi = Boolean(import.meta.env.VITE_ASSESSMENT_API_URL)
// OSS serves files, not application routes. Keep each project's URL inside its directory.
export const adminHref = (path: string) => usesEdgeApi ? `#${path}` : path
export const currentAdminPath = () => usesEdgeApi ? window.location.hash.slice(1) : window.location.pathname
const key = 'meta-ability-assessment:admin-session'
export function adminToken(): string | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null')
    if (value && typeof value.accessToken === 'string' && value.expiresAt*1000 > Date.now()) return value.accessToken
  } catch { /* An invalid or expired session requires login. */ }
  return null
}
export function saveAdminSession(value: {accessToken:string;expiresAt:number} | null) {
  if (value) sessionStorage.setItem(key,JSON.stringify(value))
  else sessionStorage.removeItem(key)
}

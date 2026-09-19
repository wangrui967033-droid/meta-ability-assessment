const enc = new TextEncoder()
function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function unb64(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid ciphertext')
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
}
export async function sha256(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value))), b => b.toString(16).padStart(2, '0')).join('')
}
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson((value as Record<string,unknown>)[k])}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
export async function phoneSecurity(encryptionSecret: string, lookupSecret: string) {
  if (encryptionSecret.length < 32 || lookupSecret.length < 32) throw new Error('Missing phone secrets')
  const key = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', enc.encode(encryptionSecret)), 'AES-GCM', false, ['encrypt', 'decrypt'])
  const hmac = await crypto.subtle.importKey('raw', enc.encode(lookupSecret), {name:'HMAC', hash:'SHA-256'}, false, ['sign'])
  function normalize(phone: string) {
    const value = phone.replace(/\s/g, '')
    if (!/^1[3-9]\d{9}$/.test(value)) throw new Error('手机号格式不正确')
    return value
  }
  return {
    normalize,
    async hash(value: string) { return b64(new Uint8Array(await crypto.subtle.sign('HMAC', hmac, enc.encode(value)))) },
    async encrypt(phone: string) {
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const result = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, enc.encode(normalize(phone))))
      return [iv,result.slice(0,-16),result.slice(-16)].map(b64).join('.')
    },
    async decrypt(value: string) {
      const parts = value.split('.')
      if (parts.length !== 3) throw new Error('Invalid ciphertext')
      const [iv, data, tag] = parts.map(unb64)
      if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid ciphertext')
      return normalize(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv}, key, new Uint8Array([...data,...tag]))))
    },
  }
}

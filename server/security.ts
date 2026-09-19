import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'

import type { ServerConfig } from './config'

const SESSION_DURATION_SECONDS = 8 * 60 * 60
const PHONE_PATTERN = /^1[3-9]\d{9}$/

export interface SessionPayload {
  username: string
  exp: number
}

export interface SecurityService {
  normalizePhone(phone: string): string
  phoneLookupHash(phone: string): string
  encryptPhone(phone: string): string
  decryptPhone(ciphertext: string): string
  verifyPassword(password: string): boolean
  verifyAdminCredentials(username: string, password: string): boolean
  createSession(username: string, now: Date): string
  verifySession(token: string, now: Date): SessionPayload | null
}

export function normalizePhone(phone: string): string {
  const normalized = phone.replace(/\s/g, '')
  if (!PHONE_PATTERN.test(normalized)) {
    throw new Error('手机号格式不正确')
  }
  return normalized
}

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right)
}

function decodeCanonicalBase64Url(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null

  const decoded = Buffer.from(value, 'base64url')
  return decoded.length > 0 && decoded.toString('base64url') === value ? decoded : null
}

function encryptionKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest()
}

function verifyScryptPassword(password: string, record: string): boolean {
  const [algorithm, costValue, blockSizeValue, parallelizationValue, saltValue, keyValue, ...rest] =
    record.split('$')

  if (algorithm !== 'scrypt' || rest.length > 0 || !saltValue || !keyValue) return false

  const cost = Number(costValue)
  const blockSize = Number(blockSizeValue)
  const parallelization = Number(parallelizationValue)
  const salt = Buffer.from(saltValue, 'base64url')
  const expected = Buffer.from(keyValue, 'base64url')

  if (
    !Number.isInteger(cost) ||
    cost < 2 ||
    (cost & (cost - 1)) !== 0 ||
    !Number.isInteger(blockSize) ||
    blockSize < 1 ||
    !Number.isInteger(parallelization) ||
    parallelization < 1 ||
    salt.length === 0 ||
    expected.length === 0
  ) {
    return false
  }

  try {
    const actual = scryptSync(password, salt, expected.length, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem: Math.max(32 * 1024 * 1024, 256 * cost * blockSize),
    })
    return safeEqual(actual, expected)
  } catch {
    return false
  }
}

export function createSecurity(config: ServerConfig): SecurityService {
  const phoneKey = encryptionKey(config.phoneEncryptionKey)

  function sessionSignature(payload: string): Buffer {
    return createHmac('sha256', config.sessionSecret).update(payload).digest()
  }

  return {
    normalizePhone,

    phoneLookupHash(phone) {
      return createHmac('sha256', config.phoneLookupSecret)
        .update(normalizePhone(phone))
        .digest('base64url')
    },

    encryptPhone(phone) {
      const normalized = normalizePhone(phone)
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', phoneKey, iv)
      const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()])
      const authTag = cipher.getAuthTag()

      return [iv, encrypted, authTag].map((part) => part.toString('base64url')).join('.')
    },

    decryptPhone(ciphertext) {
      const parts = ciphertext.split('.')
      if (parts.length !== 3) throw new Error('手机号密文格式不正确')

      const [ivValue, encryptedValue, authTagValue] = parts
      const iv = Buffer.from(ivValue, 'base64url')
      const encrypted = Buffer.from(encryptedValue, 'base64url')
      const authTag = Buffer.from(authTagValue, 'base64url')
      if (iv.length !== 12 || authTag.length !== 16) throw new Error('手机号密文格式不正确')

      const decipher = createDecipheriv('aes-256-gcm', phoneKey, iv)
      decipher.setAuthTag(authTag)
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
      return normalizePhone(decrypted)
    },

    verifyPassword(password) {
      return verifyScryptPassword(password, config.adminPasswordHash)
    },

    verifyAdminCredentials(username, password) {
      const suppliedUsername = createHash('sha256').update(username, 'utf8').digest()
      const configuredUsername = createHash('sha256').update(config.adminUsername, 'utf8').digest()
      const passwordMatches = verifyScryptPassword(password, config.adminPasswordHash)
      return safeEqual(suppliedUsername, configuredUsername) && passwordMatches
    },

    createSession(username, now) {
      const payload = Buffer.from(
        JSON.stringify({
          username,
          exp: Math.floor(now.getTime() / 1000) + SESSION_DURATION_SECONDS,
        } satisfies SessionPayload),
      ).toString('base64url')
      const signature = sessionSignature(payload).toString('base64url')
      return `${payload}.${signature}`
    },

    verifySession(token, now) {
      const parts = token.split('.')
      if (parts.length !== 2) return null

      const [payloadValue, signatureValue] = parts
      const payloadBytes = decodeCanonicalBase64Url(payloadValue)
      const suppliedSignature = decodeCanonicalBase64Url(signatureValue)
      if (!payloadBytes || !suppliedSignature) return null
      if (!safeEqual(sessionSignature(payloadValue), suppliedSignature)) return null

      try {
        const payload = JSON.parse(payloadBytes.toString('utf8')) as Partial<SessionPayload>
        if (
          typeof payload.username !== 'string' ||
          payload.username.length === 0 ||
          !Number.isInteger(payload.exp) ||
          (payload.exp as number) <= Math.floor(now.getTime() / 1000)
        ) {
          return null
        }
        return payload as SessionPayload
      } catch {
        return null
      }
    },
  }
}

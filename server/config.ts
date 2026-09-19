import { isIP } from 'node:net'

export interface ServerConfig {
  port: number
  host: string
  databasePath: string
  appOrigin: string
  adminUsername: string
  adminPasswordHash: string
  sessionSecret: string
  phoneEncryptionKey: string
  phoneLookupSecret: string
  secureCookies: boolean
  adminLoginRateLimitMaxAttempts: number
  adminLoginRateLimitWindowMs: number
}

export type ServerEnvironment = Record<string, string | undefined>

type SensitiveSetting =
  | 'ADMIN_USERNAME'
  | 'ADMIN_PASSWORD_HASH'
  | 'SESSION_SECRET'
  | 'PHONE_ENCRYPTION_KEY'
  | 'PHONE_LOOKUP_SECRET'

function requiredSetting(
  env: ServerEnvironment,
  name: SensitiveSetting,
): string {
  const value = env[name]?.trim()

  if (value) return value

  throw new Error(`缺少必需的服务端配置：${name}`)
}

function parsePort(value: string | undefined): number {
  if (!value?.trim()) return 3001

  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT 必须是 1 到 65535 之间的整数')
  }

  return port
}

function parseHost(value: string | undefined): string {
  const host = value?.trim() || '127.0.0.1'
  const ipVersion = isIP(host)
  if (ipVersion === 4 || ipVersion === 6 || host === 'localhost') return host

  let normalizesToIpAddress = false
  try {
    normalizesToIpAddress = isIP(new URL(`http://${host}`).hostname) > 0
  } catch {
    // Continue to the strict DNS hostname validation below.
  }

  const validHostname = host.length <= 253
    && /[a-z]/i.test(host)
    && host.split('.').every((label) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label),
    )
  if (normalizesToIpAddress || !validHostname) {
    throw new Error('HOST 必须是规范 IP 地址或有效 DNS 主机名')
  }
  return host
}

function parseAppOrigin(value: string | undefined, production: boolean): string {
  const configured = value?.trim()
  if (!configured) {
    if (production) throw new Error('生产环境缺少必需的服务端配置：APP_ORIGIN')
    return 'http://127.0.0.1:5173'
  }

  let origin: URL
  try {
    origin = new URL(configured)
  } catch {
    throw new Error('APP_ORIGIN 必须是精确 Origin，不能包含路径、查询或凭据')
  }
  if (!['http:', 'https:'].includes(origin.protocol)
    || origin.origin !== configured
    || origin.username
    || origin.password) {
    throw new Error('APP_ORIGIN 必须是精确 Origin，不能包含路径、查询或凭据')
  }
  if (production && origin.protocol !== 'https:') {
    throw new Error('生产环境 APP_ORIGIN 必须使用 HTTPS')
  }
  return origin.origin
}

function boundedIntegerSetting(
  value: string | undefined,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!value?.trim()) return fallback

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} 必须是 ${minimum} 到 ${maximum} 之间的整数`)
  }
  return parsed
}

export function loadServerConfig(env: ServerEnvironment): ServerConfig {
  const testMode = env.NODE_ENV === 'test'
  const production = env.NODE_ENV === 'production'

  return {
    port: parsePort(env.PORT),
    host: parseHost(env.HOST),
    databasePath: env.DATABASE_PATH?.trim() || (testMode ? ':memory:' : './data/assessments.sqlite'),
    appOrigin: parseAppOrigin(env.APP_ORIGIN, production),
    adminUsername: requiredSetting(env, 'ADMIN_USERNAME'),
    adminPasswordHash: requiredSetting(env, 'ADMIN_PASSWORD_HASH'),
    sessionSecret: requiredSetting(env, 'SESSION_SECRET'),
    phoneEncryptionKey: requiredSetting(env, 'PHONE_ENCRYPTION_KEY'),
    phoneLookupSecret: requiredSetting(env, 'PHONE_LOOKUP_SECRET'),
    secureCookies: production,
    adminLoginRateLimitMaxAttempts: boundedIntegerSetting(
      env.ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
      'ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS',
      5,
      1,
      100,
    ),
    adminLoginRateLimitWindowMs: boundedIntegerSetting(
      env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS,
      'ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS',
      15 * 60 * 1_000,
      1_000,
      24 * 60 * 60 * 1_000,
    ),
  }
}

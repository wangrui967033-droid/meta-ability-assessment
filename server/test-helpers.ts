import type { ServerConfig, ServerEnvironment } from './config'

export const testServerEnvironment: ServerEnvironment = {
  NODE_ENV: 'test',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD_HASH:
    'scrypt$16384$8$1$dGVzdC1zYWx0LTEyMzQ1Ng$RkvZYbzbs-5V6aTDcwQ5P57XC0lq8K0El2RbBbzxxwG5ZRKpKrZs_IUKJSU5XDQD4b0eo09LRegLHsKC5UFTPA',
  SESSION_SECRET: Buffer.alloc(32, 1).toString('base64url'),
  PHONE_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString('base64url'),
  PHONE_LOOKUP_SECRET: Buffer.alloc(32, 3).toString('base64url'),
}

export const testConfig: ServerConfig = {
  adminUsername: testServerEnvironment.ADMIN_USERNAME!,
  adminPasswordHash: testServerEnvironment.ADMIN_PASSWORD_HASH!,
  sessionSecret: testServerEnvironment.SESSION_SECRET!,
  phoneEncryptionKey: testServerEnvironment.PHONE_ENCRYPTION_KEY!,
  phoneLookupSecret: testServerEnvironment.PHONE_LOOKUP_SECRET!,
  port: 3001,
  host: '127.0.0.1',
  databasePath: ':memory:',
  appOrigin: 'http://127.0.0.1:5173',
  secureCookies: false,
  adminLoginRateLimitMaxAttempts: 5,
  adminLoginRateLimitWindowMs: 15 * 60 * 1_000,
}

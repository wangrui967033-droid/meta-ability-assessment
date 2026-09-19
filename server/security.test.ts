import { describe, expect, it } from 'vitest'

import { loadServerConfig } from './config'
import { createSecurity, normalizePhone } from './security'
import { testConfig, testServerEnvironment } from './test-helpers'

describe('phone security', () => {
  it('normalizes and validates a mainland mobile number', () => {
    expect(normalizePhone(' 138 0013 8000 ')).toBe('13800138000')
    expect(() => normalizePhone('123')).toThrow('手机号格式不正确')
  })

  it('creates stable lookup hashes but decryptable encrypted values', () => {
    const security = createSecurity(testConfig)

    expect(security.phoneLookupHash('13800138000')).toBe(
      security.phoneLookupHash('138 0013 8000'),
    )
    expect(security.decryptPhone(security.encryptPhone('13800138000'))).toBe('13800138000')
  })
})

describe('administrator security', () => {
  const security = createSecurity(testConfig)

  it('rejects a changed or expired session token', () => {
    const token = security.createSession('admin', new Date('2026-09-10T00:00:00Z'))

    expect(security.verifySession(token, new Date('2026-09-10T01:00:00Z'))?.username).toBe('admin')
    expect(security.verifySession(`${token}x`, new Date('2026-09-10T01:00:00Z'))).toBeNull()
    expect(security.verifySession(`${token}!`, new Date('2026-09-10T01:00:00Z'))).toBeNull()
    expect(security.verifySession(token, new Date('2026-09-11T00:00:01Z'))).toBeNull()
  })

  it('verifies only the password matching the configured scrypt record', () => {
    expect(security.verifyPassword('correct-password')).toBe(true)
    expect(security.verifyPassword('wrong-password')).toBe(false)
  })
})

describe('server configuration', () => {
  it('requires every sensitive setting in production and test runtime modes', () => {
    expect(() =>
      loadServerConfig({ NODE_ENV: 'production', APP_ORIGIN: 'https://assessment.example.com' }),
    ).toThrow('ADMIN_USERNAME')
    expect(() => loadServerConfig({ NODE_ENV: 'test' })).toThrow('ADMIN_USERNAME')
  })

  it('loads explicit production settings without exposing defaults', () => {
    expect(
      loadServerConfig({
        NODE_ENV: 'production',
        PORT: '4100',
        DATABASE_PATH: '/tmp/assessments.sqlite',
        APP_ORIGIN: 'https://assessment.example.com',
        ADMIN_USERNAME: testConfig.adminUsername,
        ADMIN_PASSWORD_HASH: testConfig.adminPasswordHash,
        SESSION_SECRET: testConfig.sessionSecret,
        PHONE_ENCRYPTION_KEY: testConfig.phoneEncryptionKey,
        PHONE_LOOKUP_SECRET: testConfig.phoneLookupSecret,
      }),
    ).toMatchObject({
      port: 4100,
      host: '127.0.0.1',
      databasePath: '/tmp/assessments.sqlite',
      appOrigin: 'https://assessment.example.com',
      secureCookies: true,
      adminUsername: 'admin',
    })
  })

  it('requires an exact HTTPS application origin in production', () => {
    const production = { ...testServerEnvironment, NODE_ENV: 'production' }

    expect(() => loadServerConfig(production)).toThrow('APP_ORIGIN')
    expect(() =>
      loadServerConfig({ ...production, APP_ORIGIN: 'http://assessment.example.com' }),
    ).toThrow('HTTPS')
    expect(() =>
      loadServerConfig({ ...production, APP_ORIGIN: 'https://assessment.example.com/path' }),
    ).toThrow('Origin')
  })

  it('defaults to loopback and validates an explicit bind host', () => {
    expect(loadServerConfig(testServerEnvironment).host).toBe('127.0.0.1')
    expect(loadServerConfig({ ...testServerEnvironment, HOST: '10.0.0.8' }).host).toBe('10.0.0.8')
    expect(loadServerConfig({ ...testServerEnvironment, HOST: '::1' }).host).toBe('::1')
    expect(loadServerConfig({ ...testServerEnvironment, HOST: 'assessment.internal' }).host).toBe(
      'assessment.internal',
    )
    expect(() => loadServerConfig({ ...testServerEnvironment, HOST: 'http://localhost' })).toThrow(
      'HOST',
    )
  })

  it.each(['0', '0x0', '127.1', '2130706433', '0177.0.0.1', '0x7f.0.0.1'])(
    'rejects legacy numeric host %s before it can normalize to a wildcard or another IP',
    (host) => {
      expect(() => loadServerConfig({ ...testServerEnvironment, HOST: host })).toThrow('HOST')
    },
  )
})

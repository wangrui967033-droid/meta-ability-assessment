// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  configuredSecretKeys,
  findConfiguredSecretLeaks,
  findServerDefaultSecretLeaks,
  formatConfiguredSecretAudit,
} from './production-artifact-audit.mjs'

describe('production artifact configured-secret detector', () => {
  it('reports the configuration key without echoing its secret value', () => {
    const configuredSecret = 'deployment-only-secret-value-123456'
    const leaks = findConfiguredSecretLeaks(
      `const accidentallyBundled = ${JSON.stringify(configuredSecret)}`,
      { SESSION_SECRET: configuredSecret },
    )

    expect(leaks).toEqual(['SESSION_SECRET'])
    expect(leaks.join('\n')).not.toContain(configuredSecret)
  })

  it('ignores unset secrets and an artifact with no configured values', () => {
    expect(
      findConfiguredSecretLeaks('const runtimeConfig = process.env.SESSION_SECRET', {
        ADMIN_PASSWORD_HASH: '',
        SESSION_SECRET: 'deployment-only-secret-value-123456',
      }),
    ).toEqual([])
  })

  it('reports the exact configured value count or that value scanning was skipped', () => {
    expect(configuredSecretKeys({ SESSION_SECRET: 'one', PHONE_ENCRYPTION_KEY: 'two' })).toEqual([
      'SESSION_SECRET',
      'PHONE_ENCRYPTION_KEY',
    ])
    expect(formatConfiguredSecretAudit(2)).toContain('2 configured secret values')
    expect(formatConfiguredSecretAudit(0)).toContain('skipped')
  })

  it('audits trimmed runtime-effective values and skips whitespace-only settings', () => {
    const paddedSecret = '  trimmed-deployment-secret-123  '
    const environment = {
      ADMIN_PASSWORD_HASH: '   ',
      SESSION_SECRET: paddedSecret,
    }

    expect(configuredSecretKeys(environment)).toEqual(['SESSION_SECRET'])
    expect(
      findConfiguredSecretLeaks('const leaked = "trimmed-deployment-secret-123"', environment),
    ).toEqual(['SESSION_SECRET'])
    expect(
      findConfiguredSecretLeaks(`const raw = ${JSON.stringify(paddedSecret)}`, environment),
    ).toEqual(['SESSION_SECRET'])
  })

  it('rejects fallback strings and secret-like default assignments in the server bundle', () => {
    expect(findServerDefaultSecretLeaks('const value = "test-session-secret"')).toContain(
      'known test/fallback secret literal',
    )
    expect(
      findServerDefaultSecretLeaks('const defaults = { SESSION_SECRET: "bundled-default-value" }'),
    ).toContain('literal default for SESSION_SECRET')
  })

  it('allows server environment names, schema fields, and authoritative answer code', () => {
    expect(findServerDefaultSecretLeaks(`
      const sessionSecret = requiredSetting(env, "SESSION_SECRET")
      const phoneColumn = "phone_encrypted"
      const correctAnswer = item.correctAnswer
    `)).toEqual([])
  })
})

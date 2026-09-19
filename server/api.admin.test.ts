import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { orderedV16Tasks } from '../src/data/meta-bank-v1.6'
import { createApiServer, type ApiDependencies } from './api'
import { loadServerConfig } from './config'
import { openDatabase, type AssessmentDatabase, type AssessmentVersions } from './database'
import { ASSESSMENT_VERSIONS, scoreSubmission, type AssessmentSubmissionPayload } from './score-assessment'
import { createSecurity, type SecurityService } from './security'
import { testConfig, testServerEnvironment } from './test-helpers'

const TEST_NOW = new Date('2026-09-10T08:30:00.000Z')

function validPayload(overrides: Partial<AssessmentSubmissionPayload> = {}): AssessmentSubmissionPayload {
  return {
    submissionId: randomUUID(),
    name: '王同学',
    phone: '138 0013 8000',
    grade: '高三',
    foreignLanguage: '英语',
    selectedSubjects: ['物理'],
    bankVersion: ASSESSMENT_VERSIONS.bank,
    scoringVersion: ASSESSMENT_VERSIONS.scoring,
    mappingVersion: ASSESSMENT_VERSIONS.mapping,
    responses: orderedV16Tasks.map((task) => ({
      position: task.position,
      response: {
        kind: 'multi-choice',
        answers: Object.fromEntries(
          task.items.map((item, index) => [String(index), item.correctAnswer]),
        ),
      },
      durationMs: task.expectedSeconds * 1_000,
      submittedAt: '2026-09-10T08:00:00.000Z',
    })),
    ...overrides,
  }
}

interface TestContext {
  db: AssessmentDatabase
  security: SecurityService
  server: ReturnType<typeof createApiServer>
  baseUrl: string
}

const contexts: TestContext[] = []

async function start(overrides: Partial<ApiDependencies> = {}): Promise<TestContext> {
  const db = openDatabase(':memory:')
  const security = createSecurity(testConfig)
  const server = createApiServer({
    database: db,
    security,
    config: testConfig,
    now: () => TEST_NOW,
    requestId: () => 'admin-request-id',
    ...overrides,
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  const context = { db, security, server, baseUrl: `http://127.0.0.1:${port}` }
  contexts.push(context)
  return context
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    contexts.splice(0).map(
      ({ server, db }) =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => {
            db.close()
            if (error) reject(error)
            else resolve()
          }),
        ),
    ),
  )
})

interface TestResponse {
  status: number
  headers: Headers
  body: unknown
}

async function request(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
  cookie?: string,
  extraHeaders: Record<string, string> = {},
): Promise<TestResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...extraHeaders,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    body: text ? (JSON.parse(text) as unknown) : undefined,
  }
}

function cookieFrom(response: TestResponse): string {
  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('登录响应缺少 Cookie')
  return setCookie.split(';', 1)[0]
}

async function login(baseUrl: string): Promise<TestResponse> {
  return request(
    baseUrl,
    'POST',
    '/api/admin/login',
    { username: 'admin', password: 'correct-password' },
    undefined,
    { origin: testConfig.appOrigin },
  )
}

function createStoredAssessment(
  db: AssessmentDatabase,
  security: SecurityService,
  payload = validPayload(),
  report: unknown = { conclusion: '原始快照' },
  versions: AssessmentVersions = ASSESSMENT_VERSIONS,
): string {
  const normalizedPhone = security.normalizePhone(payload.phone)
  return db.createAssessment({
    submissionId: payload.submissionId,
    payloadHash: 'a'.repeat(64),
    studentName: payload.name.trim(),
    phoneEncrypted: security.encryptPhone(normalizedPhone),
    phoneLookupHash: security.phoneLookupHash(normalizedPhone),
    phoneMasked: `${normalizedPhone.slice(0, 3)}****${normalizedPhone.slice(-4)}`,
    grade: payload.grade,
    foreignLanguage: payload.foreignLanguage,
    selectedSubjects: [...payload.selectedSubjects],
    responses: structuredClone(payload.responses),
    report,
    versions,
    completedAt: '2026-09-10T08:00:00.000Z',
    reportGeneratedAt: '2026-09-10T08:05:00.000Z',
    status: 'ready',
  })
}

describe('administrator authentication', () => {
  it('denies every protected route without a valid signed administrator session', async () => {
    const { baseUrl, security } = await start()
    const foreignSession = security.createSession('other-admin', TEST_NOW)

    for (const [method, path, body] of [
      ['GET', '/api/admin/assessments', undefined],
      ['GET', '/api/admin/assessments/missing', undefined],
      ['POST', '/api/admin/assessments/missing/regenerate', {}],
      ['POST', '/api/admin/logout', undefined],
    ] as const) {
      const denied = await request(baseUrl, method, path, body)
      expect(denied.status).toBe(401)
      expect(denied.body).toEqual({
        error: { code: 'unauthorized', message: '请先登录' },
      })
    }

    expect(
      (
        await request(
          baseUrl,
          'GET',
          '/api/admin/assessments',
          undefined,
          `meta_ability_admin=${foreignSession}x`,
        )
      ).status,
    ).toBe(401)
    expect(
      (await request(baseUrl, 'GET', '/api/admin/assessments', undefined, `meta_ability_admin=${foreignSession}`))
        .status,
    ).toBe(401)
  })

  it('returns the same generic failure for an unknown username or wrong password', async () => {
    const { baseUrl } = await start()
    const allowedOrigin = { origin: testConfig.appOrigin }
    const unknownUser = await request(
      baseUrl,
      'POST',
      '/api/admin/login',
      { username: 'unknown', password: 'correct-password' },
      undefined,
      allowedOrigin,
    )
    const wrongPassword = await request(
      baseUrl,
      'POST',
      '/api/admin/login',
      { username: 'admin', password: 'wrong-password' },
      undefined,
      allowedOrigin,
    )
    const missingCredentials = await request(
      baseUrl,
      'POST',
      '/api/admin/login',
      {},
      undefined,
      allowedOrigin,
    )

    expect(unknownUser.status).toBe(401)
    expect(wrongPassword.status).toBe(401)
    expect(missingCredentials.status).toBe(401)
    expect(unknownUser.body).toEqual(wrongPassword.body)
    expect(wrongPassword.body).toEqual(missingCredentials.body)
    expect(unknownUser.body).toEqual({
      error: { code: 'invalid_credentials', message: '用户名或密码错误' },
    })
    expect(unknownUser.headers.get('set-cookie')).toBeNull()
    expect(wrongPassword.headers.get('set-cookie')).toBeNull()
  })

  it('issues a signed HttpOnly SameSite=Lax cookie and conditionally marks it Secure', async () => {
    const insecure = await start()
    const insecureLogin = await login(insecure.baseUrl)

    expect(insecureLogin.status).toBe(204)
    expect(insecureLogin.body).toBeUndefined()
    expect(insecureLogin.headers.get('set-cookie')).toMatch(
      /^meta_ability_admin=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=28800$/,
    )

    const secure = await start({ config: { ...testConfig, secureCookies: true } })
    const secureLogin = await login(secure.baseUrl)
    expect(secureLogin.headers.get('set-cookie')).toContain('; Secure')
  })

  it('clears the administrator cookie on authenticated logout', async () => {
    const { baseUrl } = await start()
    const authenticated = await login(baseUrl)
    const loggedOut = await request(
      baseUrl,
      'POST',
      '/api/admin/logout',
      {},
      cookieFrom(authenticated),
      { origin: testConfig.appOrigin },
    )

    expect(loggedOut.status).toBe(204)
    expect(loggedOut.headers.get('set-cookie')).toBe(
      'meta_ability_admin=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    )
    expect(
      (await request(baseUrl, 'GET', '/api/admin/assessments', undefined, 'meta_ability_admin=')).status,
    ).toBe(401)
  })
})

describe('administrator assessment listing and search', () => {
  it('lists only allowlisted summary fields without decrypting or exposing stored payloads', async () => {
    const { baseUrl, db, security } = await start()
    const id = createStoredAssessment(db, security)
    const decrypt = vi.spyOn(security, 'decryptPhone')
    const encrypt = vi.spyOn(security, 'encryptPhone')
    const authenticated = await login(baseUrl)

    const listed = await request(
      baseUrl,
      'GET',
      '/api/admin/assessments?name=%20%E7%8E%8B%20&page=1&pageSize=20',
      undefined,
      cookieFrom(authenticated),
    )

    expect(listed.status).toBe(200)
    expect(listed.body).toEqual({
      items: [
        {
          id,
          studentName: '王同学',
          phoneMasked: '138****8000',
          grade: '高三',
          completedAt: '2026-09-10T08:00:00.000Z',
          status: 'ready',
          reportRevision: 1,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    })
    expect(JSON.stringify(listed.body)).not.toContain('13800138000')
    expect(JSON.stringify(listed.body)).not.toContain('phoneEncrypted')
    expect(JSON.stringify(listed.body)).not.toContain('responses')
    expect(JSON.stringify(listed.body)).not.toContain('原始快照')
    expect(decrypt).not.toHaveBeenCalled()
    expect(encrypt).not.toHaveBeenCalled()
  })

  it('keeps complete phone values out of URLs and searches by normalized JSON body', async () => {
    const { baseUrl, db, security } = await start()
    const expectedId = createStoredAssessment(db, security)
    createStoredAssessment(
      db,
      security,
      validPayload({ name: '李同学', phone: '13900139000' }),
    )
    const authenticated = await login(baseUrl)
    const cookie = cookieFrom(authenticated)

    const rejectedUrl = await request(
      baseUrl,
      'GET',
      '/api/admin/assessments?phone=138%200013%208000',
      undefined,
      cookie,
    )
    expect(rejectedUrl.status).toBe(400)
    expect(rejectedUrl.body).toEqual({
      error: { code: 'invalid_query', message: '查询参数无效' },
    })

    const normalized = await request(
      baseUrl,
      'POST',
      '/api/admin/assessments/search',
      { phone: '138 0013 8000', page: 1, pageSize: 20 },
      cookie,
      { origin: testConfig.appOrigin },
    )
    expect(normalized.status).toBe(200)
    expect(normalized.body).toMatchObject({ total: 1, items: [{ id: expectedId }] })

    const invalid = await request(
      baseUrl,
      'POST',
      '/api/admin/assessments/search',
      { phone: '1380013' },
      cookie,
      { origin: testConfig.appOrigin },
    )
    expect(invalid.status).toBe(400)
    expect(invalid.body).toEqual({
      error: { code: 'invalid_query', message: '查询参数无效' },
    })
  })

  it.each([
    [{ phone: '13800138000', page: 0 }],
    [{ phone: '13800138000', page: '1' }],
    [{ phone: '13800138000', pageSize: 101 }],
    [{ phone: '13800138000', unknown: true }],
    [{}],
  ])('strictly rejects malformed phone-search bodies: %j', async (body) => {
    const { baseUrl } = await start()
    const authenticated = await login(baseUrl)

    const response = await request(
      baseUrl,
      'POST',
      '/api/admin/assessments/search',
      body,
      cookieFrom(authenticated),
      { origin: testConfig.appOrigin },
    )

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      error: { code: 'invalid_query', message: '查询参数无效' },
    })
    expect(JSON.stringify(response.body)).not.toContain('13800138000')
  })

  it.each([
    '?page=0',
    '?page=-1',
    '?page=1.5',
    '?page=01',
    '?page=9007199254740992',
    '?pageSize=0',
    '?pageSize=101',
    '?pageSize=20.0',
    '?page=1&page=2',
    '?unknown=value',
    '?name=%E7%8E%8B&name=%E6%9D%8E',
  ])('rejects malformed, duplicate, or unknown list query parameters: %s', async (query) => {
    const { baseUrl } = await start()
    const authenticated = await login(baseUrl)

    const response = await request(
      baseUrl,
      'GET',
      `/api/admin/assessments${query}`,
      undefined,
      cookieFrom(authenticated),
    )

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      error: { code: 'invalid_query', message: '查询参数无效' },
    })
  })
})

describe('administrator assessment detail and regeneration', () => {
  it('decrypts the phone only after authentication and returns a privacy-safe detail', async () => {
    const { baseUrl, db, security } = await start()
    const id = createStoredAssessment(db, security)
    const decrypt = vi.spyOn(security, 'decryptPhone')

    const denied = await request(baseUrl, 'GET', `/api/admin/assessments/${id}`)
    expect(denied.status).toBe(401)
    expect(decrypt).not.toHaveBeenCalled()

    const authenticated = await login(baseUrl)

    const detail = await request(
      baseUrl,
      'GET',
      `/api/admin/assessments/${id}`,
      undefined,
      cookieFrom(authenticated),
    )

    expect(detail.status).toBe(200)
    expect(detail.body).toEqual({
      id,
      student: {
        name: '王同学',
        phone: '13800138000',
        phoneMasked: '138****8000',
        grade: '高三',
        foreignLanguage: '英语',
        selectedSubjects: ['物理'],
      },
      completedAt: '2026-09-10T08:00:00.000Z',
      status: 'ready',
      versions: ASSESSMENT_VERSIONS,
      report: { conclusion: '原始快照' },
      reportGeneratedAt: '2026-09-10T08:05:00.000Z',
      reportRevision: 1,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })
    expect(detail.body).not.toHaveProperty('phoneEncrypted')
    expect(detail.body).not.toHaveProperty('phoneLookupHash')
    expect(detail.body).not.toHaveProperty('responses')
    expect(decrypt).toHaveBeenCalledTimes(1)
  })

  it('returns 404 for authenticated detail and regeneration requests with unknown IDs', async () => {
    const { baseUrl } = await start()
    const authenticated = await login(baseUrl)
    const cookie = cookieFrom(authenticated)

    const detail = await request(
      baseUrl,
      'GET',
      '/api/admin/assessments/missing',
      undefined,
      cookie,
    )
    const regenerated = await request(
      baseUrl,
      'POST',
      '/api/admin/assessments/missing/regenerate',
      {},
      cookie,
      { origin: testConfig.appOrigin },
    )

    expect(detail.status).toBe(404)
    expect(regenerated.status).toBe(404)
    expect(detail.body).toEqual({
      error: { code: 'assessment_not_found', message: '测评记录不存在' },
    })
    expect(regenerated.body).toEqual(detail.body)
  })

  it('rescores persisted raw responses and atomically replaces only the report snapshot', async () => {
    const { baseUrl, db, security } = await start()
    const payload = validPayload()
    const originalVersions = { bank: 'original-bank', scoring: 'original-scoring', mapping: 'original-mapping' }
    const id = createStoredAssessment(
      db,
      security,
      payload,
      { conclusion: '不可信的旧报告' },
      originalVersions,
    )
    const before = db.findAssessmentById(id)
    const authenticated = await login(baseUrl)

    const regenerated = await request(
      baseUrl,
      'POST',
      `/api/admin/assessments/${id}/regenerate`,
      {},
      cookieFrom(authenticated),
      { origin: testConfig.appOrigin },
    )

    const authoritative = scoreSubmission(payload).report
    expect(regenerated.status).toBe(200)
    expect(regenerated.body).toEqual({
      report: authoritative,
      reportGeneratedAt: TEST_NOW.toISOString(),
      reportRevision: 2,
    })

    const after = db.findAssessmentById(id)
    const persistedAuthoritative = JSON.parse(JSON.stringify(authoritative)) as unknown
    expect(after).toMatchObject({
      reportGeneratedAt: TEST_NOW.toISOString(),
      reportRevision: 2,
      responses: before?.responses,
      versions: originalVersions,
      studentName: before?.studentName,
      phoneEncrypted: before?.phoneEncrypted,
      phoneLookupHash: before?.phoneLookupHash,
      completedAt: before?.completedAt,
      createdAt: before?.createdAt,
    })
    expect(after?.report).toEqual(persistedAuthoritative)
    expect(after?.report).not.toEqual({ conclusion: '不可信的旧报告' })
  })

  it('keeps unexpected authenticated failures generic and never logs phone, body, or cookie values', async () => {
    const db = openDatabase(':memory:')
    const security = createSecurity(testConfig)
    const phone = '13800138000'
    const id = createStoredAssessment(db, security, validPayload({ phone }))
    const messages: unknown[][] = []
    const failingSecurity: SecurityService = {
      ...security,
      decryptPhone() {
        throw new Error(`failed to decrypt ${phone}`)
      },
    }
    const context = await start({
      database: db,
      security: failingSecurity,
      logger: { error: (...values: unknown[]) => messages.push(values) },
    })
    const authenticated = await login(context.baseUrl)
    const cookie = cookieFrom(authenticated)

    const response = await request(
      context.baseUrl,
      'GET',
      `/api/admin/assessments/${id}`,
      undefined,
      cookie,
    )

    expect(response.status).toBe(500)
    expect(response.body).toEqual({
      error: {
        code: 'internal_error',
        message: '服务暂时不可用，请稍后重试',
        id: 'admin-request-id',
      },
    })
    expect(JSON.stringify(messages)).not.toContain(phone)
    expect(JSON.stringify(messages)).not.toContain(cookie)
    expect(JSON.stringify(messages)).not.toContain('原始快照')
    db.close()
  })
})

describe('administrator mutation request boundary', () => {
  it('rejects hostile origins and non-JSON browser requests without changing auth or reports', async () => {
    const { baseUrl, db, security } = await start()
    const id = createStoredAssessment(db, security)

    const hostileLogin = await request(
      baseUrl,
      'POST',
      '/api/admin/login',
      { username: 'admin', password: 'correct-password' },
      undefined,
      { origin: 'https://evil.example.com' },
    )
    expect(hostileLogin.status).toBe(403)
    expect(hostileLogin.headers.get('set-cookie')).toBeNull()

    const authenticated = await login(baseUrl)
    const cookie = cookieFrom(authenticated)
    const hostileLogout = await request(
      baseUrl,
      'POST',
      '/api/admin/logout',
      {},
      cookie,
      { origin: 'https://evil.example.com' },
    )
    expect(hostileLogout.status).toBe(403)
    expect(hostileLogout.headers.get('set-cookie')).toBeNull()

    const textLogout = await request(
      baseUrl,
      'POST',
      '/api/admin/logout',
      {},
      cookie,
      { origin: testConfig.appOrigin, 'content-type': 'text/plain' },
    )
    expect(textLogout.status).toBe(415)
    expect(textLogout.headers.get('set-cookie')).toBeNull()

    const missingOriginBrowserRegenerate = await request(
      baseUrl,
      'POST',
      `/api/admin/assessments/${id}/regenerate`,
      {},
      cookie,
      { 'sec-fetch-site': 'cross-site' },
    )
    expect(missingOriginBrowserRegenerate.status).toBe(403)

    const hostileRegenerate = await request(
      baseUrl,
      'POST',
      `/api/admin/assessments/${id}/regenerate`,
      {},
      cookie,
      { origin: 'https://evil.example.com' },
    )
    expect(hostileRegenerate.status).toBe(403)

    const textRegenerate = await request(
      baseUrl,
      'POST',
      `/api/admin/assessments/${id}/regenerate`,
      {},
      cookie,
      { origin: testConfig.appOrigin, 'content-type': 'text/plain' },
    )
    expect(textRegenerate.status).toBe(415)
    expect(db.findAssessmentById(id)?.reportRevision).toBe(1)

    const stillAuthenticated = await request(
      baseUrl,
      'GET',
      '/api/admin/assessments',
      undefined,
      cookie,
    )
    expect(stillAuthenticated.status).toBe(200)

    const allowedRegenerate = await request(
      baseUrl,
      'POST',
      `/api/admin/assessments/${id}/regenerate`,
      {},
      cookie,
      { origin: testConfig.appOrigin },
    )
    expect(allowedRegenerate.status).toBe(200)
    expect(db.findAssessmentById(id)?.reportRevision).toBe(2)
  })
})

describe('administrator login rate limiting', () => {
  it('loads bounded login limiter settings from server configuration', () => {
    expect(
      loadServerConfig({
        ...testServerEnvironment,
        ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS: '3',
        ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS: '120000',
      }),
    ).toMatchObject({
      adminLoginRateLimitMaxAttempts: 3,
      adminLoginRateLimitWindowMs: 120_000,
    })
    expect(() =>
      loadServerConfig({
        ...testServerEnvironment,
        ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS: '0',
      }),
    ).toThrow('ADMIN_LOGIN_RATE_LIMIT_MAX_ATTEMPTS')
  })

  it('bounds failed password verification per client and resets after the configured window', async () => {
    let currentTime = new Date('2026-09-10T08:30:00.000Z')
    const { baseUrl } = await start({
      config: {
        ...testConfig,
        adminLoginRateLimitMaxAttempts: 2,
        adminLoginRateLimitWindowMs: 60_000,
      },
      now: () => currentTime,
    })
    const allowedOrigin = { origin: testConfig.appOrigin }

    const first = await request(
      baseUrl,
      'POST',
      '/api/admin/login',
      { username: 'unknown', password: 'correct-password' },
      undefined,
      allowedOrigin,
    )
    const second = await request(
      baseUrl,
      'POST',
      '/api/admin/login',
      { username: 'admin', password: 'wrong-password' },
      undefined,
      allowedOrigin,
    )
    const limited = await request(
      baseUrl,
      'POST',
      '/api/admin/login',
      { username: 'admin', password: 'correct-password' },
      undefined,
      allowedOrigin,
    )

    expect(first.status).toBe(401)
    expect(second.status).toBe(401)
    expect(first.body).toEqual(second.body)
    expect(limited.status).toBe(429)
    expect(limited.body).toEqual({
      error: { code: 'rate_limited', message: '登录尝试过多，请稍后再试' },
    })
    expect(limited.headers.get('set-cookie')).toBeNull()

    currentTime = new Date('2026-09-10T08:31:00.001Z')
    const recovered = await login(baseUrl)
    expect(recovered.status).toBe(204)
  })
})

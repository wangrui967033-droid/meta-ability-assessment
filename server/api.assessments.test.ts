import { connect, type AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'

import { afterEach, describe, expect, it } from 'vitest'

import { orderedV16Tasks } from '../src/data/meta-bank-v1.6'
import { ApiAssessmentClient } from '../src/lib/transport'
import { createApiServer, type ApiDependencies } from './api'
import { openDatabase, type AssessmentDatabase } from './database'
import { startAssessmentServer } from './index'
import { createSecurity } from './security'
import { testConfig } from './test-helpers'
import type { AssessmentSubmissionPayload } from './score-assessment'

function validPayload(): AssessmentSubmissionPayload {
  return {
    submissionId: randomUUID(),
    name: '王同学',
    phone: '138 0013 8000',
    grade: '高三',
    foreignLanguage: '英语',
    selectedSubjects: ['物理'],
    bankVersion: '1.6-student-8s-20260907',
    scoringVersion: '1.6-task-mean-1',
    mappingVersion: '1.6-frozen-20260905',
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
  }
}

interface TestContext {
  db: AssessmentDatabase
  server: ReturnType<typeof createApiServer>
  baseUrl: string
}

const contexts: TestContext[] = []

async function start(overrides: Partial<ApiDependencies> = {}): Promise<TestContext> {
  const db = openDatabase(':memory:')
  const server = createApiServer({
    database: db,
    security: createSecurity(testConfig),
    config: testConfig,
    now: () => new Date('2026-09-10T08:30:00.000Z'),
    requestId: () => 'request-test-id',
    ...overrides,
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  const context = { db, server, baseUrl: `http://127.0.0.1:${port}` }
  contexts.push(context)
  return context
}

afterEach(async () => {
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

async function postJson(baseUrl: string, payload: unknown, origin?: string) {
  const response = await fetch(`${baseUrl}/api/assessments`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(payload),
  })
  return { response, body: await response.json() }
}

function rawHttpRequest(port: number, request: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const socket = connect(port, '127.0.0.1', () => socket.end(request))
    socket.setTimeout(1_000, () => {
      socket.destroy()
      reject(new Error('服务端未安全结束非法请求'))
    })
    socket.on('data', (chunk: Buffer) => chunks.push(chunk))
    socket.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    socket.on('error', reject)
  })
}

describe('request target safety', () => {
  it('returns a safe client error for a malformed absolute request target', async () => {
    const { server } = await start()
    const { port } = server.address() as AddressInfo

    const response = await rawHttpRequest(
      port,
      'GET http://[ HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n',
    )

    expect(response).toContain('HTTP/1.1 400 Bad Request')
    expect(response).toContain('"code":"invalid_target"')
  })
})

describe('POST /api/assessments', () => {
  it('supports the shared client submission transport', async () => {
    const { baseUrl } = await start()

    const submitted = await new ApiAssessmentClient(`${baseUrl}/api/assessments`).submitAssessment(
      validPayload(),
    )

    expect(submitted).toMatchObject({
      assessmentId: expect.any(String),
      report: expect.any(Object),
      reportRevision: 1,
    })
  })

  it('persists an authoritative ready report without returning private phone data', async () => {
    const { db, baseUrl } = await start()

    const { response, body } = await postJson(baseUrl, validPayload())

    expect(response.status).toBe(201)
    expect(body).toEqual({
      assessmentId: expect.any(String),
      report: expect.objectContaining({ dimensionSummary: expect.any(Array) }),
      reportGeneratedAt: '2026-09-10T08:30:00.000Z',
      reportRevision: 1,
    })
    expect(body).not.toHaveProperty('phone')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-request-id')).toBe('request-test-id')

    const stored = db.findAssessmentById(body.assessmentId)
    expect(stored).toMatchObject({
      studentName: '王同学',
      phoneMasked: '138****8000',
      grade: '高三',
      status: 'ready',
      reportRevision: 1,
    })
    expect(stored?.responses).toEqual(validPayload().responses)
    expect(stored?.report).toEqual(body.report)
    expect(db.findAssessments({ page: 1, pageSize: 10 }).total).toBe(1)
  })

  it('returns the one stored assessment when a lost response is retried with the same submission ID', async () => {
    const { db, baseUrl } = await start()
    const payload = validPayload()

    await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const retry = await postJson(baseUrl, payload)

    expect(retry.response.status).toBe(200)
    expect(db.findAssessments({ page: 1, pageSize: 10 }).total).toBe(1)
    expect(retry.body).toMatchObject({ assessmentId: expect.any(String), reportRevision: 1 })
  })

  it('rejects reuse of a submission ID for a different payload', async () => {
    const { db, baseUrl } = await start()
    const payload = validPayload()
    const created = await postJson(baseUrl, payload)

    const collision = await postJson(baseUrl, { ...payload, name: '另一位同学' })

    expect(created.response.status).toBe(201)
    expect(collision.response.status).toBe(409)
    expect(collision.body).toEqual({ error: { code: 'submission_conflict', message: '这份作答编号已被使用，请重新开始测评' } })
    expect(db.findAssessments({ page: 1, pageSize: 10 }).total).toBe(1)
  })

  it('deeply reconstructs optional metadata without persisting forged nested fields', async () => {
    const { db, baseUrl } = await start()
    const payload = validPayload()
    payload.report = { conclusion: '伪造报告' }
    payload.responses[0].evidence = { nodeScore: { earned: 999, possible: 1 } }
    payload.responses[0].response.selectionEvents = [
      {
        itemIndex: 0,
        optionId: 'A',
        elapsedSinceTaskStartMs: 150,
        score: 999,
      } as never,
    ]
    payload.responses[0].optionAudit = [
      {
        itemIndex: 0,
        mode: 'shuffle',
        options: [
          {
            originalId: 'A',
            originalPosition: 1,
            displayPosition: 2,
            displayId: 'B',
            report: { conclusion: '伪造' },
          },
        ],
        selectedOriginalId: 'A',
        selectedOriginalPosition: 1,
        selectedDisplayPosition: 2,
        selectedDisplayId: 'B',
        score: 999,
      },
    ] as never
    payload.responses[0].memoryInterval = {
      presentationId: 'visual-board',
      submittedAt: 1_789_056_000_000,
      elapsedToTaskMs: 1_000,
      elapsedToSubmitMs: 2_000,
      report: { conclusion: '伪造' },
    } as never

    const { body } = await postJson(baseUrl, payload)
    const stored = db.findAssessmentById(body.assessmentId)

    expect(stored?.responses[0]).toEqual({
      position: 1,
      response: {
        kind: 'multi-choice',
        answers: payload.responses[0].response.answers,
        selectionEvents: [
          { itemIndex: 0, optionId: 'A', elapsedSinceTaskStartMs: 150 },
        ],
      },
      durationMs: payload.responses[0].durationMs,
      submittedAt: payload.responses[0].submittedAt,
      optionAudit: [
        {
          itemIndex: 0,
          mode: 'shuffle',
          options: [
            {
              originalId: 'A',
              originalPosition: 1,
              displayPosition: 2,
              displayId: 'B',
            },
          ],
          selectedOriginalId: 'A',
          selectedOriginalPosition: 1,
          selectedDisplayPosition: 2,
          selectedDisplayId: 'B',
        },
      ],
      memoryInterval: {
        presentationId: 'visual-board',
        submittedAt: 1_789_056_000_000,
        elapsedToTaskMs: 1_000,
        elapsedToSubmitMs: 2_000,
      },
    })
    expect(stored?.report).not.toMatchObject({ conclusion: '伪造报告' })
  })

  it.each([
    [
      'selection events',
      (payload: AssessmentSubmissionPayload) => {
        payload.responses[0].response.selectionEvents = [
          { itemIndex: 0, optionId: 'A', elapsedSinceTaskStartMs: 'soon' } as never,
        ]
      },
    ],
    [
      'option audit',
      (payload: AssessmentSubmissionPayload) => {
        payload.responses[0].optionAudit = [
          { itemIndex: 0, mode: 'forged', options: [] },
        ] as never
      },
    ],
    [
      'memory interval',
      (payload: AssessmentSubmissionPayload) => {
        payload.responses[0].memoryInterval = {
          presentationId: 'visual-board',
          submittedAt: 1_789_056_000_000,
          elapsedToTaskMs: 'soon',
          elapsedToSubmitMs: 2_000,
        } as never
      },
    ],
    [
      'required option positions',
      (payload: AssessmentSubmissionPayload) => {
        payload.responses[0].optionAudit = [
          {
            itemIndex: 0,
            mode: 'shuffle',
            options: [
              {
                originalId: 'A',
                originalPosition: null,
                displayPosition: 1,
                displayId: 'A',
              },
            ],
            selectedOriginalId: null,
            selectedOriginalPosition: null,
            selectedDisplayPosition: null,
            selectedDisplayId: null,
          },
        ] as never
      },
    ],
  ])('returns 400 for malformed optional %s metadata', async (_label, mutate) => {
    const { db, baseUrl } = await start()
    const payload = validPayload()
    mutate(payload)

    const { response, body } = await postJson(baseUrl, payload)

    expect(response.status).toBe(400)
    expect(body).toMatchObject({ error: { code: 'invalid_submission' } })
    expect(db.findAssessments({ page: 1, pageSize: 10 }).total).toBe(0)
  })

  it('returns stable validation errors and does not persist an invalid phone', async () => {
    const { db, baseUrl } = await start()

    const { response, body } = await postJson(baseUrl, { ...validPayload(), phone: '1' })

    expect(response.status).toBe(400)
    expect(body).toEqual({
      error: { code: 'invalid_submission', message: '手机号格式不正确' },
    })
    expect(db.findAssessments({ page: 1, pageSize: 10 }).total).toBe(0)
  })

  it('returns a safe 400 response for malformed JSON', async () => {
    const { baseUrl } = await start()

    const response = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: { code: 'invalid_json', message: '请提交有效的 JSON 内容' },
    })
  })

  it('rejects request bodies larger than one megabyte', async () => {
    const { baseUrl } = await start()
    const oversized = JSON.stringify({ padding: 'x'.repeat(1024 * 1024) })

    const response = await fetch(`${baseUrl}/api/assessments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: oversized,
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: { code: 'payload_too_large', message: '提交内容过大' },
    })
  })

  it('allows credentials only for the configured application origin', async () => {
    const { baseUrl } = await start()

    const allowed = await fetch(`${baseUrl}/api/assessments`, {
      method: 'OPTIONS',
      headers: {
        origin: testConfig.appOrigin,
        'access-control-request-method': 'POST',
      },
    })
    expect(allowed.status).toBe(204)
    expect(allowed.headers.get('access-control-allow-origin')).toBe(testConfig.appOrigin)
    expect(allowed.headers.get('access-control-allow-credentials')).toBe('true')

    const denied = await fetch(`${baseUrl}/health`, {
      headers: { origin: 'https://untrusted.example' },
    })
    expect(denied.headers.get('access-control-allow-origin')).toBeNull()
    expect(denied.headers.get('access-control-allow-credentials')).toBeNull()
  })

  it('hides unexpected failures behind a generic error ID and never logs the body', async () => {
    const payload = validPayload()
    const messages: unknown[][] = []
    const database: AssessmentDatabase = {
      ...openDatabase(':memory:'),
      createOrFindAssessment() {
        throw new Error(`database failed for ${payload.phone}`)
      },
    }
    const { baseUrl } = await start({
      database,
      logger: { error: (...values: unknown[]) => messages.push(values) },
    })

    const { response, body } = await postJson(baseUrl, payload)

    expect(response.status).toBe(500)
    expect(body).toEqual({
      error: {
        code: 'internal_error',
        message: '服务暂时不可用，请稍后重试',
        id: 'request-test-id',
      },
    })
    expect(JSON.stringify(messages)).not.toContain(payload.phone)
    database.close()
  })
})

describe('GET /health', () => {
  it('returns a no-store service health response without personal data', async () => {
    const { baseUrl } = await start()

    const response = await fetch(`${baseUrl}/health`)

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('is reachable through the production entrypoint lifecycle', async () => {
    const running = await startAssessmentServer({ ...testConfig, port: 0 }, { log() {}, error() {} })
    const { address, port } = running.server.address() as AddressInfo

    expect(address).toBe('127.0.0.1')

    const response = await fetch(`http://127.0.0.1:${port}/health`)

    expect(response.status).toBe(200)
    await running.close()
    expect(running.server.listening).toBe(false)
  })
})

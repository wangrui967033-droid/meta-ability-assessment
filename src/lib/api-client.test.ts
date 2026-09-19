import { describe, expect, it } from 'vitest'
import { createSessionSnapshot } from './session'
import { submitAssessment } from './api-client'
import { buildPrototypeReport } from './assessment'

const report = buildPrototypeReport([], '英语', ['语文', '数学', '英语'])

describe('student assessment API client', () => {
  it('posts the final raw snapshot without putting the phone in the URL', async () => {
    const snapshot = createSessionSnapshot()
    snapshot.intake = { name: '林晓', phone: '138 0013 8000', grade: '高三', foreignLanguage: '英语', selectedSubjects: ['物理'] }
    snapshot.submission = { status: 'submitting', submissionId: '0198f52c-7e11-7000-8000-000000000001' }
    snapshot.responses = [{
      position: 1,
      response: { kind: 'multi-choice', answers: { 0: 'B' } },
      durationMs: 900,
      submittedAt: '2026-09-10T08:00:00.000Z',
    }]
    let requestUrl = ''
    let requestInit: RequestInit | undefined
    const fetcher: typeof fetch = async (input, init) => {
      requestUrl = String(input)
      requestInit = init
      return new Response(JSON.stringify({ assessmentId: 'assessment-1', report, reportGeneratedAt: '2026-09-10T08:30:00.000Z', reportRevision: 1 }), { status: 201, headers: { 'Content-Type': 'application/json' } })
    }

    const result = await submitAssessment(snapshot, fetcher)

    expect(result.assessmentId).toBe('assessment-1')
    expect(requestUrl).toBe('/api/assessments')
    expect(requestUrl).not.toContain(snapshot.intake.phone)
    expect(requestInit).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      name: '林晓',
      submissionId: '0198f52c-7e11-7000-8000-000000000001',
      phone: '138 0013 8000',
      grade: '高三',
      foreignLanguage: '英语',
      selectedSubjects: ['物理'],
      bankVersion: snapshot.bankVersion,
      scoringVersion: snapshot.scoringVersion,
      mappingVersion: snapshot.mappingVersion,
      responses: snapshot.responses,
    })
  })

  it('turns a known non-2xx server response into a Chinese retry-safe error', async () => {
    const fetcher: typeof fetch = async () => new Response(
      JSON.stringify({ error: { code: 'invalid_submission', message: '作答不完整' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )

    const snapshot = createSessionSnapshot()
    snapshot.submission = { status: 'submitting', submissionId: crypto.randomUUID() }
    await expect(submitAssessment(snapshot, fetcher)).rejects.toThrow('提交没有完成，请检查后重试')
  })

  it('uses a retry-safe message when the server response is not readable JSON', async () => {
    const fetcher: typeof fetch = async () => new Response('<html>gateway error</html>', { status: 502 })

    const snapshot = createSessionSnapshot()
    snapshot.submission = { status: 'submitting', submissionId: crypto.randomUUID() }
    await expect(submitAssessment(snapshot, fetcher)).rejects.toThrow('暂时无法提交，请稍后重试')
  })

  it.each([null, {}, { conclusion: '缺失其他字段' }])('rejects malformed successful reports without creating a false-saved state', async (malformedReport) => {
    const snapshot = createSessionSnapshot()
    snapshot.submission = { status: 'submitting', submissionId: crypto.randomUUID() }
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({
      assessmentId: 'assessment-1',
      report: malformedReport,
      reportGeneratedAt: '2026-09-10T08:30:00.000Z',
      reportRevision: 1,
    }), { status: 201, headers: { 'Content-Type': 'application/json' } })

    await expect(submitAssessment(snapshot, fetcher)).rejects.toThrow('暂时无法提交，请稍后重试')
  })

  it.each([
    ['empty conclusion', (value: Record<string, unknown>) => { value.conclusion = '   ' }],
    ['missing advantage clarity', (value: Record<string, unknown>) => { delete value.advantageClarity }],
    ['null mechanism summary item', (value: Record<string, unknown>) => { value.mechanismSummary = [null] }],
    ['null subject item', (value: Record<string, unknown>) => { value.subjects = [null] }],
    ['invalid opportunity tier', (value: Record<string, unknown>) => {
      const opportunities = value.subjectOpportunityPlan as Array<Record<string, unknown>>
      opportunities[0] = { ...opportunities[0], tier: '无效分区' }
    }],
    ['invalid task group', (value: Record<string, unknown>) => {
      const plans = value.subjectTaskPlan as Array<Record<string, unknown>>
      const groups = plans[0].groups as Array<Record<string, unknown>>
      groups[0] = { ...groups[0], label: '无效分组' }
    }],
    ['null nested topic support', (value: Record<string, unknown>) => {
      const plans = value.subjectTaskPlan as Array<Record<string, unknown>>
      const groups = plans[0].groups as Array<Record<string, unknown>>
      const group = groups.find((item) => (item.tasks as unknown[]).length > 0)
      const tasks = group?.tasks as Array<Record<string, unknown>>
      const topics = tasks[0].graphTopics as Array<Record<string, unknown>>
      topics[0] = { ...topics[0], support: null }
    }],
    ['invalid present stability review', (value: Record<string, unknown>) => {
      const opportunities = value.subjectOpportunityPlan as Array<Record<string, unknown>>
      const support = opportunities[0].support as Record<string, unknown>
      support.stabilityReview = 'memory'
    }],
  ])('rejects a 2xx report with %s', async (_label, mutate) => {
    const snapshot = createSessionSnapshot()
    snapshot.submission = { status: 'submitting', submissionId: crypto.randomUUID() }
    const malformedReport = structuredClone(report) as unknown as Record<string, unknown>
    mutate(malformedReport)
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({
      assessmentId: 'assessment-1',
      report: malformedReport,
      reportGeneratedAt: '2026-09-10T08:30:00.000Z',
      reportRevision: 1,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

    await expect(submitAssessment(snapshot, fetcher)).rejects.toThrow('暂时无法提交，请稍后重试')
  })

  it('accepts a legitimate report when optional stabilityReview is omitted', async () => {
    const snapshot = createSessionSnapshot()
    snapshot.submission = { status: 'submitting', submissionId: crypto.randomUUID() }
    const withoutStabilityReview = structuredClone(report)
    const removeFromTask = (task: (typeof withoutStabilityReview.subjects)[number]['tasks'][number]) => {
      task.graphTopics.forEach((topic) => { delete topic.support.stabilityReview })
    }
    withoutStabilityReview.subjects.forEach((subject) => subject.tasks.forEach(removeFromTask))
    withoutStabilityReview.subjectOpportunityPlan.forEach((subject) => { delete subject.support.stabilityReview })
    withoutStabilityReview.subjectTaskPlan.forEach((plan) => plan.groups.forEach((group) => group.tasks.forEach(removeFromTask)))
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({
      assessmentId: 'assessment-1',
      report: withoutStabilityReview,
      reportGeneratedAt: '2026-09-10T08:30:00.000Z',
      reportRevision: 1,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

    await expect(submitAssessment(snapshot, fetcher)).resolves.toMatchObject({ assessmentId: 'assessment-1' })
  })

  it.each([
    { reportGeneratedAt: 'not-a-date', reportRevision: 1 },
    { reportGeneratedAt: '2026-09-10T08:30:00.000Z', reportRevision: 0 },
  ])('rejects malformed successful report metadata %#', async (metadata) => {
    const snapshot = createSessionSnapshot()
    snapshot.submission = { status: 'submitting', submissionId: crypto.randomUUID() }
    const fetcher: typeof fetch = async () => new Response(JSON.stringify({
      assessmentId: 'assessment-1',
      report,
      ...metadata,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

    await expect(submitAssessment(snapshot, fetcher)).rejects.toThrow('暂时无法提交，请稍后重试')
  })
})

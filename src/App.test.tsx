import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { SESSION_STORAGE_KEY, createSessionSnapshot } from './lib/session'
import { buildPrototypeReport, type ReportModel } from './lib/assessment'
import type { SubmittedAssessment } from './lib/api-client'

afterEach(() => window.localStorage.clear())

describe('assessment flow', () => {
  it.each([false, true])('records M05 retention without time-based scoring, interrupted=%s', async (interrupted) => {
    const user = userEvent.setup()
    const snapshot = createSessionSnapshot()
    const endedAt = Date.now() - 90000
    snapshot.intake = {name: '间隔自检', phone: '13800138000', grade: '高三', foreignLanguage: '英语', selectedSubjects: []}
    snapshot.screen = 'tasks'
    snapshot.currentPosition = 25
    snapshot.memoryInterrupted = interrupted
    snapshot.memoryPresentationEndedAt = {'visual-board': endedAt}
    snapshot.seenPresentations = ['visual-board']
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot))
    render(<App />)
    await user.click(screen.getByRole('button', {name: '继续上次测评'}))
    for (const [index, label] of ['左下', '中下', '右下'].entries()) {
      await user.click(within(screen.getAllByRole('radiogroup')[index]).getByRole('radio', {name: label}))
    }
    await user.click(screen.getByRole('button', {name: '确认并继续'}))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)!).responses).toHaveLength(1))
    const saved = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)!).responses[0]
    expect(saved.evidence).toBeUndefined()
    expect(saved.memoryInterval.presentationId).toBe('visual-board')
    expect(saved.memoryInterval.elapsedToSubmitMs).toBe(interrupted ? null : saved.memoryInterval.submittedAt - endedAt)
    expect(saved.memoryInterval.elapsedToTaskMs).toBe(interrupted ? null : snapshot.taskStartedAt - endedAt)
  })

  it('restores the report without a feedback form and preserves previously saved records', async () => {
    const user = userEvent.setup()
    const snapshot = createSessionSnapshot()
    snapshot.intake = {name: '林晓', phone: '13800138000', grade: '高三', foreignLanguage: '英语', selectedSubjects: []}
    snapshot.screen = 'report'
    snapshot.reportGeneratedAt = '2026-09-07T02:00:00.000Z'
    snapshot.submission = { status: 'saved', assessmentId: 'preview', report: buildPrototypeReport([], '英语', ['语文', '数学', '英语']) }
    snapshot.pilotFeedback = {experience: 'rules', taskId: '', taskNote: '历史记录', subject: '语文', action: 'learn', tried: false, observation: '', methodNote: '', savedAt: '2026-09-07T02:01:00.000Z'}
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot))
    render(<App />)
    await user.click(screen.getByRole('button', {name: '继续上次测评'}))
    expect(screen.getByRole('button', {name: '保存报告'})).toBeInTheDocument()
    expect(screen.queryByRole('complementary', {name: '预测试反馈'})).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '保存反馈到本机'})).not.toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY)!).pilotFeedback).toEqual(snapshot.pilotFeedback)
  })

  it('requires phone plus the student fields and starts without choosing an elective', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: '元能力学习画像' })).toBeInTheDocument()
    expect(screen.getByText(/了解自己的元能力表现/)).toBeInTheDocument()
    expect(screen.getByText('语文、数学和外语会自动进入报告，选考科目按需选择。')).toBeInTheDocument()
    expect(screen.queryByText(/0—7门均可/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '开始测评' }))
    expect(screen.getByText('请填写姓名')).toBeInTheDocument()
    expect(screen.getByText('请输入正确的手机号')).toBeInTheDocument()

    await user.type(screen.getByLabelText('姓名'), '林晓')
    await user.type(screen.getByLabelText('手机号'), '138 0013 8000')
    expect(screen.getByLabelText('手机号')).toHaveAttribute('inputmode', 'tel')
    expect(screen.getByText('手机号仅供机构查找报告，不影响评分，也不会保存在本机测评记录中。')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('年级'), '高一')
    await user.selectOptions(screen.getByLabelText('高考外语语种'), '英语')
    await user.click(screen.getByRole('button', { name: '开始测评' }))

    expect(screen.getByRole('heading', { name: '开始前，先了解一下' })).toBeInTheDocument()
    expect(screen.getByText('每道题选一项；本组题目都选完，才能继续。确认后不能返回修改。')).toBeInTheDocument()
    expect(screen.getByText('记忆材料只展示一次，看完会马上提问，或隔几组题再问。')).toBeInTheDocument()
    expect(screen.queryByText(/教材|复习|作答速度直接算成分数/)).not.toBeInTheDocument()
  })

  it('offers to restore a saved V1.6 route', async () => {
    const user = userEvent.setup()
    const snapshot = createSessionSnapshot()
    snapshot.intake = { name: '林晓', phone: '13800138000', grade: '高二', foreignLanguage: '日语', selectedSubjects: ['物理', '化学', '生物'] }
    snapshot.screen = 'tasks'
    snapshot.currentPosition = 18
    snapshot.encodingSeen = true
    snapshot.seenPractices = ['practice-composition']
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot))
    render(<App />)

    expect(screen.getByRole('heading', { name: '继续上次测评？' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '继续上次测评' }))
    expect(screen.getByText('已完成 0%')).toBeInTheDocument()
    expect(screen.queryByText('选择想在报告中查看的选考科目（可多选）')).not.toBeInTheDocument()
  })

  function finalTaskSnapshot() {
    const snapshot = createSessionSnapshot()
    snapshot.intake = { name: '林晓', phone: '', grade: '高三', foreignLanguage: '英语', selectedSubjects: [] }
    snapshot.screen = 'tasks'
    snapshot.currentPosition = 30
    snapshot.startedAt = Date.now() - 60_000
    snapshot.seenPresentations = ['sequence-6']
    snapshot.responses = Array.from({ length: 29 }, (_, index) => ({
      position: index + 1,
      response: { kind: 'multi-choice' as const, answers: { 0: 'A' } },
      durationMs: 500,
      submittedAt: '2026-09-10T08:00:00.000Z',
    }))
    return snapshot
  }

  async function answerFinalTask(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: '继续上次测评' }))
    for (const group of screen.getAllByRole('radiogroup')) {
      await user.click(within(group).getAllByRole('radio')[0])
    }
    await waitFor(() => expect(screen.getByRole('button', { name: '完成测评' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '完成测评' }))
  }

  async function supplyPhoneAndRetry(user: ReturnType<typeof userEvent.setup>) {
    expect(await screen.findByText('尚未提交，可重试')).toBeInTheDocument()
    await user.type(screen.getByLabelText('手机号'), '138 0013 8000')
    await user.click(screen.getByRole('button', { name: '重新提交' }))
  }

  it('renders only the authoritative server report after the final raw response is saved', async () => {
    const user = userEvent.setup()
    const snapshot = finalTaskSnapshot()
    const serverReport = buildPrototypeReport([], '英语', ['语文', '数学', '英语'])
    serverReport.dimensionSummary[0].signal = 73
    const submit = async (): Promise<SubmittedAssessment> => ({
      assessmentId: 'assessment-1',
      report: serverReport,
      reportGeneratedAt: '2026-09-10T08:30:00.000Z',
      reportRevision: 1,
    })
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot))

    render(<App submit={submit} />)
    await answerFinalTask(user)
    await supplyPhoneAndRetry(user)

    expect(await screen.findByText('已保存到机构后台')).toBeInTheDocument()
    expect(screen.getByText('73%')).toBeInTheDocument()
    const saved = JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY)!)
    expect(saved.responses).toHaveLength(30)
    expect(saved.responses[29].evidence).toBeUndefined()
    expect(saved.submission).toMatchObject({ status: 'saved', assessmentId: 'assessment-1', reportRevision: 1 })
    expect(saved.submission.submissionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).not.toContain('138 0013 8000')
  })

  it('retains the exact raw responses when a failed submission is retried', async () => {
    const user = userEvent.setup()
    const snapshot = finalTaskSnapshot()
    const attempts: string[] = []
    const submit = async (submitted: typeof snapshot): Promise<SubmittedAssessment> => {
      attempts.push(JSON.stringify(submitted.responses))
      throw new Error('暂时无法提交，请稍后重试')
    }
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot))

    render(<App submit={submit} />)
    await answerFinalTask(user)
    expect(attempts).toHaveLength(0)
    await supplyPhoneAndRetry(user)

    expect(await screen.findByText('尚未提交，可重试')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保存报告' })).not.toBeInTheDocument()
    const firstSavedResponses = JSON.stringify(JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY)!).responses)
    await user.click(screen.getByRole('button', { name: '重新提交' }))
    await waitFor(() => expect(attempts).toHaveLength(2))
    expect(attempts[0]).toBe(firstSavedResponses)
    expect(attempts[1]).toBe(firstSavedResponses)
    expect(JSON.stringify(JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY)!).responses)).toBe(firstSavedResponses)
  })

  it.each(['idle', 'submitting'] as const)('reloads processing + %s into visible phone recovery without losing responses', async (status) => {
    const user = userEvent.setup()
    const snapshot = finalTaskSnapshot()
    snapshot.screen = 'processing'
    snapshot.currentPosition = 31
    snapshot.submission = { status, submissionId: crypto.randomUUID() }
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot))

    render(<App submit={async () => { throw new Error('should not submit automatically') }} />)
    await user.click(screen.getByRole('button', { name: '继续上次测评' }))

    expect(screen.getByText('尚未提交，可重试')).toBeInTheDocument()
    expect(screen.getByLabelText('手机号')).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY)!).responses).toHaveLength(29)
  })
})

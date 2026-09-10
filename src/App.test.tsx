import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { SESSION_STORAGE_KEY, createSessionSnapshot } from './lib/session'

afterEach(() => window.localStorage.clear())

describe('assessment flow', () => {
  it.each([false, true])('records M05 retention without time-based scoring, interrupted=%s', async (interrupted) => {
    const user = userEvent.setup()
    const snapshot = createSessionSnapshot()
    const endedAt = Date.now() - 90000
    snapshot.intake = {name: '间隔自检', grade: '高三', foreignLanguage: '英语', selectedSubjects: []}
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
    expect(saved.evidence.nodeScore).toEqual({earned: 1, possible: 1})
    expect(saved.memoryInterval.presentationId).toBe('visual-board')
    expect(saved.memoryInterval.elapsedToSubmitMs).toBe(interrupted ? null : saved.memoryInterval.submittedAt - endedAt)
    expect(saved.memoryInterval.elapsedToTaskMs).toBe(interrupted ? null : snapshot.taskStartedAt - endedAt)
  })

  it('restores the report without a feedback form and preserves previously saved records', async () => {
    const user = userEvent.setup()
    const snapshot = createSessionSnapshot()
    snapshot.intake = {name: '林晓', grade: '高三', foreignLanguage: '英语', selectedSubjects: []}
    snapshot.screen = 'report'
    snapshot.reportGeneratedAt = '2026-09-07T02:00:00.000Z'
    snapshot.pilotFeedback = {experience: 'rules', taskId: '', taskNote: '历史记录', subject: '语文', action: 'learn', tried: false, observation: '', methodNote: '', savedAt: '2026-09-07T02:01:00.000Z'}
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot))
    render(<App />)
    await user.click(screen.getByRole('button', {name: '继续上次测评'}))
    expect(screen.getByRole('button', {name: '保存报告'})).toBeInTheDocument()
    expect(screen.queryByRole('complementary', {name: '预测试反馈'})).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: '保存反馈到本机'})).not.toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY)!).pilotFeedback).toEqual(snapshot.pilotFeedback)
  })

  it('requires the three student fields and starts without choosing an elective', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: '元能力学习画像' })).toBeInTheDocument()
    expect(screen.getByText(/了解自己哪些元能力比较突出/)).toBeInTheDocument()
    expect(screen.getByText('语文、数学和外语会自动进入报告，选考科目按需选择。')).toBeInTheDocument()
    expect(screen.queryByText(/0—7门均可/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '开始测评' }))
    expect(screen.getByText('请填写姓名')).toBeInTheDocument()

    await user.type(screen.getByLabelText('姓名'), '林晓')
    await user.selectOptions(screen.getByLabelText('年级'), '高一')
    await user.selectOptions(screen.getByLabelText('高考外语语种'), '英语')
    await user.click(screen.getByRole('button', { name: '开始测评' }))

    expect(screen.getByRole('heading', { name: '开始前，先了解一下' })).toBeInTheDocument()
    expect(screen.getByText('每道题选一项；本组题目都选完，才能继续。确认后不能返回修改。')).toBeInTheDocument()
    expect(screen.getByText('记忆材料只展示一次，看完会马上提问，或隔几组题再问。点阵图片显示8秒，收起后再选哪边的点更多。')).toBeInTheDocument()
    expect(screen.queryByText(/教材|复习|作答速度直接算成分数/)).not.toBeInTheDocument()
  })

  it('offers to restore a saved V1.6 route', async () => {
    const user = userEvent.setup()
    const snapshot = createSessionSnapshot()
    snapshot.intake = { name: '林晓', grade: '高二', foreignLanguage: '日语', selectedSubjects: ['物理', '化学', '生物'] }
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
})

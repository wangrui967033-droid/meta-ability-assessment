import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AssessmentList from './AssessmentList'

const item = {
  id: '0198f52c-7e11-7000-8000-000000000001', studentName: '王同学',
  phoneMasked: '138****8000', grade: '高三', completedAt: '2026-09-10T08:00:00.000Z',
  status: 'ready', reportRevision: 1,
}
const onUnauthorized = vi.fn()
afterEach(() => vi.unstubAllGlobals())

describe('all reports browsing', () => {
  it.each(['王同学', '13800138000'])('clears the %s filter and pagination to browse all reports again', async (query) => {
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push(url)
      const params = new URL(url, 'http://localhost').searchParams
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const filtered = params.has('name') || url.endsWith('/search')
      const page = Number(body.page || params.get('page') || 1)
      return new Response(JSON.stringify({
        items: [{ ...item, studentName: filtered ? '筛选学生' : '全部列表学生' }],
        total: filtered ? 21 : 41, page, pageSize: 20,
      }), { status: 200 })
    }))
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(<AssessmentList onNavigate={onNavigate} onUnauthorized={onUnauthorized} />)

    expect(await screen.findByText('全部列表学生')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '全部报告' })).toBeInTheDocument()
    expect(screen.getByText('共 41 条测评记录 · 按最新提交排序')).toBeInTheDocument()
    expect(requests[0]).toBe('/api/admin/assessments?page=1&pageSize=20')
    await user.type(screen.getByLabelText('按姓名或完整手机号搜索'), query)
    await user.click(screen.getByRole('button', { name: '搜索' }))
    expect(await screen.findByText('筛选学生')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '下一页' }))
    expect(await screen.findByText('第 2 / 2 页')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '查看全部' }))
    expect(await screen.findByText('全部列表学生')).toBeInTheDocument()
    expect(screen.getByLabelText('按姓名或完整手机号搜索')).toHaveValue('')
    expect(screen.getByText('第 1 / 3 页')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled()
    expect(requests.at(-1)).toBe('/api/admin/assessments?page=1&pageSize=20')
    await user.click(screen.getByRole('link', { name: '查看报告' }))
    expect(onNavigate).toHaveBeenCalledWith(`/admin/assessments/${item.id}`)
  })

  it('distinguishes no submissions from an empty search and allows returning to all reports', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({items: [], total: 0, page: 1, pageSize: 20}))))
    const user = userEvent.setup()
    render(<AssessmentList onNavigate={vi.fn()} onUnauthorized={onUnauthorized} />)
    expect(await screen.findByText('暂时还没有测评记录。学生提交后，会自动显示在这里。')).toBeInTheDocument()
    await user.type(screen.getByLabelText('按姓名或完整手机号搜索'), '不存在')
    await user.click(screen.getByRole('button', { name: '搜索' }))
    expect(await screen.findByText('没有找到符合条件的测评记录。')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '查看全部' }))
    await waitFor(() => expect(screen.getByText('暂时还没有测评记录。学生提交后，会自动显示在这里。')).toBeInTheDocument())
  })
})

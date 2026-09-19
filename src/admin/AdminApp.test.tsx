import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPrototypeReport } from '../lib/assessment'
import AdminApp, { adminRouteFor, isAdminPath } from '../AdminApp'
import { login, logout } from './admin-api'

const assessmentId = '0198f52c-7e11-7000-8000-000000000001'
const report = buildPrototypeReport([], '英语', ['语文', '数学', '英语'])
const listBody = {
  items: [{
    id: assessmentId,
    studentName: '王同学',
    phoneMasked: '138****8000',
    grade: '高三',
    completedAt: '2026-09-10T08:00:00.000Z',
    status: 'ready',
    reportRevision: 1,
  }],
  total: 1,
  page: 1,
  pageSize: 20,
}
const detailBody = {
  id: assessmentId,
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
  versions: { bank: 'v1.6', scoring: 'v1', mapping: 'v1' },
  report,
  reportGeneratedAt: '2026-09-10T08:05:00.000Z',
  reportRevision: 1,
  createdAt: '2026-09-10T08:00:00.000Z',
  updatedAt: '2026-09-10T08:05:00.000Z',
}

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function requestPath(input: RequestInfo | URL): string {
  return String(input)
}

describe('administrator application', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/admin/login')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('logs in, lists only safe fields, and performs explicit name and phone searches with the correct privacy boundary', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestPath(input)
      requests.push({ url, init })
      if (url === '/api/admin/login') return new Response(null, { status: 204 })
      if (url.startsWith('/api/admin/assessments')) return json(listBody)
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetcher)
    const user = userEvent.setup()

    const { container } = render(<AdminApp />)
    await user.type(screen.getByLabelText('用户名'), 'admin')
    await user.type(screen.getByLabelText('密码'), 'correct-password')
    await user.click(screen.getByRole('button', { name: '登录' }))

    expect(await screen.findByRole('heading', { name: '全部报告' })).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getByText('138****8000')).toBeInTheDocument()
    expect(within(table).queryByText('13800138000')).not.toBeInTheDocument()
    expect(within(table).getAllByRole('columnheader')).toHaveLength(6)
    expect(container.querySelectorAll('.admin-mobile-label')).toHaveLength(4)

    const search = screen.getByLabelText('按姓名或完整手机号搜索')
    await user.type(search, '王同学')
    await user.click(screen.getByRole('button', { name: '搜索' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3))
    expect(requests[2].url).toBe('/api/admin/assessments?name=%E7%8E%8B%E5%90%8C%E5%AD%A6&page=1&pageSize=20')
    expect(requests[2].init).toMatchObject({ method: 'GET', credentials: 'include' })

    await user.clear(search)
    await user.type(search, '138 0013 8000')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4))
    expect(requests[3].url).toBe('/api/admin/assessments/search')
    expect(requests[3].url).not.toContain('13800138000')
    expect(requests[3].init).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(JSON.parse(String(requests[3].init?.body))).toEqual({
      phone: '138 0013 8000',
      page: 1,
      pageSize: 20,
    })
    expect(search).toHaveValue('')
    expect(requests.every(({ init }) => init?.credentials === 'include')).toBe(true)
  })

  it('shows authenticated detail data, regenerates explicitly, and exposes the dedicated print route', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestPath(input)
      requests.push({ url, init })
      if (url === '/api/admin/login') return new Response(null, { status: 204 })
      if (url === `/api/admin/assessments/${assessmentId}`) return json(detailBody)
      if (url === `/api/admin/assessments/${assessmentId}/regenerate`) {
        return json({ report, reportGeneratedAt: '2026-09-10T09:00:00.000Z', reportRevision: 2 })
      }
      if (url.startsWith('/api/admin/assessments?')) return json(listBody)
      throw new Error(`Unexpected request: ${url}`)
    }))
    const user = userEvent.setup()

    render(<AdminApp />)
    await user.type(screen.getByLabelText('用户名'), 'admin')
    await user.type(screen.getByLabelText('密码'), 'correct-password')
    await user.click(screen.getByRole('button', { name: '登录' }))
    await user.click(await screen.findByRole('link', { name: '查看报告' }))

    expect(await screen.findByText('13800138000')).toBeInTheDocument()
    expect(screen.getByText('报告版本 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '打印报告' })).toHaveAttribute(
      'href',
      `/admin/assessments/${assessmentId}/print`,
    )

    await user.click(screen.getByRole('button', { name: '重新生成报告' }))
    expect(await screen.findByText('报告已重新生成，当前版本为 2。')).toBeInTheDocument()
    expect(screen.getByText('报告版本 2')).toBeInTheDocument()
    const regenerate = requests.find(({ url }) => url.endsWith('/regenerate'))
    expect(regenerate).toEqual({
      url: `/api/admin/assessments/${assessmentId}/regenerate`,
      init: expect.objectContaining({ method: 'POST', credentials: 'include', body: '{}' }),
    })
  })

  it('returns to login without leaking detail when an authenticated request receives 401', async () => {
    window.history.replaceState(null, '', `/admin/assessments/${assessmentId}`)
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: { code: 'unauthorized', message: '请先登录' } }, 401)))

    render(<AdminApp />)

    expect(await screen.findByRole('heading', { name: '管理员登录' })).toBeInTheDocument()
    expect(screen.queryByText('13800138000')).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/admin/login')
  })

  it('renders the reusable report at the print route without administrator navigation or controls', async () => {
    window.history.replaceState(null, '', `/admin/assessments/${assessmentId}/print`)
    vi.stubGlobal('fetch', vi.fn(async () => json(detailBody)))

    const { container } = render(<AdminApp />)

    expect(await screen.findByText('01｜我的核心结论')).toBeInTheDocument()
    expect(screen.getByText('02｜我的元能力画像')).toBeInTheDocument()
    expect(screen.getByText('03｜我的学科发挥方向')).toBeInTheDocument()
    expect(screen.getByText('04｜我的学科任务指南')).toBeInTheDocument()
    expect(container.querySelector('.admin-shell')).toBeNull()
    expect(screen.queryByRole('button', { name: '重新生成报告' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '退出登录' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('按姓名或完整手机号搜索')).not.toBeInTheDocument()
    expect(container.querySelector('.print-meta')).toHaveTextContent('报告版本：1')
    expect(container.querySelector('.admin-print-view .report-nav')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存报告' })).toBeInTheDocument()
  })

  it.each([
    '/admin/assessments/not-a-uuid',
    '/admin/assessments/%E0%A4%A',
    '/admin/assessments/not-a-uuid/print',
  ])('renders malformed assessment route %s as not found without fetching', async (pathname) => {
    window.history.replaceState(null, '', pathname)
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)

    render(<AdminApp />)

    expect(screen.getByRole('heading', { name: '页面不存在' })).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('clears stale rows before a failed exact-phone result is shown', async () => {
    window.history.replaceState(null, '', '/admin')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = requestPath(input)
      if (url.startsWith('/api/admin/assessments?')) return json(listBody)
      if (url === '/api/admin/assessments/search') {
        return json({ error: { code: 'service_unavailable', message: '服务暂时不可用，请稍后重试' } }, 500)
      }
      throw new Error(`Unexpected request: ${url}`)
    }))
    const user = userEvent.setup()

    render(<AdminApp />)
    expect(await screen.findByText('138****8000')).toBeInTheDocument()
    await user.type(screen.getByLabelText('按姓名或完整手机号搜索'), '13800138000')
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('服务暂时不可用')
    expect(screen.queryByText('138****8000')).not.toBeInTheDocument()
  })

  it.each([
    ['network', () => Promise.reject(new TypeError('offline'))],
    ['forbidden', () => Promise.resolve(json({ error: { code: 'forbidden', message: '请求来源无效' } }, 403))],
    ['server', () => Promise.resolve(json({ error: { code: 'service_unavailable', message: '服务暂时不可用，请稍后重试' } }, 500))],
    ['unexpected success shape', () => Promise.resolve(json({}))],
  ])('keeps the authenticated screen on %s logout failure and offers a retry', async (_case, logoutResponse) => {
    window.history.replaceState(null, '', '/admin')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = requestPath(input)
      if (url.startsWith('/api/admin/assessments?')) return json(listBody)
      if (url === '/api/admin/logout') return logoutResponse()
      throw new Error(`Unexpected request: ${url}`)
    }))
    const user = userEvent.setup()

    render(<AdminApp />)
    expect(await screen.findByRole('heading', { name: '全部报告' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '退出登录' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('退出登录失败，请重试')
    expect(screen.getByRole('heading', { name: '全部报告' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/admin')
  })

  it.each([204, 401])('returns to login after logout status %s', async (status) => {
    window.history.replaceState(null, '', '/admin')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = requestPath(input)
      if (url.startsWith('/api/admin/assessments?')) return json(listBody)
      if (url === '/api/admin/logout') return status === 204
        ? new Response(null, { status })
        : json({ error: { code: 'unauthorized', message: '请先登录' } }, status)
      throw new Error(`Unexpected request: ${url}`)
    }))
    const user = userEvent.setup()

    render(<AdminApp />)
    await user.click(await screen.findByRole('button', { name: '退出登录' }))

    expect(await screen.findByRole('heading', { name: '管理员登录' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/admin/login')
  })

  it.each([
    ['malformed report', { report: {}, reportGeneratedAt: '2026-09-10T09:00:00.000Z', reportRevision: 2 }],
    ['non-ISO timestamp', { report, reportGeneratedAt: '2026-09-10 09:00', reportRevision: 2 }],
    ['non-numeric revision', { report, reportGeneratedAt: '2026-09-10T09:00:00.000Z', reportRevision: '2' }],
    ['non-positive revision', { report, reportGeneratedAt: '2026-09-10T09:00:00.000Z', reportRevision: 0 }],
    ['unchanged revision', { report, reportGeneratedAt: '2026-09-10T09:00:00.000Z', reportRevision: 1 }],
  ])('rejects a 200 regeneration response with %s without false success', async (_case, regenerated) => {
    window.history.replaceState(null, '', `/admin/assessments/${assessmentId}`)
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = requestPath(input)
      if (url === `/api/admin/assessments/${assessmentId}`) return json(detailBody)
      if (url.endsWith('/regenerate')) return json(regenerated)
      throw new Error(`Unexpected request: ${url}`)
    }))
    const user = userEvent.setup()

    render(<AdminApp />)
    await user.click(await screen.findByRole('button', { name: '重新生成报告' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('服务返回的报告数据无效')
    expect(screen.getByText('报告版本 1')).toBeInTheDocument()
    expect(screen.queryByText(/报告已重新生成/)).not.toBeInTheDocument()
  })

  it('accepts a valid higher regeneration revision produced by a concurrent administrator', async () => {
    window.history.replaceState(null, '', `/admin/assessments/${assessmentId}`)
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = requestPath(input)
      if (url === `/api/admin/assessments/${assessmentId}`) return json(detailBody)
      if (url.endsWith('/regenerate')) {
        return json({ report, reportGeneratedAt: '2026-09-10T09:00:00.000Z', reportRevision: 3 })
      }
      throw new Error(`Unexpected request: ${url}`)
    }))
    const user = userEvent.setup()

    render(<AdminApp />)
    await user.click(await screen.findByRole('button', { name: '重新生成报告' }))

    expect(await screen.findByText('报告已重新生成，当前版本为 3。')).toBeInTheDocument()
    expect(screen.getByText('报告版本 3')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rejects malformed authorized detail before rendering private data', async () => {
    window.history.replaceState(null, '', `/admin/assessments/${assessmentId}`)
    vi.stubGlobal('fetch', vi.fn(async () => json({ ...detailBody, report: {} })))

    render(<AdminApp />)

    expect(await screen.findByRole('alert')).toHaveTextContent('服务返回的报告数据无效')
    expect(screen.queryByText('13800138000')).not.toBeInTheDocument()
  })
})

describe('administrator API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts the empty successful logout response while retaining cookie credentials', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetcher)

    await expect(logout()).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenCalledWith('/api/admin/logout', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: '{}',
    }))
  })

  it('surfaces a safe rate-limit message with a valid Retry-After delay', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(
      { error: { code: 'rate_limited', message: '登录尝试过多，请稍后再试' } },
      429,
      { 'Retry-After': '12' },
    )))

    await expect(login('admin', 'wrong-password')).rejects.toThrow('登录尝试过多，请稍后再试（12 秒后可重试）')
  })
})

describe('administrator route boundary', () => {
  it('matches only /admin and its descendants', () => {
    expect(isAdminPath('/admin')).toBe(true)
    expect(isAdminPath('/admin/login')).toBe(true)
    expect(isAdminPath('/administrator')).toBe(false)
    expect(isAdminPath('/administer')).toBe(false)
  })

  it('safely rejects invalid encoded or non-UUID identifiers', () => {
    expect(adminRouteFor('/admin/assessments/not-a-uuid')).toEqual({ kind: 'not-found' })
    expect(adminRouteFor('/admin/assessments/%E0%A4%A')).toEqual({ kind: 'not-found' })
    expect(adminRouteFor(`/admin/assessments/${assessmentId}`)).toEqual({ kind: 'detail', id: assessmentId })
  })
})

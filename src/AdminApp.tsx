import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import AdminLogin from './admin/AdminLogin'
import AssessmentDetail from './admin/AssessmentDetail'
import AssessmentList from './admin/AssessmentList'
import { AdminUnauthorizedError, getAssessment, logout } from './admin/admin-api'
import type { AssessmentDetailResponse } from './admin/admin-types'
import Report from './components/Report'
import { adminHref, currentAdminPath } from './lib/api-endpoint'

type AdminRoute =
  | { kind: 'login' }
  | { kind: 'list' }
  | { kind: 'detail'; id: string }
  | { kind: 'print'; id: string }
  | { kind: 'not-found' }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

function decodeAssessmentId(segment: string): string | null {
  try {
    const id = decodeURIComponent(segment)
    return UUID_PATTERN.test(id) ? id : null
  } catch {
    return null
  }
}

export function adminRouteFor(pathname: string): AdminRoute {
  if (pathname === '/admin/login') return { kind: 'login' }
  if (pathname === '/admin' || pathname === '/admin/') return { kind: 'list' }
  const print = pathname.match(/^\/admin\/assessments\/([^/]+)\/print\/?$/)
  if (print) {
    const id = decodeAssessmentId(print[1])
    return id ? { kind: 'print', id } : { kind: 'not-found' }
  }
  const detail = pathname.match(/^\/admin\/assessments\/([^/]+)\/?$/)
  if (detail) {
    const id = decodeAssessmentId(detail[1])
    return id ? { kind: 'detail', id } : { kind: 'not-found' }
  }
  return { kind: 'not-found' }
}

interface AdminShellProps {
  children: ReactNode
  onNavigate(path: string): void
  onLogout(): void
  logoutError: string
  loggingOut: boolean
}

function AdminShell({ children, onNavigate, onLogout, logoutError, loggingOut }: AdminShellProps) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    onNavigate('/admin')
  }
  return (
    <div className="admin-shell">
      <header className="admin-nav">
        <a className="brand" href={adminHref('/admin')} onClick={navigate} aria-label="管理端测评记录">
          <span className="brand-mark">D</span><span>解码学习 <small>管理端</small></span>
        </a>
        <button type="button" onClick={onLogout} disabled={loggingOut}>{loggingOut ? '正在退出…' : '退出登录'}</button>
      </header>
      {logoutError ? <p className="admin-error admin-logout-error" role="alert">{logoutError}</p> : null}
      {children}
    </div>
  )
}

function PrintAssessment({ id, onUnauthorized }: { id: string; onUnauthorized(): void }) {
  const [detail, setDetail] = useState<AssessmentDetailResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getAssessment(id).then((response) => {
      if (active) setDetail(response)
    }).catch((reason) => {
      if (!active) return
      if (reason instanceof AdminUnauthorizedError) onUnauthorized()
      else setError(reason instanceof Error ? reason.message : '加载失败，请稍后重试')
    })
    return () => { active = false }
  }, [id, onUnauthorized])

  if (error) return <main className="admin-print-state"><p className="admin-error" role="alert">{error}</p></main>
  if (!detail) return <main className="admin-print-state"><p className="admin-loading" role="status">正在加载打印报告…</p></main>

  return (
    <div className="admin-print-view">
      <Report
        name={detail.student.name}
        report={detail.report}
        printMeta={{ generatedAt: detail.reportGeneratedAt, revision: detail.reportRevision }}
      />
    </div>
  )
}

export default function AdminApp() {
  const [pathname, setPathname] = useState(currentAdminPath)
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const route = adminRouteFor(pathname)

  const navigate = useCallback((path: string, replace = false) => {
    window.history[replace ? 'replaceState' : 'pushState'](null, '', adminHref(path))
    setPathname(path)
  }, [])

  const returnToLogin = useCallback(() => navigate('/admin/login', true), [navigate])

  useEffect(() => {
    const onPopState = () => setPathname(currentAdminPath())
    window.addEventListener('popstate', onPopState)
    window.addEventListener('hashchange', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('hashchange', onPopState)
    }
  }, [])

  async function signOut() {
    if (loggingOut) return
    setLoggingOut(true)
    setLogoutError('')
    try {
      await logout()
      returnToLogin()
    } catch (reason) {
      if (reason instanceof AdminUnauthorizedError) returnToLogin()
      else setLogoutError('退出登录失败，请重试')
    } finally {
      setLoggingOut(false)
    }
  }

  if (route.kind === 'login') return <AdminLogin onSuccess={() => navigate('/admin', true)} />
  if (route.kind === 'print') return <PrintAssessment id={route.id} onUnauthorized={returnToLogin} />

  return (
    <AdminShell onNavigate={navigate} onLogout={signOut} logoutError={logoutError} loggingOut={loggingOut}>
      {route.kind === 'list' ? <AssessmentList onNavigate={navigate} onUnauthorized={returnToLogin} /> : null}
      {route.kind === 'detail' ? <AssessmentDetail id={route.id} onNavigate={navigate} onUnauthorized={returnToLogin} /> : null}
      {route.kind === 'not-found' ? <main className="admin-page admin-empty"><h1>页面不存在</h1><a className="admin-text-link" href={adminHref('/admin')}>返回测评记录</a></main> : null}
    </AdminShell>
  )
}

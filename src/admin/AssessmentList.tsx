import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { adminHref } from '../lib/api-endpoint'
import { AdminUnauthorizedError, listAssessments } from './admin-api'
import type { AssessmentListResponse, AssessmentSearch, AssessmentStatus } from './admin-types'

interface AssessmentListProps {
  onNavigate(path: string): void
  onUnauthorized(): void
}

const statusCopy: Record<AssessmentStatus, string> = {
  submitted: '已提交',
  processing: '生成中',
  ready: '报告就绪',
  failed: '生成失败',
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(value))
}

function submittedSearch(rawValue: string): AssessmentSearch {
  const value = rawValue.trim()
  if (!value) return { kind: 'all' }
  if (/^1\d{10}$/.test(value.replace(/\s/g, ''))) return { kind: 'phone', phone: value }
  return { kind: 'name', name: value }
}

export default function AssessmentList({ onNavigate, onUnauthorized }: AssessmentListProps) {
  const [input, setInput] = useState('')
  const [search, setSearch] = useState<AssessmentSearch>({ kind: 'all' })
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<AssessmentListResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setResult(null)
    listAssessments(search, page).then((response) => {
      if (active) setResult(response)
    }).catch((reason) => {
      if (!active) return
      if (reason instanceof AdminUnauthorizedError) onUnauthorized()
      else setError(reason instanceof Error ? reason.message : '加载失败，请稍后重试')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [onUnauthorized, page, search])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextSearch = submittedSearch(input)
    setPage(1)
    setSearch(nextSearch)
    if (nextSearch.kind === 'phone') setInput('')
  }

  function showAll() {
    setInput('')
    setPage(1)
    setSearch({ kind: 'all' })
  }

  function openDetail(event: MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault()
    onNavigate(`/admin/assessments/${encodeURIComponent(id)}`)
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  return (
    <section className="admin-page admin-list-page">
      <header className="admin-page-heading">
        <div><p className="admin-eyebrow">测评档案</p><h1>全部报告</h1></div>
        <p>默认显示本项目全部测评记录，最新提交在前。点击“查看报告”即可打开报告并打印，无需先搜索。</p>
      </header>
      <form className="admin-search" onSubmit={submit}>
        <label htmlFor="admin-search">按姓名或完整手机号搜索</label>
        <div>
          <input
            id="admin-search"
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入姓名或 11 位完整手机号"
          />
          <button type="submit">搜索</button>
          <button type="button" onClick={showAll}>查看全部</button>
        </div>
        <small>手机号只用于服务器精确查询，不会写入网址。</small>
      </form>

      {error ? <p className="admin-error" role="alert">{error}</p> : null}
      {loading ? <p className="admin-loading" role="status">正在加载记录…</p> : null}
      {!loading && result ? <p className="admin-results-summary" role="status">{search.kind === 'all' ? `共 ${result.total} 条测评记录 · 按最新提交排序` : `找到 ${result.total} 条测评记录 · 当前为筛选结果`}</p> : null}
      {!loading && result?.items.length === 0 ? <p className="admin-empty">{search.kind === 'all' ? '暂时还没有测评记录。学生提交后，会自动显示在这里。' : '没有找到符合条件的测评记录。'}</p> : null}
      {!loading && result?.items.length ? (
        <div className="admin-table-wrap">
          <table>
            <thead><tr><th scope="col">姓名</th><th scope="col">手机号</th><th scope="col">年级</th><th scope="col">完成时间</th><th scope="col">报告状态</th><th scope="col"><span className="admin-sr-only">操作</span></th></tr></thead>
            <tbody>{result.items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.studentName}</strong></td>
                <td><span className="admin-mobile-label" aria-hidden="true">手机号</span><span>{item.phoneMasked}</span></td>
                <td><span className="admin-mobile-label" aria-hidden="true">年级</span><span>{item.grade}</span></td>
                <td><span className="admin-mobile-label" aria-hidden="true">完成时间</span><span>{formatDateTime(item.completedAt)}</span></td>
                <td><span className="admin-mobile-label" aria-hidden="true">报告状态</span><span className={`admin-status admin-status-${item.status}`}>{statusCopy[item.status]}</span></td>
                <td><a className="admin-text-link" href={adminHref(`/admin/assessments/${encodeURIComponent(item.id)}`)} onClick={(event) => openDetail(event, item.id)}>查看报告</a></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
      {!loading && result && totalPages > 1 ? (
        <nav className="admin-pagination" aria-label="记录分页">
          <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>上一页</button>
          <span>第 {page} / {totalPages} 页</span>
          <button type="button" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>下一页</button>
        </nav>
      ) : null}
    </section>
  )
}

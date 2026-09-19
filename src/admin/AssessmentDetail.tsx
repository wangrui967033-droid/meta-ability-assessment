import { useEffect, useState, type MouseEvent } from 'react'
import { adminHref } from '../lib/api-endpoint'
import Report from '../components/Report'
import { AdminUnauthorizedError, getAssessment, regenerateAssessment } from './admin-api'
import type { AssessmentDetailResponse } from './admin-types'

interface AssessmentDetailProps {
  id: string
  onNavigate(path: string): void
  onUnauthorized(): void
}

export function formatAdminDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(value))
}

export default function AssessmentDetail({ id, onNavigate, onUnauthorized }: AssessmentDetailProps) {
  const [detail, setDetail] = useState<AssessmentDetailResponse | null>(null)
  const [error, setError] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    setDetail(null)
    setError('')
    getAssessment(id).then((response) => {
      if (active) setDetail(response)
    }).catch((reason) => {
      if (!active) return
      if (reason instanceof AdminUnauthorizedError) onUnauthorized()
      else setError(reason instanceof Error ? reason.message : '加载失败，请稍后重试')
    })
    return () => { active = false }
  }, [id, onUnauthorized])

  async function regenerate() {
    if (!detail || regenerating) return
    setRegenerating(true)
    setError('')
    setSuccess('')
    try {
      const updated = await regenerateAssessment(id, detail.reportRevision)
      setDetail({ ...detail, ...updated })
      setSuccess(`报告已重新生成，当前版本为 ${updated.reportRevision}。`)
    } catch (reason) {
      if (reason instanceof AdminUnauthorizedError) onUnauthorized()
      else setError(reason instanceof Error ? reason.message : '重新生成失败，请稍后重试')
    } finally {
      setRegenerating(false)
    }
  }

  function back(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    onNavigate('/admin')
  }

  if (error && !detail) return <p className="admin-error" role="alert">{error}</p>
  if (!detail) return <p className="admin-loading" role="status">正在加载报告…</p>

  return (
    <section className="admin-page admin-detail-page">
      <a className="admin-back-link" href={adminHref('/admin')} onClick={back}>← 返回测评记录</a>
      <header className="admin-detail-heading">
        <div>
          <p className="admin-eyebrow">已授权测评详情</p>
          <h1>{detail.student.name}的测评报告</h1>
          <p><span>报告版本 {detail.reportRevision}</span> · 生成于 {formatAdminDateTime(detail.reportGeneratedAt)}</p>
        </div>
        <div className="admin-detail-actions">
          <button type="button" onClick={regenerate} disabled={regenerating}>{regenerating ? '正在生成…' : '重新生成报告'}</button>
          <a href={adminHref(`/admin/assessments/${encodeURIComponent(id)}/print`)}>打印报告</a>
        </div>
      </header>
      {success ? <p className="admin-success" role="status">{success}</p> : null}
      {error ? <p className="admin-error" role="alert">{error}</p> : null}
      <dl className="admin-meta-grid">
        <div><dt>完整手机号</dt><dd>{detail.student.phone}</dd></div>
        <div><dt>年级</dt><dd>{detail.student.grade}</dd></div>
        <div><dt>外语</dt><dd>{detail.student.foreignLanguage}</dd></div>
        <div><dt>选考学科</dt><dd>{detail.student.selectedSubjects.join('、') || '未选择'}</dd></div>
        <div><dt>测评完成时间</dt><dd>{formatAdminDateTime(detail.completedAt)}</dd></div>
        <div><dt>记录状态</dt><dd>{detail.status === 'ready' ? '报告就绪' : detail.status}</dd></div>
      </dl>
      <div className="admin-report-preview">
        <Report name={detail.student.name} report={detail.report} />
      </div>
    </section>
  )
}

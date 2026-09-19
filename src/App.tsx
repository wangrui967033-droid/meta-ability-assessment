import { randomId } from './lib/random-id'
import { READABLE_BANK_VERSION } from './lib/presentation-protocol'
import { useEffect, useMemo, useRef, useState } from 'react'
import Report from './components/Report'
import { IntakeScreen } from './components/IntakeScreen'
import { InstructionsScreen } from './components/InstructionsScreen'
import { MemoryPresentationScreen } from './components/MemoryPresentationScreen'
import { ProcessingView } from './components/ProcessingView'
import { ResumePrompt } from './components/ResumePrompt'
import { TaskFrame } from './components/TaskFrame'
import { MultiChoiceTask } from './components/tasks/MultiChoiceTask'
import { assessmentTasksV16 as assessmentTasks } from './data/assessment-bank-v1.6'
import { META_BANK_V16 } from './data/meta-bank-v1.6'
import type { ForeignLanguage, TaskResponse } from './data/assessment-types'
import type { SubjectName } from './data/subject-task-map'
import { buildPrototypeReport, validateIntake } from './lib/assessment'
import { submitAssessment, type SubmittedAssessment } from './lib/api-client'
import { clearSession, createSessionSnapshot, loadSession, saveSession, type SessionSnapshot } from './lib/session'
import './styles.css'
import { displayedInteraction, optionAudit } from './lib/option-order'

type ReportPreviewWindow = Window & { __META_ABILITY_REPORT_PREVIEW__?: SessionSnapshot }
const reportPreviewSession = import.meta.env.MODE !== 'preview' || typeof window === 'undefined'
  ? undefined
  : (window as ReportPreviewWindow).__META_ABILITY_REPORT_PREVIEW__

function isResponseComplete(response: TaskResponse | null, task = assessmentTasks[0]) {
  if (!response) return false
  return task.interaction.type === 'multi-choice' && response.kind === 'multi-choice' && task.interaction.items.every((_, i) => Boolean(response.answers[String(i)]))
}

type SubmitAssessment = (snapshot: SessionSnapshot) => Promise<SubmittedAssessment>

interface AppProps {
  submit?: SubmitAssessment
}

function withSessionDefaults(snapshot: SessionSnapshot): SessionSnapshot {
  const interruptedSubmission = snapshot.screen === 'processing'
    && (snapshot.submission?.status === 'idle' || snapshot.submission?.status === 'submitting')
  return {
    ...snapshot,
    intake: { ...snapshot.intake, phone: typeof snapshot.intake.phone === 'string' ? snapshot.intake.phone : '' },
    submission: interruptedSubmission
      ? { submissionId: snapshot.submission.submissionId, status: 'failed', error: '上次提交中断，请重新提交' }
      : snapshot.submission ?? { status: 'idle' },
    memoryInterrupted: snapshot.memoryInterrupted || snapshot.startedPresentations.some(id => !snapshot.seenPresentations.includes(id)),
  }
}

export default function App({ submit = submitAssessment }: AppProps = {}) {
  // 报告端是一个独立文件：内置示例快照，不读取或覆盖学生正在做的测评记录。
  const isReportPreview = Boolean(reportPreviewSession)
  const restored = useMemo(() => reportPreviewSession ?? loadSession(), [])
  const [session, setSession] = useState<SessionSnapshot>(() => restored ? withSessionDefaults(restored) : createSessionSnapshot())
  const [showResume, setShowResume] = useState(Boolean(!isReportPreview && restored && restored.screen !== 'intake'))
  const [errors, setErrors] = useState<ReturnType<typeof validateIntake>>({})
  const [draft, setDraft] = useState<TaskResponse | null>(restored?.draft ?? null)
  const [visualReady, setVisualReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submissionInFlight = useRef(false)
  const taskStartedAt = useRef(session.taskStartedAt)

  useEffect(() => { if (!isReportPreview) saveSession(session) }, [isReportPreview, session])
  useEffect(() => { document.documentElement.scrollTop = 0; document.body.scrollTop = 0 }, [session.currentPosition, session.screen, session.seenPresentations.length, session.seenPractices.length])
  useEffect(() => { setSession(current => ({...current, draft})) }, [draft])
  useEffect(() => {
    const trackInterruption = () => {
    if (document.hidden && currentPresentation && session.startedPresentations.includes(currentPresentation.id)) updateSession((current) => ({ ...current, memoryInterrupted: true }))
    }
    document.addEventListener('visibilitychange', trackInterruption)
    return () => document.removeEventListener('visibilitychange', trackInterruption)
  }, [session.screen, session.currentPosition, session.seenPresentations, session.startedPresentations])

  const updateSession = (recipe: (current: SessionSnapshot) => SessionSnapshot) => setSession((current) => { const next = recipe(current); if (!isReportPreview) saveSession(next); return next })
  const currentTask = assessmentTasks.find((task) => task.position === session.currentPosition) ?? assessmentTasks[0]
  const currentPresentation = currentTask.memoryPresentationId && !session.seenPresentations.includes(currentTask.memoryPresentationId)
    ? META_BANK_V16.memoryPresentations.find((entry) => entry.id === currentTask.memoryPresentationId) ?? null
    : null
  const reportSubjects = useMemo(() => {
    const foreign = (session.intake.foreignLanguage || '英语') as SubjectName
    return [...new Set(['语文', '数学', foreign, ...session.intake.selectedSubjects])] as SubjectName[]
  }, [session.intake.foreignLanguage, session.intake.selectedSubjects])
  const report = session.submission.report ?? (isReportPreview
    ? buildPrototypeReport(session.responses.flatMap((item) => item.evidence ? [item.evidence] : []), (session.intake.foreignLanguage || '英语') as ForeignLanguage, reportSubjects)
    : null)

  const start = () => {
    const nextErrors = validateIntake(session.intake)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    updateSession((current) => ({ ...current, screen: 'instructions' }))
  }

  const submitFinalSnapshot = async (snapshot: SessionSnapshot) => {
    if (submissionInFlight.current) return
    const submissionId = snapshot.submission.submissionId ?? randomId()
    const phoneError = validateIntake(snapshot.intake).phone
    if (phoneError) {
      setErrors((current) => ({ ...current, phone: phoneError }))
      updateSession((current) => ({
        ...current,
        screen: 'processing',
        submission: { status: 'failed', submissionId, error: '请填写手机号后重新提交' },
      }))
      return
    }
    submissionInFlight.current = true
    setSubmitting(true)
    const submittingSnapshot: SessionSnapshot = { ...snapshot, screen: 'processing', submission: { status: 'submitting', submissionId } }
    updateSession(() => submittingSnapshot)
    try {
      const result = await submit(submittingSnapshot)
      updateSession((current) => ({
        ...current,
        screen: 'report',
        reportGeneratedAt: result.reportGeneratedAt,
        submission: {
          status: 'saved',
          submissionId,
          assessmentId: result.assessmentId,
          report: result.report,
          reportGeneratedAt: result.reportGeneratedAt,
          reportRevision: result.reportRevision,
        },
      }))
    } catch (error) {
      updateSession((current) => ({
        ...current,
        screen: 'processing',
        submission: {
          status: 'failed',
          submissionId,
          error: error instanceof Error ? error.message : '暂时无法提交，请稍后重试',
        },
      }))
    } finally {
      submissionInFlight.current = false
      setSubmitting(false)
    }
  }

  const submitTask = async () => {
    if (!isResponseComplete(draft, currentTask) || !visualReady || submitting) return
    setSubmitting(true)
    const audit = optionAudit(currentTask, session.optionOrders, draft as TaskResponse)
    const submittedAt = Date.now()
    const durationMs = Math.max(500, submittedAt - taskStartedAt.current)
    const presentationId = ({M01:'visual-board', M05:'visual-board', M02:'semantic-pairs', M04:'semantic-pairs', M03:'sequence-4-5', M06:'sequence-6'} as Record<string,string>)[currentTask.code ?? '']
    const endedAt = presentationId ? session.memoryPresentationEndedAt?.[presentationId] : null
    const knownEnd = typeof endedAt === 'number' && !session.memoryInterrupted && endedAt <= taskStartedAt.current && taskStartedAt.current <= submittedAt
    const memoryInterval = presentationId ? {
      presentationId, submittedAt,
      elapsedToTaskMs: knownEnd ? taskStartedAt.current - endedAt : null,
      elapsedToSubmitMs: knownEnd ? submittedAt - endedAt : null,
    } : undefined
    const nextPosition = currentTask.position + 1
    const responses = [...session.responses.filter((item) => item.position !== currentTask.position), { position: currentTask.position, response: draft as TaskResponse, durationMs, optionAudit: audit, memoryInterval, submittedAt: new Date(submittedAt).toISOString() }]
    const nextSession: SessionSnapshot = nextPosition > assessmentTasks.length
      ? { ...session, responses, completedTaskCount: responses.length, actualDurationMs: Date.now() - (session.startedAt ?? Date.now()), draft: null, currentPosition: nextPosition, screen: 'processing', submission: { status: 'idle', submissionId: randomId() } }
      : { ...session, responses, completedTaskCount: responses.length, draft: null, taskStartedAt: Date.now(), currentPosition: nextPosition, screen: 'tasks' }
    updateSession(() => nextSession)
    setDraft(null)
    taskStartedAt.current = Date.now()
    setSubmitting(false)
    if (nextPosition > assessmentTasks.length) await submitFinalSnapshot(nextSession)
  }

  if (showResume) return <ResumePrompt onResume={() => setShowResume(false)} onRestart={() => { clearSession(); setSession(createSessionSnapshot()); setDraft(null); setErrors({}); setShowResume(false) }} />
  if (session.screen === 'intake') return <IntakeScreen intake={session.intake} errors={errors} onChange={(intake) => updateSession((current) => ({ ...current, intake }))} onStart={start} />
  if (session.screen === 'instructions') return <InstructionsScreen onStart={() => updateSession((current) => ({ ...current, startedAt: Date.now(), taskStartedAt: Date.now(), screen: 'tasks', currentPosition: 1 }))} />
  if (session.screen === 'processing') return <div className="submission-shell"><ProcessingView /><section className={`submission-state ${session.submission.status === 'failed' ? 'submission-failed' : ''}`} role="status">
    {session.submission.status === 'failed'
      ? <><strong>尚未提交，可重试</strong><p>{session.submission.error}</p>{(errors.phone || validateIntake(session.intake).phone) ? <div className="submission-phone"><label htmlFor="retry-phone">手机号</label><input id="retry-phone" aria-label="手机号" inputMode="tel" autoComplete="tel" value={session.intake.phone} onChange={(event) => { const phone = event.target.value; setErrors((current) => ({ ...current, phone: undefined })); updateSession((current) => ({ ...current, intake: { ...current.intake, phone } })) }} placeholder="请输入11位手机号" /><small>手机号仅用于机构查找报告，不影响评分，也不会保存在本机测评记录中。</small></div> : null}<button className="secondary-button" type="button" onClick={() => void submitFinalSnapshot(session)} disabled={submitting}>重新提交</button></>
      : <p>正在安全保存作答，请稍候。</p>}
  </section></div>
  if (session.screen === 'report' && report) return <><Report name={session.intake.name} report={report} /><footer className="app-shell report-save-footer">{session.submission.status === 'saved' && <strong>已保存到机构后台</strong>}<p>已完成 {session.completedTaskCount} / 30 组题；本次用时 {Math.round((session.actualDurationMs ?? 0) / 1000)} 秒（包括中途停留的时间）。</p><p>报告生成时间：{session.reportGeneratedAt ? new Date(session.reportGeneratedAt).toLocaleString('zh-CN') : '—'}</p>{session.memoryInterrupted && <p>看记忆材料时，你曾离开页面。这可能影响了作答，记忆部分的结果不能只看这一次。</p>}<p>{isReportPreview ? '这是本地报告预览。' : '作答已保存；需要留存纸质或 PDF 时请点“保存报告”。'}</p></footer></>

  if (currentPresentation) {
    return <MemoryPresentationScreen
      key={currentPresentation.id}
      presentation={currentPresentation}
      readable={session.bankVersion === READABLE_BANK_VERSION}
      previouslyStarted={session.startedPresentations.includes(currentPresentation.id)}
      onStart={() => updateSession(current => ({...current, startedPresentations: [...new Set([...current.startedPresentations, currentPresentation.id])]}))}
      interrupted={session.memoryInterrupted}
      onComplete={() => {
        taskStartedAt.current = Date.now()
        updateSession((current) => ({
          ...current,
          memoryPresentationEndedAt: {...current.memoryPresentationEndedAt, [currentPresentation.id]: current.memoryInterrupted ? null : taskStartedAt.current},
          taskStartedAt: Date.now(),
          encodingSeen: current.encodingSeen || currentPresentation.id === 'visual-board',
          sequenceSeen: current.sequenceSeen || currentPresentation.id.startsWith('sequence-'),
          seenPresentations: [...current.seenPresentations, currentPresentation.id],
        }))
      }}
    />
  }

  const progress = Math.round((session.responses.length / assessmentTasks.length) * 100)
  return (
    <TaskFrame prompt={currentTask.prompt} helper={currentTask.helper} progress={progress} disabled={!isResponseComplete(draft, currentTask) || !visualReady || submitting} onConfirm={() => void submitTask()} confirmLabel={currentTask.position === assessmentTasks.length ? '完成测评' : '确认并继续'}>
      {currentTask.interaction.type === 'multi-choice' && <MultiChoiceTask key={currentTask.id} persistenceKey={`${session.sessionId}:${currentTask.id}`} onVisualReady={setVisualReady} interaction={displayedInteraction(currentTask, session.optionOrders)} value={draft} onChange={setDraft}/> }
    </TaskFrame>
  )
}

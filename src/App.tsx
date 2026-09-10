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
import { LocalPrototypeAdapter } from './lib/transport'
import { clearSession, createSessionSnapshot, loadSession, saveSession, type SessionSnapshot } from './lib/session'
import './styles.css'
import { displayedInteraction, optionAudit } from './lib/option-order'

const adapter = new LocalPrototypeAdapter()

type ReportPreviewWindow = Window & { __META_ABILITY_REPORT_PREVIEW__?: SessionSnapshot }
const reportPreviewSession = typeof window === 'undefined'
  ? undefined
  : (window as ReportPreviewWindow).__META_ABILITY_REPORT_PREVIEW__

function isResponseComplete(response: TaskResponse | null, task = assessmentTasks[0]) {
  if (!response) return false
  return task.interaction.type === 'multi-choice' && response.kind === 'multi-choice' && task.interaction.items.every((_, i) => Boolean(response.answers[String(i)]))
}

export default function App() {
  // 报告端是一个独立文件：内置示例快照，不读取或覆盖学生正在做的测评记录。
  const isReportPreview = Boolean(reportPreviewSession)
  const restored = useMemo(() => reportPreviewSession ?? loadSession(), [])
  const [session, setSession] = useState<SessionSnapshot>(() => restored ? {...restored, memoryInterrupted: restored.memoryInterrupted || restored.startedPresentations.some(id => !restored.seenPresentations.includes(id))} : createSessionSnapshot())
  const [showResume, setShowResume] = useState(Boolean(!isReportPreview && restored && restored.screen !== 'intake'))
  const [errors, setErrors] = useState<ReturnType<typeof validateIntake>>({})
  const [draft, setDraft] = useState<TaskResponse | null>(restored?.draft ?? null)
  const [visualReady, setVisualReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const taskStartedAt = useRef(session.taskStartedAt)

  useEffect(() => { if (!isReportPreview) saveSession(session) }, [isReportPreview, session])
  useEffect(() => { document.documentElement.scrollTop = 0; document.body.scrollTop = 0 }, [session.currentPosition, session.screen, session.seenPresentations.length, session.seenPractices.length])
  useEffect(() => { setSession(current => ({...current, draft})) }, [draft])
  useEffect(() => {
    if (session.screen !== 'processing') return
    const timer = window.setTimeout(() => setSession((current) => ({ ...current, screen: 'report', reportGeneratedAt: current.reportGeneratedAt ?? new Date().toISOString() })), 650)
    return () => window.clearTimeout(timer)
  }, [session.screen])
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
  const report = buildPrototypeReport(session.responses.flatMap((item) => item.evidence ? [item.evidence] : []), (session.intake.foreignLanguage || '英语') as ForeignLanguage, reportSubjects)

  const start = () => {
    const nextErrors = validateIntake(session.intake)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    updateSession((current) => ({ ...current, screen: 'instructions' }))
  }

  const submitTask = async () => {
    if (!isResponseComplete(draft, currentTask) || !visualReady || submitting) return
    setSubmitting(true)
    const audit = optionAudit(currentTask, session.optionOrders, draft as TaskResponse)
    const evidence = await adapter.submit({ task: currentTask, response: draft as TaskResponse, durationMs: Math.max(500, Date.now() - taskStartedAt.current), optionAudit: audit, sessionId: session.sessionId, bankVersion: session.bankVersion, optionOrderVersion: session.optionOrderVersion })
    const submittedAt = Date.now()
    const presentationId = ({M01:'visual-board', M05:'visual-board', M02:'semantic-pairs', M04:'semantic-pairs', M03:'sequence-4-5', M06:'sequence-6'} as Record<string,string>)[currentTask.code ?? '']
    const endedAt = presentationId ? session.memoryPresentationEndedAt?.[presentationId] : null
    const knownEnd = typeof endedAt === 'number' && !session.memoryInterrupted && endedAt <= taskStartedAt.current && taskStartedAt.current <= submittedAt
    const memoryInterval = presentationId ? {
      presentationId, submittedAt,
      elapsedToTaskMs: knownEnd ? taskStartedAt.current - endedAt : null,
      elapsedToSubmitMs: knownEnd ? submittedAt - endedAt : null,
    } : undefined
    const nextPosition = currentTask.position + 1
    updateSession((current) => {
      const responses = [...current.responses.filter((item) => item.position !== currentTask.position), { position: currentTask.position, response: draft as TaskResponse, optionAudit: audit, evidence, memoryInterval, submittedAt: new Date(submittedAt).toISOString() }]
      if (nextPosition > assessmentTasks.length) return { ...current, responses, completedTaskCount: responses.length, actualDurationMs: Date.now() - (current.startedAt ?? Date.now()), draft: null, currentPosition: nextPosition, screen: 'processing' }
      return { ...current, responses, completedTaskCount: responses.length, draft: null, taskStartedAt: Date.now(), currentPosition: nextPosition, screen: 'tasks' }
    })
    setDraft(null)
    taskStartedAt.current = Date.now()
    setSubmitting(false)
  }

  if (showResume) return <ResumePrompt onResume={() => setShowResume(false)} onRestart={() => { clearSession(); setSession(createSessionSnapshot()); setDraft(null); setErrors({}); setShowResume(false) }} />
  if (session.screen === 'intake') return <IntakeScreen intake={session.intake} errors={errors} onChange={(intake) => updateSession((current) => ({ ...current, intake }))} onStart={start} />
  if (session.screen === 'instructions') return <InstructionsScreen onStart={() => updateSession((current) => ({ ...current, startedAt: Date.now(), taskStartedAt: Date.now(), screen: 'tasks', currentPosition: 1 }))} />
  if (session.screen === 'processing') return <ProcessingView />
  if (session.screen === 'report') return <><Report name={session.intake.name} report={report} /><footer className="app-shell"><p>已完成 {session.completedTaskCount} / 30 组题；本次用时 {Math.round((session.actualDurationMs ?? 0) / 1000)} 秒（包括中途停留的时间）。</p><p>报告生成时间：{session.reportGeneratedAt ? new Date(session.reportGeneratedAt).toLocaleString('zh-CN') : '—'}</p>{session.memoryInterrupted && <p>看记忆材料时，你曾离开页面。这可能影响了作答，记忆部分的结果不能只看这一次。</p>}<p>这是试用版测评。报告只保存在这台设备上，需要留存时请点“保存报告”。</p></footer></>

  if (currentPresentation) {
    return <MemoryPresentationScreen
      key={currentPresentation.id}
      presentation={currentPresentation}
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

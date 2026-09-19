import { randomId } from './random-id'
import { READABLE_BANK_VERSION } from './presentation-protocol'
import type { Intake, TaskResponse } from '../data/assessment-types'
import type { ReportModel, ScoredEvidence } from './assessment'
import type { PilotFeedbackRecord } from '../components/PilotFeedback'
import { createOptionOrders, validOptionOrders, OPTION_ORDER_VERSION, type OptionOrders, type OptionAudit } from './option-order'

export const SESSION_SCHEMA_VERSION = 11
export const SESSION_STORAGE_KEY = 'meta-ability-assessment-v1.6-student-8s'

export type Screen = 'intake' | 'instructions' | 'encoding' | 'sequence' | 'tasks' | 'processing' | 'report'

export interface SavedResponse {
  /** 描述实际记忆间隔，不进入评分；展示中断时 elapsed 为 null。 */
  memoryInterval?: {
    presentationId: string
    submittedAt: number
    elapsedToTaskMs: number | null
    elapsedToSubmitMs: number | null
  }
  optionAudit?: OptionAudit[]
  position: number
  response: TaskResponse
  durationMs?: number
  /** Legacy preview-only evidence; production student sessions store raw responses only. */
  evidence?: ScoredEvidence
  submittedAt: string
}

export interface SubmissionState {
  status: 'idle' | 'submitting' | 'failed' | 'saved'
  /** Stable, opaque idempotency key created once when the final answer is recorded. */
  submissionId?: string
  assessmentId?: string
  error?: string
  report?: ReportModel
  reportGeneratedAt?: string
  reportRevision?: number
}

export interface SessionSnapshot {
  memoryPresentationEndedAt: Record<string, number | null>
  pilotFeedback?: PilotFeedbackRecord
  optionOrderVersion: string
  optionOrders: OptionOrders
  sessionId: string
  bankVersion: string
  scoringVersion: string
  mappingVersion: string
  startedAt: number | null
  taskStartedAt: number
  completedTaskCount: number
  actualDurationMs: number | null
  reportGeneratedAt: string | null
  startedPresentations: string[]
  draft: TaskResponse | null
  schemaVersion: number
  intake: Intake
  screen: Screen
  currentPosition: number
  encodingSeen: boolean
  sequenceSeen: boolean
  memoryInterrupted: boolean
  seenPresentations: string[]
  seenPractices: string[]
  responses: SavedResponse[]
  submission: SubmissionState
  updatedAt: string
}

const emptyIntake: Intake = { name: '', phone: '', grade: '', foreignLanguage: '', selectedSubjects: [] }

export function createSessionSnapshot(): SessionSnapshot {
  return {
    memoryPresentationEndedAt: {},
    optionOrderVersion: OPTION_ORDER_VERSION,
    optionOrders: createOptionOrders(),
    sessionId: randomId(),
    bankVersion: READABLE_BANK_VERSION,
    scoringVersion: '1.6-task-mean-1',
    mappingVersion: '1.6-frozen-20260905',
    startedAt: null,
    taskStartedAt: Date.now(),
    completedTaskCount: 0,
    actualDurationMs: null,
    reportGeneratedAt: null,
    startedPresentations: [],
    draft: null,
    schemaVersion: SESSION_SCHEMA_VERSION,
    intake: { ...emptyIntake },
    screen: 'intake',
    currentPosition: 1,
    encodingSeen: false,
    sequenceSeen: false,
    memoryInterrupted: false,
    seenPresentations: [],
    seenPractices: [],
    responses: [],
    submission: { status: 'idle' },
    updatedAt: new Date().toISOString(),
  }
}

function isScreen(value: unknown): value is Screen {
  return typeof value === 'string' && ['intake', 'instructions', 'encoding', 'sequence', 'tasks', 'processing', 'report'].includes(value)
}

function isSnapshotShape(value: unknown): value is SessionSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<SessionSnapshot>
  return (snapshot.schemaVersion === SESSION_SCHEMA_VERSION || snapshot.schemaVersion === 10)
    && snapshot.optionOrderVersion === OPTION_ORDER_VERSION
    && validOptionOrders(snapshot.optionOrders)
    && typeof snapshot.currentPosition === 'number'
    && snapshot.currentPosition >= 1
    && snapshot.currentPosition <= 31
    && isScreen(snapshot.screen)
    && typeof snapshot.sessionId === 'string'
    && Array.isArray(snapshot.startedPresentations)
    && Array.isArray(snapshot.responses)
    && Array.isArray(snapshot.seenPresentations)
    && Array.isArray(snapshot.seenPractices)
    && Boolean(snapshot.intake && typeof snapshot.intake.name === 'string' && (snapshot.intake.phone === undefined || typeof snapshot.intake.phone === 'string') && Array.isArray(snapshot.intake.selectedSubjects))
    && (snapshot.schemaVersion === 10 || Boolean(snapshot.submission && ['idle', 'submitting', 'failed', 'saved'].includes(snapshot.submission.status ?? '')))
}

function resumableSnapshot(snapshot: SessionSnapshot): SessionSnapshot {
  const wasLegacy = snapshot.schemaVersion === 10
  const submission = snapshot.submission ?? { status: 'idle' as const }
  const interruptedSubmission = snapshot.screen === 'processing'
    && (submission.status === 'idle' || submission.status === 'submitting')

  return {
    ...snapshot,
    schemaVersion: SESSION_SCHEMA_VERSION,
    intake: { ...snapshot.intake, phone: '' },
    responses: snapshot.responses.map(({ evidence: _evidence, ...response }) => response),
    screen: wasLegacy && snapshot.screen === 'report' ? 'processing' : snapshot.screen,
    submission: interruptedSubmission || (wasLegacy && snapshot.screen === 'report')
      ? {
          ...(submission.submissionId ? { submissionId: submission.submissionId } : {}),
          status: 'failed',
          error: '上次提交中断，请重新提交',
        }
      : submission,
  }
}

export function parseSessionSnapshot(raw: string | null): SessionSnapshot | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isSnapshotShape(parsed) ? resumableSnapshot(parsed) : null
  } catch {
    return null
  }
}

export function loadSession(): SessionSnapshot | null {
  if (typeof window === 'undefined') return null
  return parseSessionSnapshot(window.localStorage.getItem(SESSION_STORAGE_KEY))
}

export function saveSession(snapshot: SessionSnapshot): boolean {
  if (typeof window === 'undefined') return false
  try {
    const { phone: _phone, ...safeIntake } = snapshot.intake
    const safeResponses = snapshot.responses.map(({ evidence: _evidence, ...response }) => response)
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      ...snapshot,
      intake: safeIntake,
      responses: safeResponses,
      updatedAt: new Date().toISOString(),
    }))
    return true
  } catch {
    return false
  }
}

export function clearSession(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(SESSION_STORAGE_KEY)
}

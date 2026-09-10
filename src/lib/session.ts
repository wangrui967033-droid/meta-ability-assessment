import type { Intake, TaskResponse } from '../data/assessment-types'
import type { ScoredEvidence } from './assessment'
import type { PilotFeedbackRecord } from '../components/PilotFeedback'
import { createOptionOrders, validOptionOrders, OPTION_ORDER_VERSION, type OptionOrders, type OptionAudit } from './option-order'

export const SESSION_SCHEMA_VERSION = 10
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
  evidence?: ScoredEvidence
  submittedAt: string
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
  updatedAt: string
}

const emptyIntake: Intake = { name: '', grade: '', foreignLanguage: '', selectedSubjects: [] }

export function createSessionSnapshot(): SessionSnapshot {
  return {
    memoryPresentationEndedAt: {},
    optionOrderVersion: OPTION_ORDER_VERSION,
    optionOrders: createOptionOrders(),
    sessionId: crypto.randomUUID(),
    bankVersion: '1.6-student-8s-20260907',
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
    updatedAt: new Date().toISOString(),
  }
}

function isScreen(value: unknown): value is Screen {
  return typeof value === 'string' && ['intake', 'instructions', 'encoding', 'sequence', 'tasks', 'processing', 'report'].includes(value)
}

function isSnapshot(value: unknown): value is SessionSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<SessionSnapshot>
  return snapshot.schemaVersion === SESSION_SCHEMA_VERSION
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
    && Boolean(snapshot.intake && typeof snapshot.intake.name === 'string' && Array.isArray(snapshot.intake.selectedSubjects))
}

export function parseSessionSnapshot(raw: string | null): SessionSnapshot | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isSnapshot(parsed) ? parsed : null
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
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ ...snapshot, updatedAt: new Date().toISOString() }))
    return true
  } catch {
    return false
  }
}

export function clearSession(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(SESSION_STORAGE_KEY)
}

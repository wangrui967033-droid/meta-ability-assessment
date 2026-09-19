import {apiEndpoint, usesEdgeApi} from './api-endpoint'
import type { ForeignLanguage } from '../data/assessment-types'
import type { SubjectName } from '../data/subject-task-map'
import type { ReportModel } from './assessment'
import type { SavedResponse, SessionSnapshot } from './session'

export interface AssessmentSubmissionPayload {
  submissionId: string
  name: string
  phone: string
  grade: string
  foreignLanguage: ForeignLanguage
  selectedSubjects: SubjectName[]
  bankVersion: string
  scoringVersion: string
  mappingVersion: string
  responses: SavedResponse[]
}

export interface SubmittedAssessment {
  assessmentId: string
  report: ReportModel
  reportGeneratedAt: string
  reportRevision: number
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string }
}

const RETRY_MESSAGE = '暂时无法提交，请稍后重试'
const dimensions = new Set(['memory', 'language', 'quantitative', 'space', 'reasoning'])
const dimensionLabels = new Map([
  ['memory', '记忆'], ['language', '语言'], ['quantitative', '数理'], ['space', '空间'], ['reasoning', '推演'],
])
const subjects = new Set(['语文', '数学', '英语', '日语', '物理', '化学', '生物', '历史', '政治', '地理', '技术'])
const mechanisms = new Set(['快速记住', '保持信息', '准确提取', '理解意思', '组织信息', '准确表达', '感知数量', '处理符号', '理解变化', '识别结构', '空间想象', '空间转换', '发现关系', '归纳规律', '推出结论'])
const supportStatuses = new Set(['supported', 'entry', 'attention', 'unknown'])
const supportDetails = new Set(['supported', 'mixed', 'gap', 'missing'])
const taskStrategies = new Set(['优势直接参与', '可以借优势进入', '需要带动其他元能力', '重点练习', '暂不判断'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isDimensionArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && dimensions.has(item))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function isMechanism(value: unknown): boolean {
  return isRecord(value)
    && mechanisms.has(String(value.name))
    && isNonEmptyString(value.explanation)
    && isFiniteRange(value.signal, 0, 100)
    && typeof value.state === 'string'
    && ['表现较稳定', '出现优势迹象', '还需要更多观察'].includes(value.state)
}

function isSupport(value: unknown): boolean {
  if (!isRecord(value)) return false
  return supportStatuses.has(String(value.status))
    && (value.pendingReason === undefined || value.pendingReason === 'insufficient')
    && (value.stabilityReview === undefined || isDimensionArray(value.stabilityReview))
    && ['primarySupported', 'entrySupported', 'missing', 'attention', 'practice', 'blocked'].every(
      (key) => isDimensionArray(value[key]),
    )
    && isRecord(value.details)
    && Object.entries(value.details).every(([dimension, detail]) => dimensions.has(dimension) && supportDetails.has(String(detail)))
    && Array.isArray(value.usablePaths)
    && value.usablePaths.every((path) => isRecord(path) && dimensions.has(String(path.ability)) && isNonEmptyString(path.action))
}

function isTopic(value: unknown): boolean {
  return isRecord(value)
    && isNonEmptyString(value.name)
    && isNonEmptyString(value.score)
    && isSupport(value.support)
    && isDimensionArray(value.abilityDimensions)
    && isDimensionArray(value.entryDimensions)
    && isNonEmptyString(value.abilityFocus)
    && isDimensionArray(value.matchedAbilities)
    && isDimensionArray(value.matchedEntryAbilities)
    && (value.displayScore === null || isNonEmptyString(value.displayScore))
    && isNonEmptyString(value.typicalAction)
    && Array.isArray(value.mechanisms)
    && value.mechanisms.every((mechanism) => mechanisms.has(String(mechanism)))
    && isNonEmptyString(value.mappingBasis)
    && (value.reviewStatus === '图谱已标注' || value.reviewStatus === '待教研复核')
    && isNonEmptyString(value.mappingSource)
    && /^(?:catalog-reviewed:|topic-rule:|subject-framework:)/.test(value.mappingSource)
    && taskStrategies.has(String(value.strategy))
}

function isTask(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.graphTopics)) return false
  return isNonEmptyString(value.label)
    && isNonEmptyString(value.graphModule)
    && isNonEmptyString(value.graphScore)
    && value.graphTopics.every(isTopic)
    && isNonEmptyString(value.abilityFocus)
    && typeof value.strategy === 'string'
}

function isSubjectResult(value: unknown): boolean {
  return isRecord(value)
    && subjects.has(String(value.subject))
    && isFiniteRange(value.signal, 0, 100)
    && isDimensionArray(value.entryAbilities)
    && Array.isArray(value.tasks)
    && value.tasks.length > 0
    && value.tasks.every(isTask)
}

function isReportModel(value: unknown): value is ReportModel {
  if (!isRecord(value)) return false
  if (
    !isNonEmptyString(value.conclusion)
    || !dimensions.has(String(value.primary))
    || !dimensions.has(String(value.secondary))
    || typeof value.advantageClarity !== 'string'
    || !['双优势清楚', '单优势清楚', '多项表现突出', '暂不明显'].includes(value.advantageClarity)
    || !isDimensionArray(value.advantageDimensions)
    || !isDimensionArray(value.relativeDimensions)
    || !Array.isArray(value.dimensionSummary)
    || value.dimensionSummary.length !== dimensions.size
    || !Array.isArray(value.mechanismSummary)
    || value.mechanismSummary.length === 0
    || !Array.isArray(value.subjects)
    || value.subjects.length === 0
    || !Array.isArray(value.subjectOpportunityPlan)
    || value.subjectOpportunityPlan.length === 0
    || !Array.isArray(value.subjectTaskPlan)
    || value.subjectTaskPlan.length === 0
  ) return false

  const seen = new Set<string>()
  if (!value.dimensionSummary.every((summary) => {
    if (!isRecord(summary) || !dimensions.has(String(summary.dimension))) return false
    seen.add(String(summary.dimension))
    return summary.label === dimensionLabels.get(String(summary.dimension))
      && isFiniteRange(summary.signal, 0, 100)
      && typeof summary.performance === 'string'
      && ['比较顺手', '能较稳定地用上', '有时能用上', '还需要继续观察'].includes(summary.performance)
      && (summary.evidenceQuality === '证据充分' || summary.evidenceQuality === '证据不足')
      && Number.isInteger(summary.evidenceCount)
      && (summary.evidenceCount as number) >= 0
      && Number.isInteger(summary.mechanismCoverage)
      && (summary.mechanismCoverage as number) >= 0
      && isFiniteRange(summary.consistency, 0, 1)
      && Array.isArray(summary.mechanisms)
      && summary.mechanisms.length > 0
      && summary.mechanisms.every(isMechanism)
  }) || seen.size !== dimensions.size) return false

  if (!value.mechanismSummary.every(isMechanism) || !value.subjects.every(isSubjectResult)) return false

  if (!value.subjectOpportunityPlan.every((subject) => isRecord(subject)
    && subjects.has(String(subject.subject))
    && typeof subject.tier === 'string'
    && ['优势发挥区', '优势借力区', '待发展区', '待了解区'].includes(subject.tier)
    && ['requiredAbilities', 'coreAbilities', 'keyAbilities', 'uncoveredKeyAbilities', 'unobservedAbilities', 'matchedAbilities', 'directCoreMatches', 'supportingAdvantageMatches', 'otherAbilities'].every((key) => isDimensionArray(subject[key]))
    && isSupport(subject.support)
    && isNonEmptyString(subject.reason))) return false

  return value.subjectTaskPlan.every((plan) => isRecord(plan)
    && subjects.has(String(plan.subject))
    && Array.isArray(plan.groups)
    && plan.groups.length > 0
    && plan.groups.every((group) => isRecord(group)
      && taskStrategies.has(String(group.label))
      && Array.isArray(group.tasks)
      && group.tasks.every(isTask)))
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false
  try {
    return new Date(value).toISOString() === value
  } catch {
    return false
  }
}

function isSubmittedAssessment(value: unknown): value is SubmittedAssessment {
  return isRecord(value)
    && isNonEmptyString(value.assessmentId)
    && isIsoDate(value.reportGeneratedAt)
    && Number.isInteger(value.reportRevision)
    && (value.reportRevision as number) >= 1
    && isReportModel(value.report)
}

function studentError(error: ErrorEnvelope['error']): string {
  if (error?.code === 'invalid_submission') return '提交没有完成，请检查后重试'
  if (error?.code === 'payload_too_large') return '作答记录过大，请联系机构协助处理'
  return RETRY_MESSAGE
}

async function responseBody(response: Response): Promise<SubmittedAssessment | ErrorEnvelope | null> {
  try {
    return await response.json() as SubmittedAssessment | ErrorEnvelope
  } catch {
    return null
  }
}

export async function submitAssessment(
  snapshot: SessionSnapshot,
  fetcher: typeof fetch = fetch,
): Promise<SubmittedAssessment> {
  if (!snapshot.submission.submissionId) throw new Error(RETRY_MESSAGE)
  const payload: AssessmentSubmissionPayload = {
    submissionId: snapshot.submission.submissionId,
    name: snapshot.intake.name,
    phone: snapshot.intake.phone,
    grade: snapshot.intake.grade,
    foreignLanguage: snapshot.intake.foreignLanguage as ForeignLanguage,
    selectedSubjects: snapshot.intake.selectedSubjects,
    bankVersion: snapshot.bankVersion,
    scoringVersion: snapshot.scoringVersion,
    mappingVersion: snapshot.mappingVersion,
    responses: snapshot.responses,
  }

  let response: Response
  try {
    response = await fetcher(apiEndpoint('/api/assessments'), {
      method: 'POST',
      credentials: usesEdgeApi ? 'omit' : 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error(RETRY_MESSAGE)
  }

  const body = await responseBody(response)
  if (!response.ok) throw new Error(studentError((body as ErrorEnvelope | null)?.error))
  if (!isSubmittedAssessment(body)) throw new Error(RETRY_MESSAGE)
  return body
}

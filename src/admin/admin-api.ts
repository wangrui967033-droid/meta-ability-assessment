import {apiEndpoint, usesEdgeApi, adminToken, saveAdminSession} from '../lib/api-endpoint'
import type { ReportModel } from '../lib/assessment'
import type {
  AssessmentDetailResponse,
  AssessmentListItem,
  AssessmentListResponse,
  AssessmentSearch,
  AssessmentStatus,
  RegeneratedReportResponse,
} from './admin-types'

const INVALID_REPORT_MESSAGE = '服务返回的报告数据无效'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const statuses = new Set<AssessmentStatus>(['submitted', 'processing', 'ready', 'failed'])
const dimensions = new Set(['memory', 'language', 'quantitative', 'space', 'reasoning'])
const dimensionLabels = new Map([
  ['memory', '记忆'], ['language', '语言'], ['quantitative', '数理'], ['space', '空间'], ['reasoning', '推演'],
])
const subjects = new Set(['语文', '数学', '英语', '日语', '物理', '化学', '生物', '历史', '政治', '地理', '技术'])
const mechanisms = new Set(['快速记住', '保持信息', '准确提取', '理解意思', '组织信息', '准确表达', '感知数量', '处理符号', '理解变化', '识别结构', '空间想象', '空间转换', '发现关系', '归纳规律', '推出结论'])
const supportStatuses = new Set(['supported', 'entry', 'attention', 'unknown'])
const supportDetails = new Set(['supported', 'mixed', 'gap', 'missing'])
const taskStrategies = new Set(['优势直接参与', '可以借优势进入', '需要带动其他元能力', '重点练习', '暂不判断'])

export class AdminUnauthorizedError extends Error {
  constructor() {
    super('请先登录')
    this.name = 'AdminUnauthorizedError'
  }
}

export class AdminRequestError extends Error {
  constructor(message = '请求失败，请稍后重试') {
    super(message)
    this.name = 'AdminRequestError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isFiniteRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false
  try {
    return new Date(value).toISOString() === value
  } catch {
    return false
  }
}

function isDimensionArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && dimensions.has(item))
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
  return isRecord(value)
    && Array.isArray(value.graphTopics)
    && isNonEmptyString(value.label)
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
      && typeof summary.evidenceCount === 'number'
      && Number.isInteger(summary.evidenceCount)
      && summary.evidenceCount >= 0
      && typeof summary.mechanismCoverage === 'number'
      && Number.isInteger(summary.mechanismCoverage)
      && summary.mechanismCoverage >= 0
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

function safeServerMessage(body: unknown, fallback = '请求失败，请稍后重试'): string {
  if (!isRecord(body) || !isRecord(body.error)) return fallback
  const message = body.error.message
  return typeof message === 'string' && message.trim().length > 0 && message.length <= 120 && !/[\r\n]/.test(message)
    ? message
    : fallback
}

function errorMessage(response: Response, body: unknown, fallback?: string): string {
  const message = safeServerMessage(body, fallback)
  if (response.status !== 429) return message
  const retryAfter = response.headers.get('Retry-After')
  return retryAfter && /^\d{1,6}$/.test(retryAfter)
    ? `${message}（${retryAfter} 秒后可重试）`
    : message
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function adminRequest(path: string, init: RequestInit): Promise<unknown> {
  let response: Response
  try {
    const headers = new Headers(init.headers)
    if (usesEdgeApi) {
      const token = adminToken()
      if (!token) throw new AdminUnauthorizedError()
      headers.set('Authorization',`Bearer ${token}`)
    }
    response = await fetch(apiEndpoint(path), { ...init, ...(usesEdgeApi ? {headers} : {}), credentials: usesEdgeApi ? 'omit' : 'include' })
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) throw error
    throw new AdminRequestError()
  }
  if (response.status === 401) throw new AdminUnauthorizedError()
  if (response.status === 204 && response.ok) return undefined
  const body = await responseBody(response)
  if (!response.ok) throw new AdminRequestError(errorMessage(response, body))
  if (body === null) throw new AdminRequestError()
  return body
}

const jsonPost = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export async function login(username: string, password: string): Promise<void> {
  let response: Response
  try {
    response = await fetch(apiEndpoint('/api/admin/login'), {
      ...jsonPost({ username, password }),
      credentials: usesEdgeApi ? 'omit' : 'include',
    })
  } catch {
    throw new AdminRequestError()
  }
  if (response.ok) {
    if (usesEdgeApi) {
      const session = await responseBody(response)
      if (!isRecord(session) || typeof session.accessToken !== 'string' || typeof session.expiresAt !== 'number' || session.expiresAt*1000 <= Date.now()) throw new AdminRequestError()
      saveAdminSession({accessToken:session.accessToken,expiresAt:session.expiresAt})
    }
    return
  }
  const body = await responseBody(response)
  const fallback = response.status === 401 ? '用户名或密码错误' : undefined
  throw new AdminRequestError(errorMessage(response, body, fallback))
}

export async function logout(): Promise<void> {
  const result = await adminRequest('/api/admin/logout', jsonPost({}))
  if (result !== undefined) throw new AdminRequestError()
  if (usesEdgeApi) saveAdminSession(null)
}

function validatedListItem(value: unknown): AssessmentListItem | null {
  if (!isRecord(value)
    || typeof value.id !== 'string' || !UUID_PATTERN.test(value.id)
    || !isNonEmptyString(value.studentName)
    || typeof value.phoneMasked !== 'string' || !/^1\d{2}\*{4}\d{4}$/.test(value.phoneMasked)
    || !isNonEmptyString(value.grade)
    || !isIsoDate(value.completedAt)
    || typeof value.status !== 'string' || !statuses.has(value.status as AssessmentStatus)
    || !isPositiveInteger(value.reportRevision)) return null
  return {
    id: value.id,
    studentName: value.studentName,
    phoneMasked: value.phoneMasked,
    grade: value.grade,
    completedAt: value.completedAt,
    status: value.status as AssessmentStatus,
    reportRevision: value.reportRevision,
  }
}

function validatedList(value: unknown): AssessmentListResponse {
  if (!isRecord(value) || !Array.isArray(value.items)
    || typeof value.total !== 'number' || !Number.isInteger(value.total) || value.total < 0
    || !isPositiveInteger(value.page) || !isPositiveInteger(value.pageSize)) throw new AdminRequestError()
  const items = value.items.map(validatedListItem)
  if (items.some((item) => item === null)) throw new AdminRequestError()
  return { items: items as AssessmentListItem[], total: value.total, page: value.page, pageSize: value.pageSize }
}

export async function listAssessments(
  search: AssessmentSearch,
  page = 1,
  pageSize = 20,
): Promise<AssessmentListResponse> {
  let response: unknown
  if (search.kind === 'phone') {
    response = await adminRequest('/api/admin/assessments/search', jsonPost({ phone: search.phone, page, pageSize }))
  } else {
    const parameters = new URLSearchParams()
    if (search.kind === 'name') parameters.set('name', search.name)
    parameters.set('page', String(page))
    parameters.set('pageSize', String(pageSize))
    response = await adminRequest(`/api/admin/assessments?${parameters.toString()}`, { method: 'GET' })
  }
  return validatedList(response)
}

function validatedDetail(value: unknown, requestedId: string): AssessmentDetailResponse {
  if (!isRecord(value)
    || value.id !== requestedId || !UUID_PATTERN.test(requestedId)
    || !isRecord(value.student)
    || !isNonEmptyString(value.student.name)
    || typeof value.student.phone !== 'string' || !/^1\d{10}$/.test(value.student.phone)
    || typeof value.student.phoneMasked !== 'string' || !/^1\d{2}\*{4}\d{4}$/.test(value.student.phoneMasked)
    || !isNonEmptyString(value.student.grade)
    || typeof value.student.foreignLanguage !== 'string'
    || !Array.isArray(value.student.selectedSubjects) || !value.student.selectedSubjects.every(isNonEmptyString)
    || !isIsoDate(value.completedAt)
    || typeof value.status !== 'string' || !statuses.has(value.status as AssessmentStatus)
    || !isRecord(value.versions)
    || !isNonEmptyString(value.versions.bank) || !isNonEmptyString(value.versions.scoring) || !isNonEmptyString(value.versions.mapping)
    || !isReportModel(value.report)
    || !isIsoDate(value.reportGeneratedAt)
    || !isPositiveInteger(value.reportRevision)
    || !isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt)) throw new AdminRequestError(INVALID_REPORT_MESSAGE)
  return {
    id: value.id,
    student: {
      name: value.student.name,
      phone: value.student.phone,
      phoneMasked: value.student.phoneMasked,
      grade: value.student.grade,
      foreignLanguage: value.student.foreignLanguage,
      selectedSubjects: value.student.selectedSubjects,
    },
    completedAt: value.completedAt,
    status: value.status as AssessmentStatus,
    versions: { bank: value.versions.bank, scoring: value.versions.scoring, mapping: value.versions.mapping },
    report: value.report,
    reportGeneratedAt: value.reportGeneratedAt,
    reportRevision: value.reportRevision,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export async function getAssessment(id: string): Promise<AssessmentDetailResponse> {
  const response = await adminRequest(`/api/admin/assessments/${encodeURIComponent(id)}`, { method: 'GET' })
  return validatedDetail(response, id)
}

function validatedRegeneration(value: unknown, currentRevision: number): RegeneratedReportResponse {
  if (!isRecord(value)
    || !isReportModel(value.report)
    || !isIsoDate(value.reportGeneratedAt)
    || !isPositiveInteger(value.reportRevision)
    || value.reportRevision <= currentRevision) throw new AdminRequestError(INVALID_REPORT_MESSAGE)
  return { report: value.report, reportGeneratedAt: value.reportGeneratedAt, reportRevision: value.reportRevision }
}

export async function regenerateAssessment(id: string, currentRevision: number): Promise<RegeneratedReportResponse> {
  const response = await adminRequest(
    `/api/admin/assessments/${encodeURIComponent(id)}/regenerate`,
    jsonPost({}),
  )
  return validatedRegeneration(response, currentRevision)
}

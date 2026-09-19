import { LEGACY_BANK_VERSION, READABLE_BANK_VERSION } from '../src/lib/presentation-protocol'
import { assessmentTasksV16 } from '../src/data/assessment-bank-v1.6'
import { orderedV16Tasks } from '../src/data/meta-bank-v1.6'
import type { ForeignLanguage, Intake } from '../src/data/assessment-types'
import type { SubjectName } from '../src/data/subject-task-map'
import type { AssessmentSubmissionPayload } from '../src/lib/transport'
import {
  buildPrototypeReport,
  type ReportModel,
  type ScoredEvidence,
} from '../src/lib/assessment'

export type { AssessmentSubmissionPayload, AssessmentSubmissionResponse } from '../src/lib/transport'

export const ASSESSMENT_VERSIONS = {
  bank: READABLE_BANK_VERSION,
  scoring: '1.6-task-mean-1',
  mapping: '1.6-frozen-20260905',
} as const

const GRADES = new Set(['高一', '高二', '高三'])
const FOREIGN_LANGUAGES = new Set<ForeignLanguage>(['英语', '日语'])
const ELECTIVE_SUBJECTS = new Set<SubjectName>([
  '物理', '化学', '生物', '历史', '政治', '地理', '技术',
])

export type SubmissionIntake = Omit<Intake, 'foreignLanguage'> & {
  phone: string
  foreignLanguage: ForeignLanguage
}

export interface ScoredSubmission {
  evidence: ScoredEvidence[]
  report: ReportModel
  intake: SubmissionIntake
}

export class SubmissionValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SubmissionValidationError'
  }
}

export function normalizeAssessmentPhone(phone: string): string {
  const normalized = phone.replace(/\s/g, '')
  if (!/^1[3-9]\d{9}$/.test(normalized)) throw new Error('手机号格式不正确')
  return normalized
}

function invalid(message: string): never {
  throw new SubmissionValidationError(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function requireString(value: unknown, message: string): string {
  if (typeof value !== 'string') invalid(message)
  return value
}

function normalizedIntake(payload: Record<string, unknown>): SubmissionIntake {
  const name = requireString(payload.name, '请填写姓名').trim()
  if (!name) invalid('请填写姓名')
  if (name.length > 20) invalid('姓名或报告显示名请控制在20个字以内')

  const grade = requireString(payload.grade, '年级无效').trim()
  if (!GRADES.has(grade)) invalid('年级无效')

  const foreignLanguage = requireString(payload.foreignLanguage, '外语语种无效')
  if (!FOREIGN_LANGUAGES.has(foreignLanguage as ForeignLanguage)) invalid('外语语种无效')

  if (!Array.isArray(payload.selectedSubjects)) invalid('选考科目无效')
  const selectedSubjects = payload.selectedSubjects.map((subject) => {
    if (typeof subject !== 'string' || !ELECTIVE_SUBJECTS.has(subject as SubjectName)) invalid('选考科目无效')
    return subject as SubjectName
  })

  let phone: string
  try {
    phone = normalizeAssessmentPhone(requireString(payload.phone, '手机号格式不正确'))
  } catch (error) {
    invalid(error instanceof Error ? error.message : '手机号格式不正确')
  }

  return {
    name,
    phone,
    grade,
    foreignLanguage: foreignLanguage as ForeignLanguage,
    selectedSubjects: [...new Set(selectedSubjects)],
  }
}

function validateVersions(payload: Record<string, unknown>): void {
  if (payload.bankVersion !== ASSESSMENT_VERSIONS.bank && payload.bankVersion !== LEGACY_BANK_VERSION) invalid('题库版本不匹配')
  if (payload.scoringVersion !== ASSESSMENT_VERSIONS.scoring) invalid('评分版本不匹配')
  if (payload.mappingVersion !== ASSESSMENT_VERSIONS.mapping) invalid('映射版本不匹配')
}

function scoreResponse(value: unknown, index: number): ScoredEvidence {
  const task = assessmentTasksV16[index]
  const sourceTask = orderedV16Tasks[index]
  if (!task || !sourceTask || task.id !== sourceTask.id) throw new Error('服务端题库配置不一致')
  if (!isRecord(value)) invalid('作答不完整')
  if (value.position !== task.position) invalid('题目位置不匹配')
  if (!isRecord(value.response) || value.response.kind !== 'multi-choice') invalid('作答类型无效')
  if (!isRecord(value.response.answers)) invalid('作答不完整')

  const answers = value.response.answers
  const expectedKeys = sourceTask.items.map((_, itemIndex) => String(itemIndex))
  if (expectedKeys.some((key) => typeof answers[key] !== 'string')) invalid('作答不完整')
  if (Object.keys(answers).some((key) => !expectedKeys.includes(key))) invalid('选项无效')

  const diagnosticPoints = sourceTask.items.map((item, itemIndex) => {
    const answer = answers[String(itemIndex)]
    if (!item.options.some((option) => option.id === answer)) invalid('选项无效')
    return answer === item.correctAnswer ? 1 : 0
  })
  const durationMs = value.durationMs === undefined ? 0 : value.durationMs
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) invalid('作答时长无效')

  return {
    taskId: task.id,
    position: task.position,
    dimension: task.dimension,
    mechanism: task.mechanism,
    role: task.role,
    nodeScore: { earned: diagnosticPoints.reduce<number>((total, point) => total + point, 0) / diagnosticPoints.length, possible: 1 },
    diagnosticPoints,
    durationMs,
  }
}

export function scoreSubmission(payload: unknown): ScoredSubmission {
  if (!isRecord(payload)) invalid('提交内容无效')
  const intake = normalizedIntake(payload)
  validateVersions(payload)
  if (!Array.isArray(payload.responses) || payload.responses.length !== assessmentTasksV16.length) invalid('作答不完整')

  const evidence = payload.responses.map(scoreResponse)
  const reportSubjects = [...new Set<SubjectName>(['语文', '数学', intake.foreignLanguage, ...intake.selectedSubjects])]
  return { evidence, report: buildPrototypeReport(evidence, intake.foreignLanguage, reportSubjects), intake }
}

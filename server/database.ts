import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

export interface AssessmentVersions {
  bank: string
  scoring: string
  mapping: string
}

export interface CreateAssessmentInput {
  submissionId: string
  payloadHash: string
  studentName: string
  phoneEncrypted: string
  phoneLookupHash: string
  phoneMasked: string
  grade: string
  foreignLanguage: string
  selectedSubjects: string[]
  responses: unknown[]
  report: unknown
  versions: AssessmentVersions
  completedAt: string
  reportGeneratedAt?: string
  status?: AssessmentStatus
}

export type AssessmentStatus = 'submitted' | 'processing' | 'ready' | 'failed'

export interface FindAssessmentsQuery {
  page: number
  pageSize: number
  name?: string
  phoneLookupHash?: string
}

export interface AssessmentListItem {
  id: string
  studentName: string
  phoneMasked: string
  grade: string
  completedAt: string
  status: AssessmentStatus
  reportRevision: number
}

export interface AssessmentListResult {
  items: AssessmentListItem[]
  total: number
  page: number
  pageSize: number
}

export interface AssessmentDetail {
  id: string
  studentName: string
  phoneEncrypted: string
  phoneLookupHash: string
  phoneMasked: string
  grade: string
  foreignLanguage: string
  selectedSubjects: string[]
  responses: unknown[]
  report: unknown
  versions: AssessmentVersions
  completedAt: string
  reportGeneratedAt: string
  reportRevision: number
  status: AssessmentStatus
  createdAt: string
  updatedAt: string
}

export interface ReportSnapshot {
  report: unknown
  generatedAt: string
}

export interface ReplacedReportSnapshot {
  reportRevision: number
  reportGeneratedAt: string
  updatedAt: string
}

export interface AssessmentDatabase {
  createAssessment(input: CreateAssessmentInput): string
  createOrFindAssessment(input: CreateAssessmentInput): CreateOrFindAssessmentResult
  findAssessments(query: FindAssessmentsQuery): AssessmentListResult
  findAssessmentById(id: string): AssessmentDetail | undefined
  replaceReportSnapshot(id: string, snapshot: ReportSnapshot): boolean
  replaceReportSnapshotAtomically(
    id: string,
    snapshot: ReportSnapshot,
  ): ReplacedReportSnapshot | undefined
  close(): void
}

export interface CreateOrFindAssessmentResult {
  id: string
  created: boolean
  matchesPayload: boolean
  status: AssessmentStatus
}

interface ListRow {
  id: string
  student_name: string
  phone_masked: string
  grade: string
  completed_at: string
  status: AssessmentStatus
  report_revision: number
}

interface DetailRow extends ListRow {
  phone_encrypted: string
  phone_lookup_hash: string
  foreign_language: string
  selected_subjects_json: string
  responses_json: string
  report_json: string
  bank_version: string
  scoring_version: string
  mapping_version: string
  report_generated_at: string
  created_at: string
  updated_at: string
}

interface ReplacedReportRow {
  report_revision: number
  report_generated_at: string
  updated_at: string
}

interface SubmissionRow {
  id: string
  submission_payload_hash: string
  status: AssessmentStatus
}

function phoneMask(input: CreateAssessmentInput): string {
  if (!/^\d{3}\*{4}\d{4}$/.test(input.phoneMasked)) {
    throw new Error('手机号遮罩格式不正确')
  }
  return input.phoneMasked
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T
}

export function openDatabase(path: string): AssessmentDatabase {
  const fileBacked = path !== ':memory:' && !path.startsWith('file::memory:')
  if (fileBacked) mkdirSync(dirname(path), { recursive: true })

  const database = new DatabaseSync(path)
  database.exec('PRAGMA foreign_keys = ON')
  if (fileBacked) database.exec('PRAGMA journal_mode = WAL')

  database.exec(`
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      submission_id TEXT UNIQUE NOT NULL,
      submission_payload_hash TEXT NOT NULL,
      student_name TEXT NOT NULL,
      phone_encrypted TEXT NOT NULL,
      phone_lookup_hash TEXT NOT NULL,
      phone_masked TEXT NOT NULL,
      grade TEXT NOT NULL,
      foreign_language TEXT NOT NULL,
      selected_subjects_json TEXT NOT NULL,
      responses_json TEXT NOT NULL,
      report_json TEXT NOT NULL,
      bank_version TEXT NOT NULL,
      scoring_version TEXT NOT NULL,
      mapping_version TEXT NOT NULL,
      report_generated_at TEXT NOT NULL,
      report_revision INTEGER NOT NULL DEFAULT 1,
      completed_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('submitted', 'processing', 'ready', 'failed'))
    );
    CREATE INDEX IF NOT EXISTS assessments_completed_at_idx ON assessments (completed_at);
    CREATE INDEX IF NOT EXISTS assessments_student_name_idx ON assessments (student_name);
    CREATE INDEX IF NOT EXISTS assessments_phone_lookup_hash_idx ON assessments (phone_lookup_hash);
  `)

  const columns = database.prepare('PRAGMA table_info(assessments)').all() as unknown as Array<{ name: string }>
  if (!columns.some((column) => column.name === 'submission_id')) {
    database.exec('ALTER TABLE assessments ADD COLUMN submission_id TEXT')
  }
  if (!columns.some((column) => column.name === 'submission_payload_hash')) {
    database.exec('ALTER TABLE assessments ADD COLUMN submission_payload_hash TEXT')
  }
  database.exec('CREATE UNIQUE INDEX IF NOT EXISTS assessments_submission_id_idx ON assessments (submission_id)')

  const insertAssessment = database.prepare(`
    INSERT INTO assessments (
      id, submission_id, submission_payload_hash,
      student_name, phone_encrypted, phone_lookup_hash, phone_masked, grade,
      foreign_language, selected_subjects_json, responses_json, report_json,
      bank_version, scoring_version, mapping_version, report_generated_at,
      report_revision, completed_at, created_at, updated_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(submission_id) DO NOTHING
    RETURNING id
  `)

  const findById = database.prepare('SELECT * FROM assessments WHERE id = ?')
  const findBySubmissionId = database.prepare(
    'SELECT id, submission_payload_hash, status FROM assessments WHERE submission_id = ?',
  )
  const replaceSnapshot = database.prepare(`
    UPDATE assessments
    SET report_json = ?, report_generated_at = ?, report_revision = report_revision + 1, updated_at = ?
    WHERE id = ?
    RETURNING report_revision, report_generated_at, updated_at
  `)

  function replaceReportSnapshotAtomically(
    id: string,
    snapshot: ReportSnapshot,
  ): ReplacedReportSnapshot | undefined {
    const now = new Date().toISOString()
    const row = replaceSnapshot.get(
      JSON.stringify(snapshot.report),
      snapshot.generatedAt,
      now,
      id,
    ) as unknown as ReplacedReportRow | undefined
    if (!row) return undefined

    return {
      reportRevision: row.report_revision,
      reportGeneratedAt: row.report_generated_at,
      updatedAt: row.updated_at,
    }
  }

  function createOrFindAssessment(input: CreateAssessmentInput): CreateOrFindAssessmentResult {
    if (!input.submissionId.trim()) throw new Error('提交标识无效')
    if (!/^[0-9a-f]{64}$/i.test(input.payloadHash)) throw new Error('提交摘要无效')

    const id = randomUUID()
    const now = new Date().toISOString()
    const reportGeneratedAt = input.reportGeneratedAt ?? input.completedAt
    const status = input.status ?? 'ready'
    const inserted = insertAssessment.get(
      id,
      input.submissionId,
      input.payloadHash,
      input.studentName,
      input.phoneEncrypted,
      input.phoneLookupHash,
      phoneMask(input),
      input.grade,
      input.foreignLanguage,
      JSON.stringify(input.selectedSubjects),
      JSON.stringify(input.responses),
      JSON.stringify(input.report),
      input.versions.bank,
      input.versions.scoring,
      input.versions.mapping,
      reportGeneratedAt,
      1,
      input.completedAt,
      now,
      now,
      status,
    ) as unknown as { id: string } | undefined

    if (inserted) return { id: inserted.id, created: true, matchesPayload: true, status }

    const existing = findBySubmissionId.get(input.submissionId) as unknown as SubmissionRow | undefined
    if (!existing) throw new Error('提交记录冲突')
    return {
      id: existing.id,
      created: false,
      matchesPayload: existing.submission_payload_hash === input.payloadHash,
      status: existing.status,
    }
  }

  return {
    createAssessment(input) {
      const result = createOrFindAssessment(input)
      if (!result.created) throw new Error('提交标识重复')
      return result.id
    },

    createOrFindAssessment,

    findAssessments(query) {
      if (!Number.isInteger(query.page) || query.page < 1) throw new Error('页码无效')
      if (!Number.isInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100) {
        throw new Error('每页数量无效')
      }

      const conditions: string[] = []
      const parameters: string[] = []
      if (query.name?.trim()) {
        conditions.push("student_name LIKE '%' || ? || '%'")
        parameters.push(query.name.trim())
      }
      if (query.phoneLookupHash) {
        conditions.push('phone_lookup_hash = ?')
        parameters.push(query.phoneLookupHash)
      }

      const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''
      const count = database
        .prepare(`SELECT COUNT(*) AS total FROM assessments${where}`)
        .get(...parameters) as { total: number }
      const offset = (query.page - 1) * query.pageSize
      const rows = database
        .prepare(`
          SELECT id, student_name, phone_masked, grade, completed_at, status, report_revision
          FROM assessments${where}
          ORDER BY completed_at DESC, id DESC
          LIMIT ? OFFSET ?
        `)
        .all(...parameters, query.pageSize, offset) as unknown as ListRow[]

      return {
        items: rows.map((row) => ({
          id: row.id,
          studentName: row.student_name,
          phoneMasked: row.phone_masked,
          grade: row.grade,
          completedAt: row.completed_at,
          status: row.status,
          reportRevision: row.report_revision,
        })),
        total: count.total,
        page: query.page,
        pageSize: query.pageSize,
      }
    },

    findAssessmentById(id) {
      const row = findById.get(id) as unknown as DetailRow | undefined
      if (!row) return undefined

      return {
        id: row.id,
        studentName: row.student_name,
        phoneEncrypted: row.phone_encrypted,
        phoneLookupHash: row.phone_lookup_hash,
        phoneMasked: row.phone_masked,
        grade: row.grade,
        foreignLanguage: row.foreign_language,
        selectedSubjects: parseJson<string[]>(row.selected_subjects_json),
        responses: parseJson<unknown[]>(row.responses_json),
        report: parseJson<unknown>(row.report_json),
        versions: {
          bank: row.bank_version,
          scoring: row.scoring_version,
          mapping: row.mapping_version,
        },
        completedAt: row.completed_at,
        reportGeneratedAt: row.report_generated_at,
        reportRevision: row.report_revision,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    },

    replaceReportSnapshot(id, snapshot) {
      return replaceReportSnapshotAtomically(id, snapshot) !== undefined
    },

    replaceReportSnapshotAtomically,

    close() {
      database.close()
    },
  }
}

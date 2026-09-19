import type { ReportModel } from '../lib/assessment'

export type AssessmentStatus = 'submitted' | 'processing' | 'ready' | 'failed'

export interface AssessmentListItem {
  id: string
  studentName: string
  phoneMasked: string
  grade: string
  completedAt: string
  status: AssessmentStatus
  reportRevision: number
}

export interface AssessmentListResponse {
  items: AssessmentListItem[]
  total: number
  page: number
  pageSize: number
}

export interface AssessmentDetailResponse {
  id: string
  student: {
    name: string
    phone: string
    phoneMasked: string
    grade: string
    foreignLanguage: string
    selectedSubjects: string[]
  }
  completedAt: string
  status: AssessmentStatus
  versions: { bank: string; scoring: string; mapping: string }
  report: ReportModel
  reportGeneratedAt: string
  reportRevision: number
  createdAt: string
  updatedAt: string
}

export interface RegeneratedReportResponse {
  report: ReportModel
  reportGeneratedAt: string
  reportRevision: number
}

export type AssessmentSearch =
  | { kind: 'all' }
  | { kind: 'name'; name: string }
  | { kind: 'phone'; phone: string }

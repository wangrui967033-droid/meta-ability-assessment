import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { openDatabase, type AssessmentDatabase } from './database'

describe('assessment repository', () => {
  let db: AssessmentDatabase | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  it('creates assessments and finds safe list and detailed records', () => {
    db = openDatabase(':memory:')
    const iso = '2026-09-10T08:00:00.000Z'
    const id = db.createAssessment({
      submissionId: '0198f52c-7e11-7000-8000-000000000001',
      payloadHash: 'a'.repeat(64),
      studentName: '王同学',
      phoneEncrypted: 'encrypted',
      phoneLookupHash: 'hash',
      phoneMasked: '138****8000',
      grade: '高三',
      foreignLanguage: '英语',
      selectedSubjects: ['物理'],
      responses: [{ position: 1 }],
      report: { conclusion: 'test' },
      versions: { bank: '1.6', scoring: '1.6', mapping: '1.6' },
      completedAt: iso,
    })

    expect(db.findAssessments({ page: 1, pageSize: 20, name: '王' }).items[0]).toMatchObject({
      id,
      studentName: '王同学',
      phoneMasked: '138****8000',
    })
    expect(db.findAssessments({ page: 1, pageSize: 20, phoneLookupHash: 'hash' }).total).toBe(1)
    expect(db.findAssessmentById(id)?.responses).toEqual([{ position: 1 }])
    expect(db.findAssessments({ page: 1, pageSize: 20 }).items[0]).not.toHaveProperty(
      'phoneEncrypted',
    )
  })

  it('replaces only the report snapshot and increments its revision', () => {
    db = openDatabase(':memory:')
    const id = db.createAssessment({
      submissionId: '0198f52c-7e11-7000-8000-000000000002',
      payloadHash: 'b'.repeat(64),
      studentName: '王同学',
      phoneEncrypted: 'encrypted',
      phoneLookupHash: 'hash',
      phoneMasked: '138****8000',
      grade: '高三',
      foreignLanguage: '英语',
      selectedSubjects: ['物理'],
      responses: [{ position: 1 }],
      report: { conclusion: 'old' },
      versions: { bank: '1.6', scoring: '1.6', mapping: '1.6' },
      completedAt: '2026-09-10T08:00:00.000Z',
    })

    expect(
      db.replaceReportSnapshot(id, {
        report: { conclusion: 'new' },
        generatedAt: '2026-09-10T09:00:00.000Z',
      }),
    ).toBe(true)
    expect(db.findAssessmentById(id)).toMatchObject({
      report: { conclusion: 'new' },
      reportRevision: 2,
      reportGeneratedAt: '2026-09-10T09:00:00.000Z',
      responses: [{ position: 1 }],
      versions: { bank: '1.6', scoring: '1.6', mapping: '1.6' },
    })
  })

  it('atomically returns the existing record only for the same submission payload', () => {
    db = openDatabase(':memory:')
    const input = {
      submissionId: '0198f52c-7e11-7000-8000-000000000003',
      payloadHash: 'c'.repeat(64),
      studentName: '王同学',
      phoneEncrypted: 'encrypted',
      phoneLookupHash: 'hash',
      phoneMasked: '138****8000',
      grade: '高三',
      foreignLanguage: '英语',
      selectedSubjects: ['物理'],
      responses: [{ position: 1 }],
      report: { conclusion: 'test' },
      versions: { bank: '1.6', scoring: '1.6', mapping: '1.6' },
      completedAt: '2026-09-10T08:00:00.000Z',
    }

    const created = db.createOrFindAssessment(input)
    const duplicate = db.createOrFindAssessment(input)
    const collision = db.createOrFindAssessment({ ...input, payloadHash: 'd'.repeat(64) })

    expect(created).toMatchObject({ created: true, matchesPayload: true })
    expect(duplicate).toEqual({ id: created.id, created: false, matchesPayload: true, status: 'ready' })
    expect(collision).toEqual({ id: created.id, created: false, matchesPayload: false, status: 'ready' })
    expect(db.findAssessments({ page: 1, pageSize: 10 }).total).toBe(1)
  })

  it('creates parent directories for a file-backed database', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'assessment-database-'))
    const databasePath = join(temporaryRoot, 'nested', 'assessments.sqlite')

    try {
      db = openDatabase(databasePath)
      expect(existsSync(databasePath)).toBe(true)
    } finally {
      db?.close()
      db = undefined
      rmSync(temporaryRoot, { recursive: true, force: true })
    }
  })
})

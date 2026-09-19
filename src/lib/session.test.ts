import { describe, expect, it } from 'vitest'
import { createSessionSnapshot, parseSessionSnapshot, saveSession, SESSION_SCHEMA_VERSION, SESSION_STORAGE_KEY } from './session'

describe('assessment session storage', () => {
  it('creates a current empty session snapshot', () => {
    const snapshot = createSessionSnapshot()

    expect(snapshot.schemaVersion).toBe(SESSION_SCHEMA_VERSION)
    expect(snapshot.currentPosition).toBe(1)
    expect(snapshot.responses).toEqual([])
  })

  it('restores only snapshots with the current schema version', () => {
    expect(parseSessionSnapshot('{"schemaVersion":0}')).toBeNull()
    expect(parseSessionSnapshot(JSON.stringify(createSessionSnapshot()))?.schemaVersion).toBe(SESSION_SCHEMA_VERSION)
  })

  it('persists resumable state without writing the phone or scored evidence', () => {
    const snapshot = createSessionSnapshot()
    snapshot.intake.phone = '138 0013 8000'
    snapshot.submission = { status: 'failed', error: '尚未提交，可重试' }
    snapshot.responses = [{
      position: 1,
      response: { kind: 'multi-choice', answers: { 0: 'A' } },
      evidence: { taskId: 'legacy', position: 1, dimension: 'memory', mechanism: '快速记住', role: 'direct', nodeScore: { earned: 1, possible: 1 }, diagnosticPoints: [1], durationMs: 10 },
      submittedAt: '2026-09-10T08:00:00.000Z',
    }]

    expect(saveSession(snapshot)).toBe(true)

    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    expect(raw).not.toContain('138 0013 8000')
    expect(raw).not.toContain('evidence')
    const restored = parseSessionSnapshot(raw)
    expect(restored?.intake.phone).toBe('')
    expect(restored?.responses[0].evidence).toBeUndefined()
    expect(restored?.submission).toEqual({ status: 'failed', error: '尚未提交，可重试' })
  })

  it('migrates an in-progress schema-10 session without losing raw progress', () => {
    const legacy = createSessionSnapshot() as unknown as Record<string, unknown>
    legacy.schemaVersion = 10
    delete legacy.submission
    legacy.currentPosition = 18
    legacy.screen = 'tasks'
    legacy.intake = { name: '林晓', phone: '13800138000', grade: '高二', foreignLanguage: '英语', selectedSubjects: ['物理'] }
    legacy.responses = [{
      position: 17,
      response: { kind: 'multi-choice', answers: { 0: 'B' } },
      evidence: { nodeScore: { earned: 1, possible: 1 } },
      submittedAt: '2026-09-10T08:00:00.000Z',
    }]

    const restored = parseSessionSnapshot(JSON.stringify(legacy))

    expect(restored).toMatchObject({ schemaVersion: SESSION_SCHEMA_VERSION, currentPosition: 18, screen: 'tasks' })
    expect(restored?.intake).toEqual({ name: '林晓', phone: '', grade: '高二', foreignLanguage: '英语', selectedSubjects: ['物理'] })
    expect(restored?.responses).toEqual([{ position: 17, response: { kind: 'multi-choice', answers: { 0: 'B' } }, submittedAt: '2026-09-10T08:00:00.000Z' }])
    expect(restored?.submission).toEqual({ status: 'idle' })
  })

  it.each(['idle', 'submitting'] as const)('recovers processing + %s as a retryable session', (status) => {
    const snapshot = createSessionSnapshot()
    snapshot.screen = 'processing'
    snapshot.currentPosition = 31
    snapshot.submission = { status }

    expect(parseSessionSnapshot(JSON.stringify(snapshot))?.submission).toMatchObject({ status: 'failed' })
  })
})

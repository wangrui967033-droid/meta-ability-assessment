import { describe, expect, it } from 'vitest'
import { createSessionSnapshot, parseSessionSnapshot, SESSION_SCHEMA_VERSION } from './session'

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
})

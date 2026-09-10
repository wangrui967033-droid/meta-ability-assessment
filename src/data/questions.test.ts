import { describe, expect, it } from 'vitest'
import { assessmentTasks, deckA, deckB, validateAssessmentBank } from './assessment-bank'

describe('assessment question bank', () => {
  it('locks the 30-node blueprint distribution and the revised positions 06 and 08', () => {
    expect(assessmentTasks).toHaveLength(30)
    expect(assessmentTasks.filter((task) => task.role === 'direct')).toHaveLength(17)
    expect(assessmentTasks.filter((task) => task.role === 'cross-representation')).toHaveLength(8)
    expect(assessmentTasks.filter((task) => task.role === 'cross-context')).toHaveLength(5)
    expect(assessmentTasks.find((task) => task.position === 6)?.id).toBe('IN-RL-01R2')
    expect(assessmentTasks.find((task) => task.position === 8)?.id).toBe('SP-IM-08-NEW-01')
  })

  it('gives each primary ability six tasks and each mechanism two tasks', () => {
    for (const dimension of ['memory', 'language', 'quantitative', 'space', 'reasoning']) {
      expect(assessmentTasks.filter((task) => task.dimension === dimension)).toHaveLength(6)
    }

    const mechanismCounts = new Map<string, number>()
    assessmentTasks.forEach((task) => mechanismCounts.set(task.mechanism, (mechanismCounts.get(task.mechanism) ?? 0) + 1))
    expect(mechanismCounts).toHaveLength(15)
    expect([...mechanismCounts.values()]).toEqual(Array.from({ length: 15 }, () => 2))
  })

  it('keeps both decks at six mutually isolated items', () => {
    expect(deckA).toHaveLength(6)
    expect(deckB).toHaveLength(6)
    expect(new Set([...deckA, ...deckB].map((item) => item.id)).size).toBe(12)
  })

  it('accepts the fixed blueprint without exposing answer data', () => {
    expect(validateAssessmentBank(assessmentTasks)).toEqual([])
    expect(assessmentTasks.every((task) => !('answer' in task))).toBe(true)
  })
})

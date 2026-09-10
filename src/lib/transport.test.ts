import { describe, expect, it } from 'vitest'
import { assessmentTasks } from '../data/assessment-bank'
import { assessmentTasksV16 } from '../data/assessment-bank-v1.6'
import { LocalPrototypeAdapter } from './transport'

describe('prototype transport', () => {
  it('rejects missing and invalid answers instead of manufacturing zero-score evidence', async () => {
    const adapter = new LocalPrototypeAdapter()
    for (const answers of [{}, {0:'INVALID',1:'A',2:'C'}] as Record<string,string>[]) {
      await expect(adapter.submit({task:assessmentTasksV16[0],response:{kind:'multi-choice',answers},durationMs:1000})).rejects.toThrow()
    }
  })
  it('folds V1.6 internal answers into one point without losing diagnostics', async () => {
    const task = assessmentTasksV16[0]
    const score = await new LocalPrototypeAdapter().submit({
      task,
      response: { kind: 'multi-choice', answers: { 0: 'A', 1: 'A', 2: 'C' } },
      durationMs: 650,
    })

    expect(score.nodeScore.possible).toBe(1)
    expect(score.nodeScore.earned).toBeCloseTo(2 / 3)
    expect(score.diagnosticPoints).toEqual([1, 0, 1])
    expect(score.durationMs).toBe(650)
  })
  it('rejects retired task banks', async () => {
    await expect(new LocalPrototypeAdapter().submit({task: assessmentTasks[0], response: {kind: 'choice', selectedId: 'A'}, durationMs: 100})).rejects.toThrow('题库版本不匹配')
  })
})

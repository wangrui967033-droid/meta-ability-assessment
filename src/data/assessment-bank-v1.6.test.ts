import { describe, expect, it } from 'vitest'
import { assessmentTasksV16 } from './assessment-bank-v1.6'

describe('assessment bank V1.6 app adapter', () => {
  it('projects all 30 audited tasks in the designed order', () => {
    expect(assessmentTasksV16).toHaveLength(30)
    expect(assessmentTasksV16.map((task) => task.id).slice(0, 6)).toEqual([
      'M01-v16', 'L01-v16', 'N01-v16', 'S01-v16', 'R01-v16', 'M02-v16',
    ])
    expect(assessmentTasksV16.every((task) => task.interaction.type === 'multi-choice')).toBe(true)
    expect(assessmentTasksV16.find((task) => task.id === 'R04-v16')?.difficulty).toBe('challenge')
    for (const code of ['N01', 'N02', 'S01', 'S03', 'S04', 'S05', 'S06']) {
      const task = assessmentTasksV16.find((entry) => entry.code === code)
      expect(task?.interaction.type).toBe('multi-choice')
      if (task?.interaction.type === 'multi-choice') {
        expect(task.interaction.items.every((item) => Boolean(item.asset))).toBe(true)
      }
    }
  })
})

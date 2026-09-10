import { describe, expect, it } from 'vitest'
import { assessmentTasksV15 } from './assessment-bank-v1.5'

describe('assessment bank V1.5 app adapter', () => {
  it('projects the frozen bank without changing sequence or item counts', () => {
    expect(assessmentTasksV15).toHaveLength(30)
    expect(assessmentTasksV15.map((task) => task.id).slice(0, 4)).toEqual(['M01-v5', 'M02-v5', 'L01-v5', 'N01-v5'])
    expect(assessmentTasksV15.every((task) => task.interaction.type === 'multi-choice')).toBe(true)
    expect(assessmentTasksV15.reduce((total, task) => total + (task.interaction.type === 'multi-choice' ? task.interaction.items.length : 0), 0)).toBe(84)
  })
})

import { describe, expect, it } from 'vitest'
import { subjectTaskMap, taskMapForStudent, tasksForSubject } from './subject-task-map'

describe('knowledge-graph subject task map', () => {
  it('keeps every task as a complete five-ability profile', () => {
    for (const task of subjectTaskMap) {
      const total = Object.values(task.abilityWeights).reduce((sum, value) => sum + value, 0)
      expect(total).toBeCloseTo(1)
      expect(task.knowledgeNodes.length).toBeGreaterThanOrEqual(2)
      expect(task.mechanisms.length).toBeGreaterThanOrEqual(3)
      expect(task.startWith.length).toBeGreaterThan(12)
    }
  })

  it('uses exactly one foreign-language map for each student and keeps all ten subjects', () => {
    const englishSubjects = new Set(taskMapForStudent('英语').map((task) => task.subject))
    const japaneseSubjects = new Set(taskMapForStudent('日语').map((task) => task.subject))

    expect(englishSubjects).toHaveLength(10)
    expect(englishSubjects).toContain('英语')
    expect(englishSubjects).not.toContain('日语')
    expect(japaneseSubjects).toHaveLength(10)
    expect(japaneseSubjects).toContain('日语')
    expect(japaneseSubjects).not.toContain('英语')
  })

  it('contains graph-backed physics tasks, including the major problem types', () => {
    const labels = tasksForSubject('物理', '英语').map((task) => task.taskLabel).join('｜')
    expect(labels).toMatch(/运动图像/)
    expect(labels).toMatch(/受力分析/)
    expect(labels).toMatch(/能量、动量/)
    expect(labels).toMatch(/电场、电路/)
    expect(labels).toMatch(/实验/)
  })
})

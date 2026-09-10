import { describe, expect, it } from 'vitest'
import { assessmentTasksV16 } from '../data/assessment-bank-v1.6'
import { orderedV16Tasks } from '../data/meta-bank-v1.6'
import { buildPrototypeReport } from './assessment'
import { LocalPrototypeAdapter } from './transport'

describe('V1.6 assessment to report integration', () => {
  it('turns all 30 frozen task responses into five abilities, fifteen observations and report plans', async () => {
    const adapter = new LocalPrototypeAdapter()
    const evidence = await Promise.all(assessmentTasksV16.map((task, taskIndex) => {
      const bankTask = orderedV16Tasks[taskIndex]
      return adapter.submit({
        task,
        response: {
          kind: 'multi-choice',
          answers: Object.fromEntries(bankTask.items.map((item, itemIndex) => [String(itemIndex), item.correctAnswer])),
        },
        durationMs: task.expectedSeconds * 1_000,
      })
    }))
    const report = buildPrototypeReport(evidence, '英语', ['语文', '数学', '英语', '物理', '化学', '生物'])

    expect(evidence).toHaveLength(30)
    expect(evidence.reduce((total, item) => total + item.diagnosticPoints.length, 0)).toBe(orderedV16Tasks.reduce((sum, task) => sum + task.items.length, 0))
    expect(report.dimensionSummary).toHaveLength(5)
    expect(report.dimensionSummary.every((dimension) => dimension.evidenceCount === 6)).toBe(true)
    expect(report.mechanismSummary).toHaveLength(15)
    // Full marks in all five groups should keep all five equally available.
    expect(report.advantageDimensions).toHaveLength(0)
    expect(report.relativeDimensions).toHaveLength(5)
    expect(report.subjectOpportunityPlan).toHaveLength(6)
    expect(report.subjectTaskPlan).toHaveLength(6)
  })
})

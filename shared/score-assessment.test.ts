import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'

import { orderedV16Tasks } from '../src/data/meta-bank-v1.6'
import { ASSESSMENT_VERSIONS, scoreSubmission } from './score-assessment'
import { LEGACY_BANK_VERSION, READABLE_BANK_VERSION } from '../src/lib/presentation-protocol'

function validSubmissionPayload() {
  return {
    submissionId: randomUUID(),
    name: ' 王同学 ',
    phone: ' 138 0013 8000 ',
    grade: '高三',
    foreignLanguage: '英语',
    selectedSubjects: ['物理'],
    ...ASSESSMENT_VERSIONS,
    bankVersion: ASSESSMENT_VERSIONS.bank,
    scoringVersion: ASSESSMENT_VERSIONS.scoring,
    mappingVersion: ASSESSMENT_VERSIONS.mapping,
    responses: orderedV16Tasks.map((task) => ({
      position: task.position,
      response: { kind: 'multi-choice', answers: Object.fromEntries(task.items.map((item, index) => [String(index), item.correctAnswer])) },
      durationMs: task.expectedSeconds * 1000,
    })),
  }
}

describe('shared scoreSubmission', () => {
  it('produces identical scores and reports for the same answers under both display versions', () => {
    const payload = validSubmissionPayload()
    payload.responses.forEach((response, index) => {
      const task = orderedV16Tasks[index]
      response.response.answers['0'] = task.items[0].options.find(option => option.id !== task.items[0].correctAnswer)!.id
    })
    expect(scoreSubmission({ ...payload, bankVersion: READABLE_BANK_VERSION }))
      .toEqual(scoreSubmission({ ...payload, bankVersion: LEGACY_BANK_VERSION }))
  })
  it('scores a valid complete V1.6 payload without Node runtime helpers', () => {
    const result = scoreSubmission(validSubmissionPayload())
    expect(result.report.dimensionSummary).toHaveLength(5)
    expect(result.intake.phone).toBe('13800138000')
    expect(ASSESSMENT_VERSIONS.bank).toMatch(/^1\.6-/)
  })
})

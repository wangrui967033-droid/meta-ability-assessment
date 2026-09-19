// @vitest-environment node

import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'

import { assessmentTasksV16 } from '../data/assessment-bank-v1.6'
import { orderedV16Tasks } from '../data/meta-bank-v1.6'
import type { Dimension } from '../data/assessment-types'
import type { ReportModel } from './assessment'
import type { SubjectOpportunityTier } from './subject-advantage'

const dimensions: Dimension[] = ['memory', 'language', 'quantitative', 'space', 'reasoning']
const subjects = ['语文', '数学', '英语', '物理', '化学', '生物']
const scorerModulePath: string = '../../server/score-assessment'
let scoreSubmission: (payload: unknown) => { evidence: unknown[]; report: ReportModel }
let assessmentVersions: { bank: string; scoring: string; mapping: string }

interface ScoreRangeCase {
  band: number
  label: string
  correctByDimension: number[]
  tiers: SubjectOpportunityTier[]
}

const development = Array<SubjectOpportunityTier>(6).fill('待发展区')
const fullSupport = Array<SubjectOpportunityTier>(6).fill('优势发挥区')
const quantitativeReasoning = [
  '待发展区', '优势发挥区', '待发展区',
  '优势发挥区', '待发展区', '待发展区',
] as SubjectOpportunityTier[]
const languageMemory = [
  '待发展区', '待发展区', '优势发挥区',
  '待发展区', '待发展区', '待发展区',
] as SubjectOpportunityTier[]

const cases: ScoreRangeCase[] = [
  { band: 300, label: '均衡练习型', correctByDimension: [5, 5, 5, 5, 5], tiers: development },
  { band: 300, label: '推演突出型', correctByDimension: [4, 5, 4, 5, 10], tiers: development },
  { band: 300, label: '语言记忆突出型', correctByDimension: [9, 9, 3, 4, 5], tiers: languageMemory },
  { band: 350, label: '均衡练习型', correctByDimension: [6, 6, 6, 6, 6], tiers: development },
  { band: 350, label: '数理推演突出型', correctByDimension: [5, 5, 9, 5, 9], tiers: quantitativeReasoning },
  { band: 350, label: '空间突出型', correctByDimension: [5, 6, 5, 10, 6], tiers: development },
  { band: 400, label: '均衡练习型', correctByDimension: [8, 8, 8, 8, 8], tiers: development },
  { band: 400, label: '数理推演突出型', correctByDimension: [6, 6, 10, 7, 10], tiers: quantitativeReasoning },
  { band: 400, label: '语言记忆突出型', correctByDimension: [10, 10, 6, 6, 7], tiers: languageMemory },
  { band: 450, label: '均衡支持型', correctByDimension: [9, 9, 9, 9, 9], tiers: fullSupport },
  { band: 450, label: '数理推演突出型', correctByDimension: [7, 7, 11, 8, 11], tiers: quantitativeReasoning },
  { band: 450, label: '语言记忆突出型', correctByDimension: [11, 11, 7, 7, 8], tiers: languageMemory },
  { band: 500, label: '均衡支持型', correctByDimension: [10, 10, 10, 10, 10], tiers: fullSupport },
  { band: 500, label: '数理推演突出型', correctByDimension: [8, 8, 12, 8, 12], tiers: quantitativeReasoning },
  { band: 500, label: '语言记忆突出型', correctByDimension: [12, 12, 8, 8, 8], tiers: languageMemory },
]

const itemTotals = Object.fromEntries(
  dimensions.map((dimension) => [
    dimension,
    orderedV16Tasks.reduce(
      (total, task, index) =>
        total + (assessmentTasksV16[index].dimension === dimension ? task.items.length : 0),
      0,
    ),
  ]),
) as Record<Dimension, number>

function submissionFor(testCase: ScoreRangeCase) {
  const seen = Object.fromEntries(dimensions.map((dimension) => [dimension, 0])) as Record<Dimension, number>
  return {
    submissionId: randomUUID(),
    name: `合成样例｜${testCase.band}分｜${testCase.label}`,
    phone: '13800138000',
    grade: '高三',
    foreignLanguage: '英语',
    selectedSubjects: ['物理', '化学', '生物'],
    bankVersion: assessmentVersions.bank,
    scoringVersion: assessmentVersions.scoring,
    mappingVersion: assessmentVersions.mapping,
    responses: orderedV16Tasks.map((task, taskIndex) => {
      const assessmentTask = assessmentTasksV16[taskIndex]
      const dimension = assessmentTask.dimension
      const target = Math.round(
        testCase.correctByDimension[dimensions.indexOf(dimension)] / 12 * itemTotals[dimension],
      )
      return {
        position: task.position,
        response: {
          kind: 'multi-choice' as const,
          answers: Object.fromEntries(task.items.map((item, itemIndex) => {
            const correct = seen[dimension]++ < target
            const answer = correct
              ? item.correctAnswer
              : item.options.find((option) => option.id !== item.correctAnswer)?.id
            if (!answer) throw new Error(`题目 ${task.id} 缺少可用干扰项`)
            return [String(itemIndex), answer]
          })),
        },
        durationMs: 18_000,
        submittedAt: '2026-09-10T08:00:00.000Z',
      }
    }),
  }
}

describe('server score-range simulation', () => {
  beforeAll(async () => {
    const scorer = await import(/* @vite-ignore */ scorerModulePath)
    scoreSubmission = scorer.scoreSubmission
    assessmentVersions = scorer.ASSESSMENT_VERSIONS
  })

  it.each(cases)('$band分 $label retains the reviewed subject classifications', (testCase) => {
    const result = scoreSubmission(submissionFor(testCase))

    expect(result.evidence).toHaveLength(assessmentTasksV16.length)
    expect(result.report.dimensionSummary).toHaveLength(5)
    expect(result.report.subjectOpportunityPlan.map((subject) => subject.subject)).toEqual(subjects)
    expect(result.report.subjectOpportunityPlan.map((subject) => subject.tier)).toEqual(testCase.tiers)
  })
})

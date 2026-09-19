import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'

import { assessmentTasksV16 } from '../src/data/assessment-bank-v1.6'
import { orderedV16Tasks } from '../src/data/meta-bank-v1.6'
import { scoreSubmission, type AssessmentSubmissionPayload } from './score-assessment'

function validPayload(): AssessmentSubmissionPayload {
  return {
    submissionId: randomUUID(),
    name: ' 王同学 ',
    phone: ' 138 0013 8000 ',
    grade: '高三',
    foreignLanguage: '英语',
    selectedSubjects: ['物理', '化学'],
    bankVersion: '1.6-student-8s-20260907',
    scoringVersion: '1.6-task-mean-1',
    mappingVersion: '1.6-frozen-20260905',
    responses: orderedV16Tasks.map((task) => ({
      position: task.position,
      response: {
        kind: 'multi-choice',
        answers: Object.fromEntries(
          task.items.map((item, index) => [String(index), item.correctAnswer]),
        ),
      },
      durationMs: task.expectedSeconds * 1_000,
      submittedAt: '2026-09-10T08:00:00.000Z',
    })),
  }
}

describe('scoreSubmission', () => {
  it('scores the complete V1.6 bank and normalizes student intake', () => {
    const result = scoreSubmission(validPayload())

    expect(result.evidence).toHaveLength(assessmentTasksV16.length)
    expect(result.evidence.every((item) => item.nodeScore.earned === 1)).toBe(true)
    expect(result.report.dimensionSummary).toHaveLength(5)
    expect(result.report.subjects.map((item) => item.subject)).toEqual([
      '语文',
      '数学',
      '英语',
      '物理',
      '化学',
    ])
    expect(result.intake).toEqual({
      name: '王同学',
      phone: '13800138000',
      grade: '高三',
      foreignLanguage: '英语',
      selectedSubjects: ['物理', '化学'],
    })
  })

  it('rejects an incomplete positional response set', () => {
    const payload = validPayload()

    expect(() =>
      scoreSubmission({ ...payload, responses: payload.responses.slice(1) }),
    ).toThrow('作答不完整')
    expect(() =>
      scoreSubmission({
        ...payload,
        responses: payload.responses.map((item, index) =>
          index === 0 ? { ...item, position: 2 } : item,
        ),
      }),
    ).toThrow('题目位置不匹配')
  })

  it('rejects an answer whose option does not exist in the authoritative task', () => {
    const payload = validPayload()

    expect(() =>
      scoreSubmission({
        ...payload,
        responses: [
          {
            ...payload.responses[0],
            response: {
              kind: 'multi-choice',
              answers: { '0': 'not-an-option', '1': 'A', '2': 'C' },
            },
          },
          ...payload.responses.slice(1),
        ],
      }),
    ).toThrow('选项无效')
  })

  it('uses only authoritative answers and ignores client-supplied scoring fields', () => {
    const payload = validPayload()
    const first = orderedV16Tasks[0]
    const correct = first.items[0].correctAnswer
    const wrong = first.items[0].options.find((option) => option.id !== correct)?.id
    if (!wrong) throw new Error('测试题缺少错误选项')

    const result = scoreSubmission({
      ...payload,
      report: { conclusion: '客户端伪造报告' },
      classification: 'forged',
      responses: payload.responses.map((item, index) =>
        index === 0
          ? {
              ...item,
              evidence: { nodeScore: { earned: 1_000, possible: 1 } },
              response: {
                kind: 'multi-choice',
                answers: { ...item.response.answers, '0': wrong },
              },
            }
          : item,
      ),
    })

    expect(result.evidence[0].nodeScore.earned).toBeCloseTo(2 / 3)
    expect(result.evidence[0].diagnosticPoints).toEqual([0, 1, 1])
    expect(result.report.conclusion).not.toContain('客户端伪造报告')
  })

  it.each([
    ['name', { name: ' '.repeat(3) }, '请填写姓名'],
    ['grade', { grade: '初三' }, '年级无效'],
    ['foreign language', { foreignLanguage: '法语' }, '外语语种无效'],
    ['selected subjects', { selectedSubjects: ['物理', '英语'] }, '选考科目无效'],
    ['phone', { phone: '1' }, '手机号格式不正确'],
    ['bank version', { bankVersion: '1.5' }, '题库版本不匹配'],
    ['scoring version', { scoringVersion: 'old' }, '评分版本不匹配'],
    ['mapping version', { mappingVersion: 'old' }, '映射版本不匹配'],
  ])('rejects invalid %s', (_label, override, message) => {
    expect(() => scoreSubmission({ ...validPayload(), ...override })).toThrow(message)
  })
})

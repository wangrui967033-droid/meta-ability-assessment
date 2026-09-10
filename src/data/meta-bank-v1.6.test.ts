import { describe, expect, it } from 'vitest'
import { META_BANK_V16, orderedV16Tasks } from './meta-bank-v1.6'
import { questionAssetUrl } from './question-assets'

const abilities = ['记忆', '语言', '数理', '空间', '推演'] as const
const mechanisms = [
  '快速记住', '保持信息', '准确提取',
  '理解意思', '组织信息', '准确表达',
  '感知数量', '理解变化', '处理符号',
  '识别结构', '空间想象', '空间转换',
  '发现关系', '归纳规律', '推出结论',
]

describe('V1.6 assessment bank', () => {
  it('contains the fixed 30-by-5-by-15 coverage', () => {
    expect(orderedV16Tasks).toHaveLength(30)
    expect(new Set(orderedV16Tasks.map((task) => task.id)).size).toBe(30)
    for (const ability of abilities) {
      expect(orderedV16Tasks.filter((task) => task.primaryAbility === ability)).toHaveLength(6)
    }
    for (const mechanism of mechanisms) {
      expect(orderedV16Tasks.filter((task) => task.mechanism === mechanism)).toHaveLength(2)
    }
  })

  it('uses 2 easy, 3 medium and 1 challenge task per ability', () => {
    for (const ability of abilities) {
      const tasks = orderedV16Tasks.filter((task) => task.primaryAbility === ability)
      expect(tasks.filter((task) => task.difficulty === 'easy')).toHaveLength(2)
      expect(tasks.filter((task) => task.difficulty === 'medium')).toHaveLength(3)
      expect(tasks.filter((task) => task.difficulty === 'challenge')).toHaveLength(1)
    }
  })

  it('fully annotates every real item and every distractor', () => {
    for (const task of orderedV16Tasks) {
      expect(task.secondaryAbilities.length).toBeGreaterThan(0)
      expect(task.dependencyRisk.knowledge.reason.length).toBeGreaterThan(0)
      expect(task.dependencyRisk.reading.reason.length).toBeGreaterThan(0)
      expect(task.dependencyRisk.formatExperience.reason.length).toBeGreaterThan(0)
      expect(task.expectedSeconds).toBeGreaterThanOrEqual(12)
      expect(task.expectedSeconds).toBeLessThanOrEqual(45)
      expect(task.measurementRationale.length).toBeGreaterThan(12)
      expect(task.items.length).toBeGreaterThan(0)
      for (const item of task.items) {
        const optionIds = item.options.map((option) => option.id)
        expect(new Set(optionIds).size).toBe(optionIds.length)
        expect(optionIds).toContain(item.correctAnswer)
        expect(item.standardDerivation.length).toBeGreaterThan(8)
        expect(item.uniqueAnswerCheck.length).toBeGreaterThan(8)
        const distractors = optionIds.filter((id) => id !== item.correctAnswer)
        expect(Object.keys(item.distractorReasons).sort()).toEqual(distractors.sort())
        expect(Math.max(...item.options.map((option) => option.label.length))).toBeLessThanOrEqual(58)
      }
    }
  })

  it('uses real visual assets for quantitative estimation and spatial tasks', () => {
    const visualCodes = ['N01', 'N02', 'S01', 'S03', 'S04', 'S05', 'S06']
    for (const code of visualCodes) {
      const task = orderedV16Tasks.find((entry) => entry.code === code)
      expect(task?.items.every((question) => Boolean(question.asset))).toBe(true)
      expect(task?.items.every((question) => Boolean(questionAssetUrl(question.asset)))).toBe(true)
    }
    const n01 = orderedV16Tasks.find((task) => task.code === 'N01')
    expect(n01?.paradigm).toBe('eight-second-dot-array-comparison')
    expect(JSON.stringify(n01?.items)).not.toMatch(/●●|一样多|无法判断/)
    const n02 = orderedV16Tasks.find((task) => task.code === 'N02')
    expect(JSON.stringify(n02?.items)).not.toMatch(/[ABCD]\s*=\s*-?\d/)
    const s06 = orderedV16Tasks.find((task) => task.code === 'S06')
    expect(JSON.stringify(s06?.items)).not.toMatch(/r\d+c\d|行从|列从/)
  })

  it('delays M03 recall and makes M06 similar-distractor extraction', () => {
    const sequencePresentation = META_BANK_V16.memoryPresentations.find((entry) => entry.id === 'sequence-4-5')
    expect(sequencePresentation?.beforeTask).toBe('S03')
    expect(orderedV16Tasks.find((task) => task.code === 'S03')?.memoryPresentationId).toBe('sequence-4-5')
    expect(orderedV16Tasks.find((task) => task.code === 'M03')?.memoryPresentationId).toBeUndefined()
    const betweenPresentationAndRecall = orderedV16Tasks.filter((task) => task.position >= 13 && task.position < 15)
    expect(betweenPresentationAndRecall.map((task) => task.code)).toEqual(['S03', 'R03'])
    const m06 = orderedV16Tasks.find((task) => task.code === 'M06')
    expect(m06?.paradigm).toBe('similar-distractor-position-retrieval')
    expect(m06?.prompt).not.toMatch(/完整相同|完整序列/)
    expect(m06?.items.length).toBeGreaterThanOrEqual(2)
  })

  it('contains no filler distractor labels', () => {
    const labels = orderedV16Tasks.flatMap((task) => task.items.flatMap((question) => question.options.map((option) => option.label)))
    expect(labels.join('\n')).not.toMatch(/无法判断|无法确定|题目没有出现|题目没有说明|以上都不|都不正确/)
  })

  it('keeps memory immediate and delayed targets disjoint', () => {
    expect(META_BANK_V16.memoryFlow.visual.immediateTargets).toEqual(['VA1', 'VA2', 'VA3'])
    expect(META_BANK_V16.memoryFlow.visual.delayedTargets).toEqual(['VB1', 'VB2', 'VB3'])
    expect(META_BANK_V16.memoryFlow.semantic.immediateTargets).toEqual(['SC1', 'SC2', 'SC3'])
    expect(META_BANK_V16.memoryFlow.semantic.delayedTargets).toEqual(['SD1', 'SD2', 'SD3'])
    expect(new Set([
      ...META_BANK_V16.memoryFlow.visual.immediateTargets,
      ...META_BANK_V16.memoryFlow.visual.delayedTargets,
    ]).size).toBe(6)
    expect(new Set([
      ...META_BANK_V16.memoryFlow.semantic.immediateTargets,
      ...META_BANK_V16.memoryFlow.semantic.delayedTargets,
    ]).size).toBe(6)
    expect(META_BANK_V16.memoryFlow.sequenceLengths).toEqual([4, 5, 6])
    expect(orderedV16Tasks.find((task) => task.code === 'M02')?.memoryTargetSubset).toBe('semantic-immediate-C')
    expect(orderedV16Tasks.find((task) => task.code === 'M04')?.memoryTargetSubset).toBe('semantic-delayed-D')
    const m02StudentText = JSON.stringify(orderedV16Tasks.find((task) => task.code === 'M02')?.items)
    expect(m02StudentText).not.toMatch(/西岚|伏可|墨迩|靠近水会变轻|晚上发热|碰金属会响/)
  })

  it('keeps construct-specific task types and safe timing', () => {
    const r04 = orderedV16Tasks.find((task) => task.code === 'R04')
    expect(r04?.paradigm).toBe('dual-rule-symbol-pattern')
    expect(r04?.prompt).not.toMatch(/排列|旋转/)
    expect(r04?.items.every((question) => /规则一|规则二/.test(question.standardDerivation))).toBe(true)
    expect(orderedV16Tasks.filter((task) => task.paradigm === 'net-folding')).toHaveLength(1)
    expect(orderedV16Tasks.filter((task) => task.primaryAbility === '推演' && task.paradigm.startsWith('graphic'))).toHaveLength(2)
    expect(META_BANK_V16.timeBudget.totalExpectedSeconds).toBeLessThanOrEqual(1080)
    expect(META_BANK_V16.timeBudget.totalExpectedSeconds).toBeGreaterThanOrEqual(820)
    expect(META_BANK_V16.timeBudget.formalTasksSeconds).toBe(
      orderedV16Tasks.reduce((total, task) => total + task.expectedSeconds, 0),
    )
    expect(META_BANK_V16.timeBudget.totalExpectedSeconds).toBe(
      META_BANK_V16.timeBudget.formalTasksSeconds
      + META_BANK_V16.timeBudget.memoryPresentationSeconds
      + META_BANK_V16.timeBudget.practiceSeconds
      + META_BANK_V16.timeBudget.transitionSeconds,
    )
  })
})

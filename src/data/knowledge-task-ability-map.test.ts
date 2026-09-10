import { describe, expect, it } from 'vitest'
import { buildKnowledgeTaskAuditRows, formatKnowledgeTaskScore, resolveKnowledgeTaskAbility } from './knowledge-task-ability-map'

describe('second-level knowledge task ability mapping', () => {
  it('keeps foundational vocabulary inside the shared algorithm', () => {
    expect(resolveKnowledgeTaskAbility('英语', '核心词汇', { name: '高阶词汇', score: '基础' }).primary).toEqual(['memory'])
  })

  it('uses the actual task action when module words and topic words overlap', () => {
    expect(resolveKnowledgeTaskAbility('英语', '应用文写作', { name: '观点类应用文写作', score: '4分' }).primary).toEqual(['language'])
    expect(resolveKnowledgeTaskAbility('物理', '运动与力学实验', { name: '力学实验', score: '6分' }).primary).toEqual(['reasoning'])
    expect(resolveKnowledgeTaskAbility('物理', '热学与光学', { name: '分子动理论与气体', score: '9分' }).primary).toEqual(['reasoning'])
  })

  it('gives spatial tasks a spatial main requirement', () => {
    expect(resolveKnowledgeTaskAbility('数学', '空间向量与立体几何', { name: '点、直线、平面之间的位置关系', score: '6分' }).primary).toEqual(['space'])
  })

  it('keeps disputed task mappings fixed instead of adding the student advantage as an entry', () => {
    const cases = [
      ['物理', '近代物理', '波粒二象性与光电效应', ['reasoning'], ['memory', 'quantitative']],
      ['物理', '能量与动量守恒', '功和能', ['reasoning'], ['quantitative', 'memory']],
      ['数学', '数列', '数列求通项', ['reasoning'], ['quantitative', 'memory']],
      ['数学', '计数原理与概率统计', '统计案例', ['quantitative'], ['reasoning']],
      ['语文', '现代文阅读', '信息文', ['language'], ['reasoning', 'memory']],
      ['语文', '语言文字运用', '语言文字运用', ['language'], ['reasoning', 'memory']],
    ] as const

    cases.forEach(([subject, moduleName, name, primary, supporting]) => {
      const mapping = resolveKnowledgeTaskAbility(subject, moduleName, { name, score: '6分' })
      expect(mapping.primary).toEqual(primary)
      expect(mapping.entry).toEqual(supporting)
      expect(mapping.typicalAction).toBeTruthy()
      expect(mapping.mechanisms.length).toBeGreaterThan(0)
      expect(mapping.basis).toBeTruthy()
    })
  })

  it('formats score evidence conservatively', () => {
    expect(formatKnowledgeTaskScore('6分')).toBe('约6分')
    expect(formatKnowledgeTaskScore('基础')).toBe('高频')
    expect(formatKnowledgeTaskScore('0~3分')).toBe('中频')
    expect(formatKnowledgeTaskScore('未标分')).toBeNull()
  })

  it('builds a complete teacher audit row for every catalogued knowledge task', () => {
    const rows = buildKnowledgeTaskAuditRows()
    expect(rows.length).toBeGreaterThan(300)
    expect(rows.every((row) => row.task && row.primary.length && row.typicalAction && row.mechanisms.length && row.basis)).toBe(true)
  })
})

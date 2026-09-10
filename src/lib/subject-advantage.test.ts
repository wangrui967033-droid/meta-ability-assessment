import { describe, expect, it } from 'vitest'
import { classifySubjectOpportunity, matchAdvantageSubjects, subjectAbilityBaseline } from './subject-advantage'

describe('subject advantage matching', () => {
  it('uses the confirmed subject baseline and returns only the chosen foreign language', () => {
    expect(subjectAbilityBaseline.物理).toEqual({ memory: 4, language: 2, quantitative: 5, space: 4, reasoning: 5 })
    const result = matchAdvantageSubjects({
      dimensions: { memory: .30, language: .05, quantitative: .25, space: .20, reasoning: .20 },
    }, '日语')

    expect(result).toHaveLength(10)
    expect(result.map((item) => item.subject)).toContain('日语')
    expect(result.map((item) => item.subject)).not.toContain('英语')
    expect(result.every((item) => item.tasks.length > 0)).toBe(true)
  })

  it('finds subject and task levels separately for a spatial-reasoning profile', () => {
    const result = matchAdvantageSubjects({
      dimensions: { memory: .05, language: .05, quantitative: .20, space: .35, reasoning: .35 },
      mechanisms: { 识别结构: .9, 空间转换: .9, 发现关系: .85, 推出结论: .9 },
    }, '英语')
    const physics = result.find((item) => item.subject === '物理')
    const geography = result.find((item) => item.subject === '地理')

    expect(physics?.tasks[0].task.taskLabel).toMatch(/受力分析|运动图像|电场/)
    expect(geography?.tasks[0].task.taskLabel).toMatch(/地图|过程|图表/)
  })

  it('uses English vocabulary under the same ability-matching rules', () => {
    const result = matchAdvantageSubjects({
      dimensions: { memory: .90, language: .70, quantitative: .10, space: .10, reasoning: .40 },
    }, '英语')
    const english = result.find((item) => item.subject === '英语')

    expect(english).toBeTruthy()
    expect(english?.tasks.some((item) => item.task.id === 'english-vocabulary-recall')).toBe(true)
  })

  it('classifies the whole subject from its fixed five-ability baseline, independently of knowledge-task counts', () => {
    expect(classifySubjectOpportunity(subjectAbilityBaseline.语文, ['language', 'space'])).toBe('待发展区')
    expect(classifySubjectOpportunity(subjectAbilityBaseline.英语, ['language', 'space'])).toBe('待发展区')
    expect(classifySubjectOpportunity(subjectAbilityBaseline.数学, ['language', 'space'])).toBe('待发展区')
    expect(classifySubjectOpportunity(subjectAbilityBaseline.物理, ['language'])).toBe('待发展区')
  })

  it('requires every highest-demand ability rather than one hit', () => {
    expect(classifySubjectOpportunity(subjectAbilityBaseline.数学, ['reasoning'])).toBe('待发展区')
    expect(classifySubjectOpportunity(subjectAbilityBaseline.数学, ['reasoning', 'quantitative'])).toBe('优势发挥区')
    expect(classifySubjectOpportunity(subjectAbilityBaseline.语文, ['reasoning', 'memory'])).toBe('待发展区')
    expect(classifySubjectOpportunity(subjectAbilityBaseline.生物, ['reasoning', 'memory'])).toBe('优势发挥区')
  })

  it('does not interpret absence of a highlight as a weakness', () => {
    expect(classifySubjectOpportunity(subjectAbilityBaseline.数学, [])).toBe('待发展区')
  })
  it('withholds classification if a required ability lacks usable evidence', () => {
    expect(classifySubjectOpportunity(subjectAbilityBaseline.数学, ['reasoning'], ['reasoning', 'space', 'language', 'memory'])).toBe('待了解区')
  })
})

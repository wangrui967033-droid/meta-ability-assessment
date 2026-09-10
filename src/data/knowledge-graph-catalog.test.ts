import { describe, expect, it } from 'vitest'
import { knowledgeGraphCatalog, knowledgeGraphForSubject } from './knowledge-graph-catalog'

describe('knowledge graph catalog', () => {
  it('contains every first-level module extracted from the eleven source workbooks', () => {
    const subjects = ['语文', '数学', '英语', '日语', '物理', '化学', '生物', '历史', '政治', '地理', '技术'] as const
    expect(knowledgeGraphCatalog).toHaveLength(96)
    expect(Object.fromEntries(subjects.map((subject) => [subject, knowledgeGraphForSubject(subject).length]))).toEqual({
      语文: 4, 数学: 11, 英语: 9, 日语: 17, 物理: 11, 化学: 5, 生物: 8, 历史: 6, 政治: 7, 地理: 12, 技术: 6,
    })
  })

  it('keeps source scores as display-only strings and carries second-level content', () => {
    const physics = knowledgeGraphForSubject('物理')
    const electromagnetism = physics.find((item) => item.name === '磁场与电磁感应')!

    expect(electromagnetism.score).toBe('19分')
    expect(electromagnetism.topics).toContainEqual({ name: '电磁感应中的导轨模型', score: '8分' })
    expect(knowledgeGraphForSubject('数学').find((item) => item.name === '复数')?.topics).toEqual([])
    const vocabulary = knowledgeGraphForSubject('英语').find((item) => item.name === '核心词汇')
    expect(vocabulary?.topics.map((topic) => topic.name)).toEqual(['初阶词汇', '中阶词汇', '高阶词汇'])
  })

  it('uses 元能力 instead of a bare 元能力 in student-visible catalog names', () => {
    const visibleNames = knowledgeGraphCatalog.flatMap((item) => [item.name, ...item.topics.map((topic) => topic.name)]).join('\n')
    expect(visibleNames).not.toMatch(/(^|[^元])能力/u)
  })
})

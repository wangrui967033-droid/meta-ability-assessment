import { describe, expect, it } from 'vitest'
import { buildObservableTrialSteps, subjectAbilityStudyRoutes, subjectExplorationTransferWhitelist } from './subject-ability-routes'
import { advantageStudyGuidance, subjectLearningActions, subjectLearningRules } from './advantage-study-guidance'

describe('subject ability study routes', () => {
  it('covers every subject with all five learning entrances', () => {
    expect(Object.keys(subjectAbilityStudyRoutes)).toHaveLength(11)
    for (const routes of Object.values(subjectAbilityStudyRoutes)) {
      expect(Object.keys(routes).sort()).toEqual(['language', 'memory', 'quantitative', 'reasoning', 'space'])
      expect(Object.values(routes).every((route) => route.steps.length === 4 && route.help.length > 0)).toBe(true)
    }
  })

  it('marks spatial English as an organising aid instead of a core demand', () => {
    expect(subjectAbilityStudyRoutes.英语.space.help).toContain('较少直接用到空间')
  })

  it('gives every subject one plain-language rule and five possible ways to use an advantage', () => {
    expect(Object.keys(subjectLearningRules)).toHaveLength(11)
    expect(Object.keys(advantageStudyGuidance)).toHaveLength(11)
    for (const subject of Object.keys(subjectAbilityStudyRoutes) as Array<keyof typeof subjectLearningRules>) {
      expect(subjectLearningRules[subject].length).toBeGreaterThan(12)
      expect(Object.keys(advantageStudyGuidance[subject]).sort()).toEqual(['language', 'memory', 'quantitative', 'reasoning', 'space'])
      expect(Object.values(advantageStudyGuidance[subject]).every((copy) => !copy.includes('帮你'))).toBe(true)
    }
  })

  it('gives every subject concrete actions for learning, memorising, practising, and repairing', () => {
    expect(Object.keys(subjectLearningActions)).toHaveLength(11)
    for (const subject of Object.keys(subjectAbilityStudyRoutes) as Array<keyof typeof subjectLearningActions>) {
      expect(Object.keys(subjectLearningActions[subject]).sort()).toEqual(['learn', 'memorize', 'practice', 'repair'])
      expect(Object.values(subjectLearningActions[subject]).every((copy) => copy.length > 12)).toBe(true)
      expect(Object.values(subjectLearningActions[subject]).join('')).not.toMatch(/阅读题|写作题|材料题|实验题|计算题|图表题/u)
    }
    expect(subjectLearningRules.数学).toBe('先把已知条件和所求写清楚，再用数量、图形或符号表示它们的关系。每一步计算或推理都要有依据，最后回到题目检查结果。')
  })

  it('keeps advantage guidance at subject level instead of binding it to a task type', () => {
    const copy = Object.values(advantageStudyGuidance)
      .flatMap((guidance) => Object.values(guidance))
      .join('\n')

    expect(copy).not.toMatch(/古诗文|写作时|听力|阅读题|实验题|计算题|材料题|图表题|史料/u)
  })

  it('turns a possible entrance into an observable try-check-record loop', () => {
    expect(buildObservableTrialSteps('政治', 'language')).toEqual([
      '准备：选一小段政治内容或一道代表题',
      '执行：先按上面的语言动作处理一遍',
      '核对：对照材料和题目要求，检查观点、理由和材料是否一一对应',
      '记录：写下这样做是否更容易开始、少漏信息或更快发现错误',
    ])
  })

  it('keeps exploration transfers in a small explicit whitelist', () => {
    expect(Object.keys(subjectExplorationTransferWhitelist)).toEqual(['语文'])
    expect(subjectExplorationTransferWhitelist.语文).toEqual([
      {
        dimension: 'space',
        outcome: '更快看清段落关系',
        basis: '将篇章层次外化为结构图，仅作为语文学习方法的探索迁移，不参与学科或任务匹配',
      },
    ])
  })
})

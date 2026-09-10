import { describe, expect, it } from 'vitest'
import { knowledgeGraphForSubject } from '../data/knowledge-graph-catalog'
import { buildPrototypeReport, classifyKnowledgeTask, validateIntake, type ScoredEvidence } from './assessment'

describe('validateIntake', () => {
  it('requires display name, grade and language while allowing any number of electives', () => {
    expect(validateIntake({ name: '', grade: '高一', foreignLanguage: '英语', selectedSubjects: [] })).toMatchObject({ name: '请填写姓名' })
    expect(validateIntake({ name: '林晓', grade: '', foreignLanguage: '英语', selectedSubjects: [] })).toMatchObject({ grade: '请选择年级' })
    expect(validateIntake({ name: '林晓', grade: '高一', foreignLanguage: '', selectedSubjects: [] })).toMatchObject({ foreignLanguage: '请选择高考外语语种' })
    expect(validateIntake({ name: '林晓', grade: '高一', foreignLanguage: '英语', selectedSubjects: [] })).toEqual({})
    expect(validateIntake({ name: '林晓', grade: '高一', foreignLanguage: '英语', selectedSubjects: ['物理', '化学'] })).toEqual({})
    expect(validateIntake({ name: '林晓', grade: '高一', foreignLanguage: '英语', selectedSubjects: ['物理', '化学', '生物'] })).toEqual({})
  })
})

const evidenceFixture: ScoredEvidence[] = [
  ...Array.from({ length: 6 }, (_, index) => ({ taskId: `s${index}`, position: index + 1, dimension: 'space' as const, mechanism: ['识别结构', '空间想象', '空间转换'][index % 3], role: 'direct' as const, nodeScore: { earned: 1, possible: 1 }, diagnosticPoints: [1], durationMs: 18000 })),
  ...Array.from({ length: 6 }, (_, index) => ({ taskId: `r${index}`, position: index + 7, dimension: 'reasoning' as const, mechanism: ['发现关系', '归纳规律', '推出结论'][index % 3], role: 'direct' as const, nodeScore: { earned: index < 4 ? 1 : 0, possible: 1 }, diagnosticPoints: [index < 4 ? 1 : 0], durationMs: 18000 })),
  ...Array.from({ length: 18 }, (_, index) => ({ taskId: `o${index}`, position: index + 13, dimension: (['memory', 'language', 'quantitative'] as const)[index % 3], mechanism: ['快速记住', '理解意思', '感知数量'][index % 3], role: 'direct' as const, nodeScore: { earned: index % 4 === 0 ? 1 : 0, possible: 1 }, diagnosticPoints: [index % 4 === 0 ? 1 : 0], durationMs: 18000 })),
]

describe('buildPrototypeReport', () => {
  it('does not reject complete evidence because task scores differ by 50 points or more', () => {
    for (const low of [0, .49, .5]) {
      const input = evidenceFixture.filter(item => item.dimension === 'space').map((item, index) => ({
        ...item, nodeScore: {earned: index % 2 ? low : 1, possible: 1},
      }))
      const summary = buildPrototypeReport(input, '英语').dimensionSummary.find(item => item.dimension === 'space')!
      expect(summary.evidenceQuality).toBe('证据充分')
      expect(summary.signal).toBe(Math.round((1 + low) * 50))
      expect(summary.evidenceCount).toBe(6)
    }
  })

  it('keeps the advantage boundary while retaining the relatively higher dimensions', () => {
    const tiedEvidence: ScoredEvidence[] = (['memory', 'language', 'quantitative', 'space', 'reasoning'] as const).flatMap((dimension, dimensionIndex) =>
      Array.from({ length: 6 }, (_, index) => ({
        taskId: `${dimension}-${index}`,
        position: dimensionIndex * 6 + index + 1,
        dimension,
        mechanism: `${dimension}-mechanism-${index % 3}`,
        role: 'direct' as const,
        nodeScore: { earned: index < (dimensionIndex < 2 ? 5 : 4) ? 1 : 0, possible: 1 },
        diagnosticPoints: [],
        durationMs: 18000,
      })),
    )

    const report = buildPrototypeReport(tiedEvidence, '英语')

    expect(report.advantageClarity).toBe('暂不明显')
    expect(report.advantageDimensions).toEqual([])
    expect(report.relativeDimensions).toEqual(['memory', 'language'])
    expect(report.subjectOpportunityPlan).toHaveLength(10)
    expect(report.conclusion).toContain('记忆和语言两组得分相对较高')
  })

  it('returns one advantage when only one dimension is clearly separated', () => {
    const oneClear: ScoredEvidence[] = (['memory', 'language', 'quantitative', 'space', 'reasoning'] as const).flatMap((dimension, dimensionIndex) =>
      Array.from({ length: 6 }, (_, index) => ({
        taskId: `${dimension}-${index}`,
        position: dimensionIndex * 6 + index + 1,
        dimension,
        mechanism: `${dimension}-mechanism-${index % 3}`,
        role: 'direct' as const,
        nodeScore: { earned: index < (dimension === 'language' ? 6 : 3) ? 1 : 0, possible: 1 },
        diagnosticPoints: [],
        durationMs: 18000,
      })),
    )

    const report = buildPrototypeReport(oneClear, '英语')

    expect(report.advantageClarity).toBe('单优势清楚')
    expect(report.advantageDimensions).toEqual(['language'])
  })

  it('treats very fast or thin evidence as observation rather than an advantage', () => {
    const thinEvidence: ScoredEvidence[] = Array.from({ length: 3 }, (_, index) => ({
      taskId: `fast-${index}`,
      position: index + 1,
      dimension: 'space' as const,
      mechanism: ['识别结构', '空间想象', '空间转换'][index],
      role: 'direct' as const,
      nodeScore: { earned: 1, possible: 1 },
      diagnosticPoints: [1],
      durationMs: 500,
    }))

    const report = buildPrototypeReport(thinEvidence, '英语')
    const space = report.dimensionSummary.find((item) => item.dimension === 'space')!

    expect(space.performance).toBe('还需要继续观察')
    expect(space.evidenceQuality).toBe('证据不足')
    expect(report.advantageDimensions).toEqual([])
    expect(report.relativeDimensions).toEqual([])
  })

  it('keeps complete fast responses in scoring instead of suppressing sections 03 and 04', () => {
    const fastCompleteEvidence: ScoredEvidence[] = (['memory', 'language', 'quantitative', 'space', 'reasoning'] as const).flatMap((dimension, dimensionIndex) =>
      Array.from({ length: 6 }, (_, index) => ({
        taskId: `fast-complete-${dimension}-${index}`,
        position: dimensionIndex * 6 + index + 1,
        dimension,
        mechanism: `${dimension}-${index % 3}`,
        role: 'direct' as const,
        nodeScore: { earned: index < (dimension === 'language' || dimension === 'space' ? 6 : 2) ? 1 : 0, possible: 1 },
        diagnosticPoints: [],
        durationMs: 500,
      })),
    )

    const report = buildPrototypeReport(fastCompleteEvidence, '英语', ['语文', '英语', '数学'])

    expect(report.dimensionSummary.every((item) => item.evidenceCount === 6)).toBe(true)
    expect(report.advantageDimensions).toEqual(['language', 'space'])
    expect(report.subjectOpportunityPlan).toHaveLength(3)
    expect(report.subjectTaskPlan).toHaveLength(3)
  })

  it('does not call a mechanism stable from a single successful task', () => {
    const sparseMechanism: ScoredEvidence[] = [
      { taskId: 'one', position: 1, dimension: 'language', mechanism: '理解意思', role: 'direct', nodeScore: { earned: 1, possible: 1 }, diagnosticPoints: [1], durationMs: 18000 },
      ...Array.from({ length: 3 }, (_, index) => ({ taskId: `other-${index}`, position: index + 2, dimension: 'language' as const, mechanism: '组织信息', role: 'direct' as const, nodeScore: { earned: 1, possible: 1 }, diagnosticPoints: [1], durationMs: 18000 })),
    ]

    const report = buildPrototypeReport(sparseMechanism, '英语')
    const understanding = report.dimensionSummary.find((item) => item.dimension === 'language')!.mechanisms.find((item) => item.name === '理解意思')!

    expect(understanding.state).toBe('还需要更多观察')
  })

  it('shows Japanese instead of English for a Japanese student while retaining ten subjects', () => {
    const report = buildPrototypeReport(evidenceFixture, '日语')

    expect(report.subjects.map((subject) => subject.subject)).toContain('日语')
    expect(report.subjects.map((subject) => subject.subject)).not.toContain('英语')
    expect(report.subjects).toHaveLength(10)
  })

  it('returns the approved report ingredients without a type status', () => {
    const report = buildPrototypeReport(evidenceFixture, '英语')

    expect(report.conclusion).toContain('两组任务得分相对较高')
    expect(report.subjects.every((subject) => !('status' in subject))).toBe(true)
    expect(report.subjects.every((subject) => subject.entryAbilities.length === 2)).toBe(true)
    expect(report.subjects.every((subject) => !('recommendationReason' in subject))).toBe(true)
    expect(report.subjects[0].tasks[0].abilityFocus).not.toContain('·')
    expect(report.subjects[0].tasks[0].graphScore).toBeTruthy()
    expect(report.subjects[0].tasks[0].graphTopics.length).toBeGreaterThan(0)
    expect('nextStep' in report.subjects[0].tasks[0]).toBe(false)
    expect('holdOff' in report.subjects[0].tasks[0]).toBe(false)
    expect(report.subjectTaskPlan).toHaveLength(10)
    expect(report.subjectTaskPlan.every((plan) => plan.groups.map((group) => group.label).join('|') === '优势直接参与|需要带动其他元能力|可以借优势进入|重点练习|暂不判断')).toBe(true)
    expect('allocationPlan' in report).toBe(false)
    expect('status' in report).toBe(false)
    expect(report.mechanismSummary).toHaveLength(15)
  })

  it('reports official first-level graph modules while using only ability matching for recommendation', () => {
    const report = buildPrototypeReport(evidenceFixture, '英语')
    const math = report.subjects.find((subject) => subject.subject === '数学')!
    const chinese = report.subjects.find((subject) => subject.subject === '语文')!

    expect(math.tasks.map((task) => task.graphModule)).toContain('函数与导数')
    expect(math.tasks).toHaveLength(11)
    expect(math.tasks.some((task) => task.graphTopics.some((topic) => topic.name.includes('函数')))).toBe(true)
    expect(chinese.tasks.map((task) => task.graphModule)).toContain('现代文阅读')
    expect(chinese.tasks).toHaveLength(4)
    expect(chinese.tasks.find((task) => task.graphModule === '古诗文阅读')?.graphScore).toBe('37分')
    expect(report.subjectTaskPlan[0].groups[0].label).toBe('优势直接参与')
    expect(report.subjectTaskPlan[0].groups[0].tasks).toHaveLength(0)
  })

  it('only returns subjects the student selected for this report', () => {
    const report = buildPrototypeReport(evidenceFixture, '英语', ['语文', '英语', '物理'])

    expect(report.subjects.map((subject) => subject.subject).sort()).toEqual(['英语', '物理', '语文'].sort())
    expect(report.subjectTaskPlan).toHaveLength(3)
  })

  it('keeps the student-selected subject order instead of presenting a hidden recommendation ranking', () => {
    const report = buildPrototypeReport(evidenceFixture, '英语', ['语文', '数学', '英语', '物理'])

    expect(report.subjects.map((subject) => subject.subject)).toEqual(['语文', '数学', '英语', '物理'])
    expect(report.subjectTaskPlan.map((subject) => subject.subject)).toEqual(['语文', '数学', '英语', '物理'])
  })

  it('includes English vocabulary in the same knowledge-task recommendation', () => {
    const report = buildPrototypeReport(evidenceFixture, '英语', ['英语'])
    const english = report.subjects[0]
    const catalogTopicCount = knowledgeGraphForSubject('英语').reduce((total, module) => total + Math.max(module.topics.length, 1), 0)
    const reportTopicCount = english.tasks.reduce((total, task) => total + task.graphTopics.length, 0)

    expect(english.subject).toBe('英语')
    expect(english.tasks.some((task) => task.graphModule === '核心词汇')).toBe(true)
    expect(report.subjectTaskPlan[0].groups.flatMap((group) => group.tasks).some((task) => task.graphModule === '核心词汇')).toBe(true)
    expect(reportTopicCount).toBe(catalogTopicCount)
  })

  it('always assigns the same strategy to the same ability requirements', () => {
    const report = buildPrototypeReport(evidenceFixture, '英语')
    const strategiesByRequirement = new Map<string, Set<string>>()
    report.subjectTaskPlan.flatMap((plan) => plan.groups).forEach((group) => {
      group.tasks.flatMap((task) => task.graphTopics).forEach((topic) => {
        const key = `${topic.mappingSource.startsWith('subject-framework:')}::${[...topic.abilityDimensions].sort().join('|')}::${[...topic.entryDimensions].sort().join('|')}`
        const seen = strategiesByRequirement.get(key) ?? new Set<string>()
        seen.add(group.label)
        strategiesByRequirement.set(key, seen)
      })
    })
    expect([...strategiesByRequirement.values()].every((strategies) => strategies.size === 1)).toBe(true)
  })

  it('classifies by fixed main abilities before considering supporting abilities', () => {
    expect(classifyKnowledgeTask(['language', 'reasoning'], ['memory'], ['language'])).toBe('需要带动其他元能力')
    expect(classifyKnowledgeTask(['language', 'reasoning'], ['memory'], ['language', 'reasoning'])).toBe('优势直接参与')
    expect(classifyKnowledgeTask(['reasoning'], ['language'], ['language'])).toBe('需要带动其他元能力')
    expect(classifyKnowledgeTask(['reasoning'], ['memory'], ['language'])).toBe('需要带动其他元能力')
  })

  it('uses the canonical fifteen mechanism names everywhere in the report model', () => {
    const report = buildPrototypeReport(evidenceFixture, '英语')
    expect(report.mechanismSummary.map((item) => item.name)).toEqual(expect.arrayContaining([
      '快速记住', '保持信息', '准确提取',
      '理解意思', '组织信息', '准确表达',
      '感知数量', '理解变化', '处理符号',
      '识别结构', '空间想象', '空间转换',
      '发现关系', '归纳规律', '推出结论',
    ]))
  })

  it('keeps a real need-to-develop group for a language-space profile', () => {
    const languageSpaceEvidence: ScoredEvidence[] = (['memory', 'language', 'quantitative', 'space', 'reasoning'] as const).flatMap((dimension, dimensionIndex) =>
      Array.from({ length: 6 }, (_, index) => ({
        taskId: `${dimension}-${index}`,
        position: dimensionIndex * 6 + index + 1,
        dimension,
        mechanism: `${dimension}-${index % 3}`,
        role: 'direct' as const,
        nodeScore: { earned: index < (dimension === 'language' || dimension === 'space' ? 6 : 2) ? 1 : 0, possible: 1 },
        diagnosticPoints: [],
        durationMs: 18000,
      })),
    )
    const report = buildPrototypeReport(languageSpaceEvidence, '英语', ['数学', '物理'])
    expect(report.subjectTaskPlan.every((plan) => {
      const group = plan.groups.find((item) => item.label === '需要带动其他元能力')
      return Boolean(group?.tasks.length)
    })).toBe(true)
  })

  it('uses “元能力” rather than generic “元能力” in student-facing generated prose', () => {
    const report = buildPrototypeReport(evidenceFixture, '英语', ['语文', '数学', '英语', '物理'])
    const visibleProse = [
      report.conclusion,
      ...report.subjectOpportunityPlan.map((subject) => subject.reason),
      ...report.subjectTaskPlan.flatMap((plan) => plan.groups.flatMap((group) => group.tasks.map((task) => task.strategy))),
    ].join('\n')

    expect(visibleProse).not.toMatch(/(^|[^元])能力/u)
  })

  it('separates directly matched core advantages from other helpful advantages in the subject overview', () => {
    const languageSpaceEvidence: ScoredEvidence[] = (['memory', 'language', 'quantitative', 'space', 'reasoning'] as const).flatMap((dimension, dimensionIndex) =>
      Array.from({ length: 6 }, (_, index) => ({
        taskId: `overview-${dimension}-${index}`,
        position: dimensionIndex * 6 + index + 1,
        dimension,
        mechanism: `${dimension}-${index % 3}`,
        role: 'direct' as const,
        nodeScore: { earned: index < (dimension === 'language' || dimension === 'space' ? 6 : 2) ? 1 : 0, possible: 1 },
        diagnosticPoints: [],
        durationMs: 18000,
      })),
    )
    const report = buildPrototypeReport(languageSpaceEvidence, '英语', ['语文', '数学'])
    const chinese = report.subjectOpportunityPlan.find((item) => item.subject === '语文')
    const math = report.subjectOpportunityPlan.find((item) => item.subject === '数学')

    expect(chinese?.directCoreMatches).toEqual(['language'])
    expect(chinese?.supportingAdvantageMatches).toEqual([])
    expect(math?.directCoreMatches).toEqual([])
    expect(math?.supportingAdvantageMatches).toEqual(['space'])
  })

  it('records a reviewable second-level mapping source instead of inheriting module demand', () => {
    const report = buildPrototypeReport(evidenceFixture, '英语', ['语文', '英语', '数学', '物理'])
    const topics = report.subjects.flatMap((subject) => subject.tasks.flatMap((task) => task.graphTopics))

    expect(topics.length).toBeGreaterThan(0)
    expect(topics.every((topic) => topic.mappingSource && !topic.mappingSource.startsWith('module-'))).toBe(true)
  })
})

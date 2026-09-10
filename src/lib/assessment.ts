import { taskLearningContext, subjectLearningContext } from '../data/task-learning-paths'
import type { Dimension, ForeignLanguage, Intake, TaskRole } from '../data/assessment-types'
import { classificationPolicy } from './classification-policy'
import { requirementSupport, subjectTierForStatus, taskStrategyForStatus, type AbilityObservations, type RequirementSupport } from './requirement-support'
import { formatKnowledgeTaskScore, resolveKnowledgeTaskAbility, type KnowledgeTaskAbilityMapping } from '../data/knowledge-task-ability-map'
import type { MechanismKey, SubjectName } from '../data/subject-task-map'
import { knowledgeGraphForSubject, type KnowledgeGraphTopic } from '../data/knowledge-graph-catalog'
import { matchAdvantageSubjects, subjectAbilityBaseline, type SubjectOpportunityTier } from './subject-advantage'

export type { Dimension }

export interface ScoredEvidence {
  taskId: string
  position: number
  dimension: Dimension
  mechanism: string
  role: TaskRole
  nodeScore: { earned: number; possible: number }
  diagnosticPoints: number[]
  durationMs: number
}

export interface DimensionSummary {
  dimension: Dimension
  label: string
  signal: number
  performance: '比较顺手' | '能较稳定地用上' | '有时能用上' | '还需要继续观察'
  evidenceQuality: '证据充分' | '证据不足'
  evidenceCount: number
  mechanismCoverage: number
  consistency: number
  mechanisms: Array<{ name: string; signal: number; state: '表现较稳定' | '出现优势迹象' | '还需要更多观察'; explanation: string }>
}

export type AdvantageClarity = '双优势清楚' | '单优势清楚' | '多项表现突出' | '暂不明显'

export type KnowledgeTaskStrategy = '优势直接参与' | '可以借优势进入' | '需要带动其他元能力' | '重点练习' | '暂不判断'

export interface KnowledgeGraphTopicResult extends KnowledgeGraphTopic {
  support: RequirementSupport
  abilityDimensions: readonly Dimension[]
  entryDimensions: readonly Dimension[]
  abilityFocus: string
  matchedAbilities: readonly Dimension[]
  matchedEntryAbilities: readonly Dimension[]
  displayScore: string | null
  typicalAction: string
  mechanisms: readonly MechanismKey[]
  mappingBasis: string
  reviewStatus: KnowledgeTaskAbilityMapping['reviewStatus']
  mappingSource: KnowledgeTaskAbilityMapping['source']
  strategy: KnowledgeTaskStrategy
}

export interface SubjectTaskResult {
  label: string
  graphModule: string
  graphScore: string
  graphTopics: readonly KnowledgeGraphTopicResult[]
  abilityFocus: string
  strategy: string
}
export interface SubjectResult {
  subject: SubjectName
  signal: number
  entryAbilities: readonly Dimension[]
  tasks: SubjectTaskResult[]
}
export interface SubjectTaskPlan {
  subject: SubjectName
  groups: Array<{
    label: KnowledgeTaskStrategy
    tasks: SubjectTaskResult[]
  }>
}
export interface SubjectOpportunityResult {
  support: RequirementSupport
  subject: SubjectName
  tier: SubjectOpportunityTier
  requiredAbilities: readonly Dimension[]
  coreAbilities: readonly Dimension[]
  keyAbilities: readonly Dimension[]
  uncoveredKeyAbilities: readonly Dimension[]
  unobservedAbilities: readonly Dimension[]
  matchedAbilities: readonly Dimension[]
  directCoreMatches: readonly Dimension[]
  supportingAdvantageMatches: readonly Dimension[]
  otherAbilities: readonly Dimension[]
  reason: string
}
export interface ReportModel {
  conclusion: string
  primary: Dimension
  secondary: Dimension
  advantageClarity: AdvantageClarity
  advantageDimensions: readonly Dimension[]
  relativeDimensions: readonly Dimension[]
  dimensionSummary: DimensionSummary[]
  mechanismSummary: DimensionSummary['mechanisms'][number][]
  subjects: SubjectResult[]
  subjectOpportunityPlan: SubjectOpportunityResult[]
  subjectTaskPlan: SubjectTaskPlan[]
}

const dimensions: Dimension[] = ['memory', 'language', 'quantitative', 'space', 'reasoning']
export const dimensionLabels: Record<Dimension, string> = { memory: '记忆', language: '语言', quantitative: '数理', space: '空间', reasoning: '推演' }
export const dimensionDefinitions: Record<Dimension, string> = {
  memory: '学进去、记得住，需要时想得起来',
  language: '读懂意思、理清内容，并把想法说清楚',
  quantitative: '看懂数量、比例，以及它们怎么变化',
  space: '看清图形、位置和整体结构',
  reasoning: '找到关系和规律，一步步得出结论',
}

const mechanismDefinitions: Record<Dimension, Array<{ name: string; explanation: string }>> = {
  memory: [{ name: '快速记住', explanation: '接触新信息时，较快地把内容记下来。' }, { name: '保持信息', explanation: '把记住的内容保留下来，过一段时间仍然记得。' }, { name: '准确提取', explanation: '需要时，从记忆中找回相关内容，不把相似的信息混在一起。' }],
  language: [{ name: '理解意思', explanation: '理解听到或读到的内容，明白其中的意思和前后联系。' }, { name: '组织信息', explanation: '理清信息的主次和先后，把零散内容连成有条理的整体。' }, { name: '准确表达', explanation: '把意思说清楚，不漏条件，也不多加意思。' }],
  quantitative: [{ name: '感知数量', explanation: '把握数量的多少、大小和比例，判断彼此相差多少。' }, { name: '处理符号', explanation: '理解数字和符号代表什么，用它们表示数量关系并进行运算。' }, { name: '理解变化', explanation: '理解数量怎样变化，以及一个量变化时，其他量会怎样跟着变。' }],
  space: [{ name: '识别结构', explanation: '分清物体的形状、相对位置，以及各部分怎样组成整体。' }, { name: '空间想象', explanation: '根据已有信息，在脑中形成物体或空间的样子，包括眼前看不到的部分。' }, { name: '空间转换', explanation: '在脑中移动、转动物体或换个角度观察，判断位置和形状会怎样变化。' }],
  reasoning: [{ name: '发现关系', explanation: '找出信息之间的联系，分清哪些条件相互影响或限制。' }, { name: '归纳规律', explanation: '比较不同情况，从共同点和差异中概括出规律。' }, { name: '推出结论', explanation: '根据已有信息和规则，一步步推导出有依据的结论。' }],
}

const learningTaskMeanings: Record<Dimension, string> = {
  memory: '回想并记下重点',
  language: '用自己的话说清内容',
  quantitative: '比较数量和变化',
  space: '画图理清位置和关系',
  reasoning: '找出条件之间的关系，一步步往下推',
}

/**
 * 兼容集合输入的分类入口（调用方须保证证据充分）：全部主要要求支持、相关要求可借力、无借力。
 * 分类只看元能力集合，因此相同需求一定得到相同结论。
 */
export const classifyKnowledgeTask = (
  primaryRequired: readonly Dimension[],
  entryRequired: readonly Dimension[],
  advantages: readonly Dimension[],
): KnowledgeTaskStrategy => {
  const observations = Object.fromEntries(dimensions.map(d => [d, {score: advantages.includes(d) ? 1 : 0, sufficient:true}])) as unknown as AbilityObservations
  return taskStrategyForStatus[requirementSupport(primaryRequired, entryRequired, observations).status]
}

export function validateIntake(input: Pick<Intake, 'name'> & Partial<Pick<Intake, 'grade' | 'foreignLanguage' | 'selectedSubjects'>>): Partial<Record<'name' | 'grade' | 'foreignLanguage' | 'selectedSubjects', string>> {
  const errors: Partial<Record<'name' | 'grade' | 'foreignLanguage' | 'selectedSubjects', string>> = {}
  const name = input.name.trim()
  if (!name) errors.name = '请填写姓名'
  else if (name.length > 20) errors.name = '姓名或报告显示名请控制在20个字以内'
  if (!input.grade?.trim()) errors.grade = '请选择年级'
  if (!input.foreignLanguage?.trim()) errors.foreignLanguage = '请选择高考外语语种'
  return errors
}

// 作答时长只用于异常记录，不改变题目得分，也不把完整作答排除出元能力证据。
const isUsableEvidence = (item: ScoredEvidence) => Number.isFinite(item.nodeScore.earned) && Number.isFinite(item.nodeScore.possible) && item.nodeScore.possible > 0 && item.nodeScore.earned >= 0 && item.nodeScore.earned <= item.nodeScore.possible

function scoreFor(evidence: ScoredEvidence[], predicate: (item: ScoredEvidence) => boolean) {
  const matched = evidence.filter((item) => isUsableEvidence(item) && predicate(item))
  if (!matched.length) return 0
  return matched.reduce((total, item) => total + item.nodeScore.earned / item.nodeScore.possible, 0) / matched.length
}

function evidenceProfile(evidence: ScoredEvidence[], dimension: Dimension) {
  const all = evidence.filter((item) => item.dimension === dimension)
  const usable = all.filter(isUsableEvidence)
  const values = usable.map((item) => item.nodeScore.earned / item.nodeScore.possible)
  const odd = values.filter((_, index) => index % 2 === 0)
  const even = values.filter((_, index) => index % 2 === 1)
  const mean = (items: number[]) => items.length ? items.reduce((total, value) => total + value, 0) / items.length : 0
  // 仅保留原始分组差异作为描述记录，不是信度估计，也不设分差判定阈值。
  const consistency = odd.length && even.length ? 1 - Math.abs(mean(odd) - mean(even)) : 0
  const mechanismCoverage = new Set(usable.map((item) => item.mechanism)).size
  const abnormalRate = all.length ? (all.length - usable.length) / all.length : 1
  const sufficient = usable.length >= 4 && mechanismCoverage >= 2 && abnormalRate <= .25
  return { usable, evidenceCount: usable.length, mechanismCoverage, consistency, sufficient }
}

function performanceFor(signal: number, sufficient: boolean): DimensionSummary['performance'] {
  if (!sufficient) return '还需要继续观察'
  if (signal >= classificationPolicy.supportThreshold) return '比较顺手'
  if (signal >= .6) return '能较稳定地用上'
  if (signal > 0) return '有时能用上'
  return '还需要继续观察'
}

function advantageResult(ranked: Dimension[], scores: Record<Dimension, number>, summaries: DimensionSummary[]) {
  const sufficient = new Set(summaries.filter((item) => item.evidenceQuality === '证据充分').map((item) => item.dimension))
  // Retain the existing provisional score/separation conditions, but no fixed group size.
  for (let size = ranked.length - 1; size >= 1; size--) {
    const group = ranked.slice(0, size)
    if (group.every(d => sufficient.has(d) && scores[d] >= .65) && scores[group[size - 1]] - scores[ranked[size]] >= .18) {
      const clarity: AdvantageClarity = size === 1 ? '单优势清楚' : size === 2 ? '双优势清楚' : '多项表现突出'
      return { clarity, dimensions: group }
    }
  }
  return { clarity: '暂不明显' as const, dimensions: [] as Dimension[] }
}

function relativeResult(ranked: Dimension[], scores: Record<Dimension, number>, summaries: DimensionSummary[]) {
  const sufficient = new Set(summaries.filter((item) => item.evidenceQuality === '证据充分').map((item) => item.dimension))
  const eligible = ranked.filter((dimension) => sufficient.has(dimension))
  if (eligible.length < 4) return [] as Dimension[]
  const highest = scores[eligible[0]]
  const lowest = scores[eligible[eligible.length - 1]]
  if (eligible.length === 5 && highest >= .65 && Math.round(highest * 100) === Math.round(lowest * 100)) return eligible
  if (highest <= 0 || highest - lowest < .05) return [] as Dimension[]
  return eligible.filter(d => Math.round(scores[d] * 100) === Math.round(highest * 100))
}

export function buildPrototypeReport(evidence: ScoredEvidence[], foreignLanguage: ForeignLanguage, selectedSubjects?: readonly SubjectName[]): ReportModel {
  // 同一组题重复提交不增加独立证据；冲突记录暂不参与分析。
  const unique=new Map<string,ScoredEvidence>()
  const conflicts=new Set<string>()
  for(const item of evidence){
    const previous=unique.get(item.taskId)
    if(previous && (previous.dimension!==item.dimension || previous.mechanism!==item.mechanism || previous.nodeScore.earned!==item.nodeScore.earned || previous.nodeScore.possible!==item.nodeScore.possible))conflicts.add(item.taskId)
    unique.set(item.taskId,item)
  }
  evidence=[...unique.values()].filter(e=>!conflicts.has(e.taskId))
  const dimensionScores = Object.fromEntries(dimensions.map((dimension) => [dimension, scoreFor(evidence, (item) => item.dimension === dimension)])) as Record<Dimension, number>
  const ranked = [...dimensions].sort((left, right) => dimensionScores[right] - dimensionScores[left])
  const primary = ranked[0]
  const secondary = ranked[1]
  const dimensionSummary = dimensions.map((dimension) => {
    const profile = evidenceProfile(evidence, dimension)
    return {
      dimension,
      label: dimensionLabels[dimension],
      signal: Math.round(dimensionScores[dimension] * 100),
      performance: performanceFor(dimensionScores[dimension], profile.sufficient),
      evidenceQuality: profile.sufficient ? '证据充分' as const : '证据不足' as const,
      evidenceCount: profile.evidenceCount,
      mechanismCoverage: profile.mechanismCoverage,
      consistency: profile.consistency,
      mechanisms: mechanismDefinitions[dimension].map((definition) => {
        const mechanismEvidence = profile.usable.filter((item) => item.mechanism === definition.name)
        const signal = mechanismEvidence.length
          ? mechanismEvidence.reduce((total, item) => total + item.nodeScore.earned / item.nodeScore.possible, 0) / mechanismEvidence.length
          : 0
        const state = mechanismEvidence.length < 2
          ? '还需要更多观察' as const
          : signal >= classificationPolicy.supportThreshold ? '表现较稳定' as const : signal > 0 ? '出现优势迹象' as const : '还需要更多观察' as const
        return { ...definition, signal, state }
      }),
    }
  }).sort((left, right) => right.signal - left.signal)
  const advantage = advantageResult(ranked, dimensionScores, dimensionSummary)
  const relativeDimensions = advantage.dimensions.length ? [...advantage.dimensions] : relativeResult(ranked, dimensionScores, dimensionSummary)
  const mechanismSignals = Object.fromEntries(
    Object.values(mechanismDefinitions).flat().map((definition) => [
      definition.name,
      scoreFor(evidence, (item) => item.mechanism === definition.name),
    ]),
  ) as Partial<Record<MechanismKey, number>>
  const selected = selectedSubjects?.length ? new Set(selectedSubjects) : null
  const selectedOrder = new Map((selectedSubjects ?? []).map((subject, index) => [subject, index]))
  const selectedMatches = matchAdvantageSubjects({ dimensions: dimensionScores, mechanisms: mechanismSignals }, foreignLanguage)
    .filter((subject) => !selected || selected.has(subject.subject))
  const advantages = advantage.dimensions
  const observations = Object.fromEntries(dimensionSummary.map(item => [item.dimension, {score: dimensionScores[item.dimension], sufficient: item.evidenceQuality === '证据充分', samples:evidenceProfile(evidence,item.dimension).usable.map(e=>({score:e.nodeScore.earned/e.nodeScore.possible,mechanism:e.mechanism}))}])) as unknown as AbilityObservations
  for(const item of dimensionSummary){
    const detail=requirementSupport([item.dimension],[],observations).details[item.dimension]
    if(detail==='gap' && item.signal>0)item.performance='有时能用上'
  }
  const rankedSubjects = selectedMatches
    .map((subject) => {
      const entryAbilities = [...advantages]
        .sort((left, right) => {
          const leftNeed = subject.tasks.reduce((total, item) => total + item.task.abilityWeights[left], 0)
          const rightNeed = subject.tasks.reduce((total, item) => total + item.task.abilityWeights[right], 0)
          return rightNeed - leftNeed
        })
      return {
        subject: subject.subject,
        signal: Math.round(subject.fit * 100),
        entryAbilities,
        tasks: knowledgeGraphForSubject(subject.subject).map((graphModule) => {
          const sourceTopics: readonly KnowledgeGraphTopic[] = graphModule.topics.length
            ? graphModule.topics
            : [{ name: graphModule.name, score: graphModule.score }]
          const graphTopics: KnowledgeGraphTopicResult[] = sourceTopics.map((topic) => {
            const mapping = resolveKnowledgeTaskAbility(subject.subject, graphModule.name, topic)
            const abilityDimensions = [...mapping.primary]
            const entryDimensions = [...mapping.entry]
            const support = requirementSupport(abilityDimensions, entryDimensions, observations, classificationPolicy, taskLearningContext(mapping.learningRuleId,abilityDimensions,entryDimensions))
            if (mapping.source.startsWith('subject-framework:')) { support.status = 'unknown'; support.pendingReason = 'insufficient' }
            const matchedAbilities = support.primarySupported
            const matchedEntryAbilities = support.entrySupported
            return {
              ...topic,
              support,
              abilityDimensions,
              entryDimensions,
              abilityFocus: abilityDimensions.map((dimension) => dimensionLabels[dimension]).join('、'),
              matchedAbilities,
              matchedEntryAbilities,
              displayScore: formatKnowledgeTaskScore(topic.score),
              typicalAction: mapping.typicalAction,
              mechanisms: mapping.mechanisms,
              mappingBasis: mapping.basis,
              reviewStatus: mapping.reviewStatus,
              mappingSource: mapping.source,
              strategy: taskStrategyForStatus[support.status],
            }
          })
          return {
            label: graphModule.name,
            graphModule: graphModule.name,
            graphScore: graphModule.score,
            graphTopics,
            abilityFocus: [...new Set(graphTopics.flatMap((topic) => topic.abilityDimensions))]
              .map((dimension) => dimensionLabels[dimension]).join('、'),
            strategy: '',
          }
        }),
      }
    })
    .sort((left, right) => selected
      ? (selectedOrder.get(left.subject) ?? Number.MAX_SAFE_INTEGER) - (selectedOrder.get(right.subject) ?? Number.MAX_SAFE_INTEGER)
      : 0)
  const subjectTaskPlan: SubjectTaskPlan[] = rankedSubjects.map((subject): SubjectTaskPlan => {
    const groups: SubjectTaskPlan['groups'] = (['优势直接参与', '需要带动其他元能力', '可以借优势进入', '重点练习', '暂不判断'] as const).map((label) => ({
      label,
      tasks: subject.tasks.flatMap((task) => {
        const graphTopics = task.graphTopics.filter((topic) => topic.strategy === label)
        if (!graphTopics.length) return []
        const abilityFocus = [...new Set(graphTopics.flatMap((topic) => topic.abilityDimensions))]
          .map((dimension) => dimensionLabels[dimension]).join('、')
        return [{
          ...task,
          graphTopics,
          abilityFocus,
          strategy: label === '优势直接参与'
            ? '你目前更顺手的元能力，是完成这些任务时会直接用到的主要元能力。'
            : label === '可以借优势进入'
              ? '你的优势不是完成任务的全部，但可以帮你先看懂、画清或理顺。'
              : '这些任务的主要要求尚未得到支持，且缺少相关优势入口，需要专项练习。',
        }]
      }),
    }))
    return { subject: subject.subject, groups }
  })
  const selectedSubjectNames = selectedSubjects?.length
    ? [...new Set(selectedSubjects)].filter((subject) => subject !== (foreignLanguage === '英语' ? '日语' : '英语'))
    : (Object.keys(subjectAbilityBaseline) as SubjectName[]).filter((subject) => subject !== (foreignLanguage === '英语' ? '日语' : '英语'))
  const opportunityDimensions = dimensions.filter(d => requirementSupport([d],[],observations).status === 'supported')
  const observedDimensions = dimensionSummary.filter(d => d.evidenceQuality === '证据充分').map(d => d.dimension)
  const subjectOpportunityPlan: SubjectOpportunityResult[] = selectedSubjectNames.map((subject) => {
    const demand = subjectAbilityBaseline[subject]
    const highest = Math.max(...dimensions.map((dimension) => demand[dimension]))
    const requiredAbilities = dimensions.filter((dimension) => demand[dimension] >= 3)
      .sort((left, right) => demand[right] - demand[left])
    const coreAbilities = dimensions.filter((dimension) => demand[dimension] >= 4)
      .sort((left, right) => demand[right] - demand[left])
    const directCoreMatches = opportunityDimensions.filter((dimension) => demand[dimension] === highest)
      .sort((left, right) => demand[right] - demand[left])
    const keyAbilities = requiredAbilities.filter(d => demand[d] === highest)
    const uncoveredKeyAbilities = keyAbilities.filter(d => !opportunityDimensions.includes(d))
    const unobservedAbilities = requiredAbilities.filter(d => !observedDimensions.includes(d))
    const supportingAdvantageMatches = opportunityDimensions.filter((dimension) => demand[dimension] >= 3 && demand[dimension] < highest)
      .sort((left, right) => demand[right] - demand[left])
    const matchedAbilities = [...directCoreMatches, ...supportingAdvantageMatches]
    const otherAbilities = requiredAbilities.filter((dimension) => !opportunityDimensions.includes(dimension))
    const support = requirementSupport(keyAbilities, requiredAbilities.filter(d => !keyAbilities.includes(d)), observations, classificationPolicy, subjectLearningContext(subject,keyAbilities,requiredAbilities))
    const tier: SubjectOpportunityTier = subjectTierForStatus[support.status]
    const reason = tier === '待了解区' ? '主要要求的作答信息不足，暂不判断。' : tier === '优势发挥区' ? '学科主要要求的元能力在本次任务中都表现较顺手。' : tier === '待发展区' ? '主要要求存在未支持项，且没有得到支持的相关元能力提供借力入口，需要专项练习。' : '主要要求尚未全部得到支持，但已有元能力可直接参与，提供借力入口。'
    return { subject, support, tier, requiredAbilities, coreAbilities, keyAbilities, uncoveredKeyAbilities, unobservedAbilities, matchedAbilities, directCoreMatches, supportingAdvantageMatches, otherAbilities, reason }
  })
  const subjects: SubjectResult[] = rankedSubjects
  return {
    conclusion: relativeDimensions.length === 5
      ? '这次五组任务得分相同，不单独挑出某一项。可以按当前学习内容，选择下面适合的方法。'
      : advantages.length > 2
      ? `这次测评中，${advantages.map(d => dimensionLabels[d]).join('、')}这${advantages.length}组任务得分相对较高。它们都可以用于下面的学科学习，不必只选两项。`
      : advantage.clarity === '双优势清楚'
      ? `这次测评中，${dimensionLabels[advantages[0]]}和${dimensionLabels[advantages[1]]}两组任务得分相对较高。学习时可以尝试：先${learningTaskMeanings[advantages[0]]}，再${learningTaskMeanings[advantages[1]]}。`
      : advantage.clarity === '单优势清楚'
        ? `这次测评中，${dimensionLabels[advantages[0]]}这组任务得分相对较高。学习时可以尝试从${learningTaskMeanings[advantages[0]]}开始。`
        : relativeDimensions.length
          ? relativeDimensions.length === 2 ? `本次任务中，${dimensionLabels[relativeDimensions[0]]}和${dimensionLabels[relativeDimensions[1]]}两组得分相对较高，还不能据此判断你的优势。学习时可以尝试：${learningTaskMeanings[relativeDimensions[0]]}，再${learningTaskMeanings[relativeDimensions[1]]}。` : `本次任务中，${relativeDimensions.map(d => dimensionLabels[d]).join('、')}得分相对较高，还不能据此判断你的优势。下面列出可以尝试的学习方法。`
          : '这次还看不出你特别擅长哪类任务。可以先挑下面的一种学习方法试试。',
    primary,
    secondary,
    advantageClarity: advantage.clarity,
    advantageDimensions: advantage.dimensions,
    relativeDimensions,
    dimensionSummary,
    mechanismSummary: dimensionSummary.flatMap((item) => item.mechanisms),
    subjects,
    subjectOpportunityPlan,
    subjectTaskPlan,
  }
}

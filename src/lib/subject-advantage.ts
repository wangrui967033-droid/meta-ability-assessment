import { classificationPolicy } from './classification-policy'
import { requirementSupport, subjectTierForStatus, type AbilityObservations } from './requirement-support'
import type { AbilityWeights, MechanismKey, SubjectName, SubjectTaskMap } from '../data/subject-task-map'
import { taskMapForStudent } from '../data/subject-task-map'
import type { ForeignLanguage } from '../data/assessment-types'

/**
 * 这是用户确认的「学科 × 五元能力」底盘表。
 * 1–5 不是学生分数，也绝不直接展示给学生；它表示该学科整体上会多大程度调用该元能力。
 */
export const subjectAbilityBaseline: Readonly<Record<SubjectName, AbilityWeights>> = {
  语文: { memory: 4, language: 5, quantitative: 1, space: 2, reasoning: 5 },
  数学: { memory: 3, language: 2, quantitative: 5, space: 4, reasoning: 5 },
  英语: { memory: 5, language: 5, quantitative: 1, space: 1, reasoning: 4 },
  日语: { memory: 5, language: 5, quantitative: 1, space: 1, reasoning: 4 },
  物理: { memory: 4, language: 2, quantitative: 5, space: 4, reasoning: 5 },
  化学: { memory: 5, language: 3, quantitative: 4, space: 3, reasoning: 5 },
  生物: { memory: 5, language: 4, quantitative: 3, space: 2, reasoning: 5 },
  历史: { memory: 5, language: 5, quantitative: 1, space: 3, reasoning: 5 },
  政治: { memory: 5, language: 5, quantitative: 1, space: 1, reasoning: 5 },
  地理: { memory: 4, language: 3, quantitative: 3, space: 5, reasoning: 5 },
  技术: { memory: 4, language: 3, quantitative: 3, space: 4, reasoning: 5 },
}

/** 服务端把测评证据换算为 0–1 的相对表现；学生端不显示原始值。 */
export interface StudentAbilityProfile {
  dimensions: AbilityWeights
  mechanisms?: Partial<Record<MechanismKey, number>>
}

export interface AdvantageTask {
  task: SubjectTaskMap
  fit: number
}

export interface AdvantageSubject {
  subject: SubjectName
  /** 仅用于服务端分组和排序，学生端显示“优势较容易发挥”等文字。 */
  fit: number
  /** 学生最突出的两项元能力，能覆盖该科任务要求的比例。 */
  advantageCoverage: number
  tasks: readonly AdvantageTask[]
}

const sum = (weights: AbilityWeights) => Object.values(weights).reduce((total, value) => total + value, 0)

const dimensions: readonly (keyof AbilityWeights)[] = ['memory', 'language', 'quantitative', 'space', 'reasoning']

export type SubjectOpportunityTier = '优势发挥区' | '优势借力区' | '待发展区' | '待了解区'

/**
 * 03 的整门学科分区只读取固定的「学科 × 五元能力」底盘。
 * 最高需求项须全部覆盖才进入第一类；部分覆盖或有需求≥3的支持项进入第二类。
 * 未覆盖不等于低元能力；所需元能力证据不足时不作分类判断；充分观察但没有支持项则为待发展。
 * 它不读取知识图谱节点数量，也不读取 04 的分类结果。
 */
export const classifySubjectOpportunity = (
  required: AbilityWeights,
  advantages: readonly (keyof AbilityWeights)[],
  observed: readonly (keyof AbilityWeights)[] = dimensions,
): SubjectOpportunityTier => {
  const highest = Math.max(...dimensions.map(d => required[d]))
  const primary = dimensions.filter(d => required[d] === highest)
  const entry = dimensions.filter(d => required[d] >= 3 && !primary.includes(d))
  const observations = Object.fromEntries(dimensions.map(d => [d,{score:advantages.includes(d)?1:0,sufficient:observed.includes(d)}])) as AbilityObservations
  return subjectTierForStatus[requirementSupport(primary,entry,observations,classificationPolicy,{essential:primary,paths:[...primary,...entry].map(ability=>({ability,action:'按明确的学科要求参与对应步骤'}))}).status]
}

/** 学科任务平均会调用哪些元能力；基础任务与综合任务使用同一套规则。 */
export const subjectTaskAbilityProfile = (subject: SubjectName): AbilityWeights => {
  const tasks = taskMapForStudent(subject === '日语' ? '日语' : '英语')
    .filter((task) => task.subject === subject)
  if (!tasks.length) return subjectAbilityBaseline[subject]
  return Object.fromEntries(dimensions.map((dimension) => [
    dimension,
    tasks.reduce((total, task) => total + task.abilityWeights[dimension], 0) / tasks.length,
  ])) as unknown as AbilityWeights
}

/** 将“学生当前表现”与“任务/学科所需元能力”按权重求匹配度。 */
export const dimensionFit = (student: AbilityWeights, required: AbilityWeights): number => {
  const denominator = sum(required)
  if (denominator === 0) return 0
  return (
    student.memory * required.memory
    + student.language * required.language
    + student.quantitative * required.quantitative
    + student.space * required.space
    + student.reasoning * required.reasoning
  ) / denominator
}

const mechanismFit = (profile: StudentAbilityProfile, task: SubjectTaskMap): number | null => {
  if (!profile.mechanisms) return null
  const available = task.mechanisms
    .map((mechanism) => profile.mechanisms?.[mechanism])
    .filter((value): value is number => typeof value === 'number')
  if (available.length === 0) return null
  return available.reduce((total, value) => total + value, 0) / available.length
}

/**
 * 先由学科底盘选出“优势较容易发挥”的学科，再以图谱任务细化。
 * 不用固定阈值分组：V1 的分界由校准配置传入，避免把未经校准的数值伪装成结论。
 */
export const matchAdvantageSubjects = (
  profile: StudentAbilityProfile,
  foreignLanguage: ForeignLanguage,
): readonly AdvantageSubject[] => {
  const tasks = taskMapForStudent(foreignLanguage)
  const subjects = [...new Set(tasks.map((task) => task.subject))]
  const topDimensions = [...dimensions].sort((left, right) => profile.dimensions[right] - profile.dimensions[left]).slice(0, 2)

  return subjects
    .map((subject) => {
      const matchedTasks = tasks
        .filter((task) => task.subject === subject)
        .map((task) => {
          const byDimension = dimensionFit(profile.dimensions, task.abilityWeights)
          const byMechanism = mechanismFit(profile, task)
          // 机制证据存在时用于细化任务选择；没有时只用五元能力，不制造缺失数据。
          const fit = byMechanism === null ? byDimension : byDimension * .7 + byMechanism * .3
          return { task, fit }
        })
        .sort((a, b) => b.fit - a.fit)

      const bestTaskFit = matchedTasks.slice(0, 2).reduce((total, item) => total + item.fit, 0) / Math.min(2, matchedTasks.length)
      const bySubjectBaseline = dimensionFit(profile.dimensions, subjectAbilityBaseline[subject])
      const taskProfile = subjectTaskAbilityProfile(subject)
      const advantageCoverage = topDimensions.reduce((total, dimension) => total + taskProfile[dimension], 0) / sum(taskProfile)
      return {
        subject,
        // “优势学科”既要符合总体学科底盘，也要能落到该科的具体图谱任务。
        fit: bySubjectBaseline * .65 + bestTaskFit * .35,
        advantageCoverage,
        tasks: matchedTasks,
      }
    })
    .sort((a, b) => b.fit - a.fit)
}

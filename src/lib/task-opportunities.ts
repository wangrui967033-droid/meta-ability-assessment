import { taskLearningContext } from '../data/task-learning-paths'
import { classificationPolicy } from './classification-policy'
import { requirementSupport, type AbilityObservations, type RequirementStatus, type PendingReason } from './requirement-support'
import type { Dimension, ScoredEvidence } from './assessment'
import type { KnowledgeTaskAbilityMapping } from '../data/knowledge-task-ability-map'

export type TaskMatchStatus = RequirementStatus
export const taskMatchLabels: Record<TaskMatchStatus, string> = {
  supported: '优势可发挥任务', entry: '可借力任务', attention: '待发展任务', unknown: '暂不判断',
}
export interface EvidenceScore {
  samples?: {score:number;mechanism:string}[]
  raw: number | null
  calibrated: number | null
  count: number
  sufficient: boolean
}
export interface TaskEvidenceProfile {
  dimensions: Record<Dimension, EvidenceScore>
  mechanisms: Record<string, EvidenceScore>
}
export interface TaskMatch {
  status: TaskMatchStatus
  pendingReason?: PendingReason
  stabilityReview?: Dimension[]
  supportedAbilities: Dimension[]
  missing: string[]
  attention: string[]
  reason: string
  scoreVersion: 'raw-task-reference-v1'
}

const valid = (e: ScoredEvidence) => Number.isFinite(e.nodeScore.earned) && Number.isFinite(e.nodeScore.possible)
  && e.nodeScore.possible > 0 && e.nodeScore.earned >= 0 && e.nodeScore.earned <= e.nodeScore.possible

export function taskEvidenceProfile(evidence: ScoredEvidence[], definitions: Record<Dimension, Array<{name: string}>>): TaskEvidenceProfile {
  const unique = new Map<string, ScoredEvidence>()
  const conflicts = new Set<string>()
  for (const e of evidence) {
    const previous = unique.get(e.taskId)
    if (previous && (previous.dimension !== e.dimension || previous.mechanism !== e.mechanism || previous.nodeScore.earned !== e.nodeScore.earned || previous.nodeScore.possible !== e.nodeScore.possible)) conflicts.add(e.taskId)
    unique.set(e.taskId, e)
  }
  const usable = [...unique.values()].filter(e => !conflicts.has(e.taskId) && valid(e))
  const summarize = (items: ScoredEvidence[]): EvidenceScore => ({raw: items.length ? items.reduce((n,e)=>n+e.nodeScore.earned/e.nodeScore.possible,0)/items.length : null, calibrated: null, count: items.length, sufficient: items.length >= 2})
  const mechanisms: Record<string, EvidenceScore> = {}
  const dimensions = {} as Record<Dimension, EvidenceScore>
  for (const [dimension, definitionsForDimension] of Object.entries(definitions)) {
    for (const definition of definitionsForDimension) mechanisms[definition.name] = summarize(usable.filter(e=>e.dimension===dimension && e.mechanism===definition.name))
    const scores = definitionsForDimension.map(d=>mechanisms[d.name])
    const observed = scores.filter(s=>s.raw !== null)
    dimensions[dimension as Dimension] = {
      raw: observed.length ? observed.reduce((n,s)=>n+s.raw!,0)/observed.length : null,
      samples:usable.filter(e=>e.dimension===dimension).map(e=>({score:e.nodeScore.earned/e.nodeScore.possible,mechanism:e.mechanism})),
      calibrated: null, count: scores.reduce((n,s)=>n+s.count,0),
      sufficient: scores.length === 3 && scores.every(s=>s.sufficient),
    }
  }
  return {dimensions, mechanisms}
}

export function matchKnowledgeEvidence(mapping: KnowledgeTaskAbilityMapping, profile: TaskEvidenceProfile, labels: Record<Dimension,string>): TaskMatch {
  // 兼容旧调用入口；不再独立使用子机制分数生成另一套分类。
  const observations = Object.fromEntries(Object.entries(profile.dimensions).map(([d,s])=>[d,{score:s.raw ?? Number.NaN,sufficient:s.sufficient,samples:s.samples}])) as unknown as AbilityObservations
  const support = requirementSupport(mapping.primary,mapping.entry,observations,classificationPolicy,taskLearningContext(mapping.learningRuleId,mapping.primary,mapping.entry))
  const status = mapping.source.startsWith('subject-framework:') ? 'unknown' : support.status
  const pendingReason = mapping.source.startsWith('subject-framework:') ? 'insufficient' : support.pendingReason
  const supportedAbilities = [...new Set([...support.primarySupported,...support.entrySupported])]
  const missing = support.missing.map(d=>labels[d])
  const attention = support.attention.map(d=>labels[d])
  const reason = {supported:'主要要求均得到本次表现支持。',entry:'主要要求未全部得到支持，但有相关元能力可以直接参与。',attention:'主要要求缺少支持，且没有相关优势提供借力入口。',unknown:'作答信息或任务映射不足，暂不分类。'}[status]
  return {status,pendingReason,stabilityReview:support.stabilityReview,supportedAbilities,missing,attention,reason,scoreVersion:'raw-task-reference-v1'}
}

export interface TaskSummaryItem { name: string; module: string; status: TaskMatchStatus }
export interface TaskOpportunitySummary {
  basis: 'catalog-descriptive'
  counts: Record<TaskMatchStatus, number>
  supported: TaskSummaryItem[]
  entry: TaskSummaryItem[]
  attention: TaskSummaryItem[]
  unknown: TaskSummaryItem[]
  modules: Array<{name: string; counts: Record<TaskMatchStatus, number>}>
}
export function summarizeTaskOpportunities(items: TaskSummaryItem[]): TaskOpportunitySummary {
  // No subject fit, ranking or percent: catalog entries are not independent
  // tasks and their exam-point annotations are not validated importance weights.
  const summary: TaskOpportunitySummary = {basis:'catalog-descriptive',counts:{supported:0,entry:0,attention:0,unknown:0},supported:[],entry:[],attention:[],unknown:[],modules:[]}
  for (const item of items) {
    if (summary[item.status].some(e=>e.name===item.name && e.module===item.module)) continue
    summary[item.status].push(item)
    summary.counts[item.status]++
    let module = summary.modules.find(m=>m.name===item.module)
    if (!module) {module={name:item.module,counts:{supported:0,entry:0,attention:0,unknown:0}};summary.modules.push(module)}
    module.counts[item.status]++
  }
  return summary
}

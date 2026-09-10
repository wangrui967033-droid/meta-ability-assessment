import type { Dimension } from '../data/assessment-types'
import { classificationPolicy } from './classification-policy'

export interface ObservedAbility { score: number; sufficient: boolean; samples?: readonly {score:number;mechanism:string}[] }
export interface LeveragePath { ability:Dimension; action:string }
export interface RequirementContext { essential:readonly Dimension[]; paths:readonly LeveragePath[] }
export type SupportDetail = 'supported' | 'mixed' | 'gap' | 'missing'
export type AbilityObservations = Record<Dimension, ObservedAbility>
export type RequirementStatus = 'supported' | 'entry' | 'attention' | 'unknown'
// 只有作答/映射信息不足才待定；临界稳定性另存 stabilityReview。
export type PendingReason = 'insufficient'
export const subjectTierForStatus = {supported:'优势发挥区',entry:'优势借力区',attention:'待发展区',unknown:'待了解区'} as const
export const taskStrategyForStatus = {supported:'优势直接参与',entry:'可以借优势进入',attention:'需要带动其他元能力',unknown:'暂不判断'} as const
export interface RequirementSupport {
  status: RequirementStatus
  pendingReason?: PendingReason
  stabilityReview?: Dimension[]
  primarySupported: Dimension[]
  entrySupported: Dimension[]
  missing: Dimension[]
  attention: Dimension[]
  practice: Dimension[]
  details: Partial<Record<Dimension,SupportDetail>>
  usablePaths: LeveragePath[]
  blocked: Dimension[]
}

// 主要/辅助要求必须来自明确的任务映射；仅在这些要求内检查借力入口。
// “entry”表示存在直接参与路径，不表示优势能替代未支持要求或保证得分。
export function requirementSupport(primary: readonly Dimension[], entry: readonly Dimension[], observations: AbilityObservations, policy = classificationPolicy, context:RequirementContext = {essential:primary,paths:[]}): RequirementSupport {
  if (!Number.isFinite(policy.supportThreshold) || policy.supportThreshold <= 0 || policy.supportThreshold > 1) throw new RangeError('Invalid support threshold')
  const required = [...new Set([...primary, ...entry,...context.essential])]
  const observed = (d: Dimension) => observations[d]?.sufficient && Number.isFinite(observations[d].score) && observations[d].score >= 0 && observations[d].score <= 1
  const details: Partial<Record<Dimension,SupportDetail>> = {}
  const stabilityReview: Dimension[] = []
  for(const d of required){
    const value=observations[d]
    if(!observed(d)){details[d]='missing';continue}
    const samples=value.samples
    if(samples && (samples.length<2 || samples.some(s=>!Number.isFinite(s.score)||s.score<0||s.score>1))){details[d]='missing';continue}
    // 多题重复未得分是缺口信号，不引入新的低分百分比线。
    const mechanisms=[...new Set(samples?.map(s=>s.mechanism)??[])]
    const repeatedZero=mechanisms.some(m=>{const subset=samples!.filter(s=>s.mechanism===m);return subset.length >= (policy.minimumRepeatedEvidence??2) && subset.every(s=>s.score===0)})
    if(value.score===0 || repeatedZero){details[d]='gap';continue}
    // 留一组稳定性只记录内部复核，不再作为分类门槛；不是统计置信区间。
    const lower=samples ? Math.min(...samples.map((_,i)=>samples.filter((__,j)=>i!==j).reduce((n,s)=>n+s.score,0)/(samples.length-1))) : value.score
    const upper=samples ? Math.max(...samples.map((_,i)=>samples.filter((__,j)=>i!==j).reduce((n,s)=>n+s.score,0)/(samples.length-1))) : value.score
    if(lower < policy.supportThreshold && upper >= policy.supportThreshold) stabilityReview.push(d)
    details[d]=value.score>=policy.supportThreshold ? 'supported' : 'mixed'
  }
  const supported = (d: Dimension) => details[d]==='supported'
  const primarySupported = primary.filter(supported)
  const entrySupported = entry.filter(supported)
  const missing = required.filter(d => details[d]==='missing')
  const attention = required.filter(d => details[d]==='gap')
  const practice = required.filter(d => details[d]==='mixed')
  const blocked=context.essential.filter(d=>details[d]==='gap')
  const usablePaths=blocked.length?[]:context.paths.filter(p=>required.includes(p.ability)&&supported(p.ability)&&p.action.trim().length>0)
  const status = !primary.length || missing.length ? 'unknown'
    : blocked.length ? 'attention'
    : primary.every(supported) && context.essential.every(supported) ? 'supported'
    : usablePaths.length ? 'entry'
    : 'attention'
  const pendingReason: PendingReason | undefined = status === 'unknown' ? 'insufficient' : undefined
  return {status, pendingReason, stabilityReview, primarySupported, entrySupported, missing, attention, practice, details, usablePaths, blocked}
}

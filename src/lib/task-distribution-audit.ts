import type { Dimension } from '../data/assessment-types'
import type { PendingReason, RequirementStatus } from './requirement-support'

export interface AuditTask {
  id:string
  status:RequirementStatus
  pendingReason?:PendingReason
  required:Dimension[]
  paths:string[]
}
// 验收预警线，不参与学生分类，也不是科学常模；待内测调整。
export const distributionAuditPolicy = { bulkChangeRatio:0.25 } as const

export function auditTaskTransition(before:AuditTask[],after:AuditTask[],changedAbilities:Dimension[],policy=distributionAuditPolicy){
  const previous=new Map(before.map(t=>[t.id,t]))
  if(previous.size!==before.length || new Set(after.map(t=>t.id)).size!==after.length || before.length!==after.length || after.some(t=>!previous.has(t.id))) throw new Error('Task catalogs differ or contain duplicate IDs')
  const items=after.flatMap(next=>{
    const old=previous.get(next.id)!
    return old.status!==next.status || old.pendingReason!==next.pendingReason ? [{id:next.id,before:old,after:next}] : []
  })
  const transitions:Record<string,number>={}
  for(const item of items){const key=`${item.before.status}→${item.after.status}`;transitions[key]=(transitions[key]??0)+1}
  const unexplained=items.filter(item=>!changedAbilities.some(d=>item.before.required.includes(d)||item.after.required.includes(d))).map(item=>item.id)
  const ratio=before.length?items.length/before.length:0
  return {total:before.length,changed:items.length,ratio,bulkWarning:ratio>policy.bulkChangeRatio,transitions,unexplained,items}
}

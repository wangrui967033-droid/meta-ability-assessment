import { expect, it } from 'vitest'
import { requirementSupport, type AbilityObservations } from './requirement-support'
import { classificationPolicy } from './classification-policy'
import { buildPrototypeReport, type ScoredEvidence } from './assessment'
const profile = (score:number, samples:number[]) => Object.fromEntries(['memory','language','quantitative','space','reasoning'].map(d=>[d,{score,sufficient:true,samples:samples.map((value,i)=>({score:value,mechanism:String(i%3)}))}])) as unknown as AbilityObservations
it('keeps complete evidence classified through the threshold without rounding up',()=>{
 for(const score of [.67,.74999,.75,.83]){
   const result=requirementSupport(['reasoning'],[],profile(score,[score,score,score,score,score,score]))
   expect(result.status).toBe(score>=.75?'supported':'attention')
   expect(result.pendingReason).toBeUndefined()
 }
})
it('classifies a complete threshold profile while retaining its stability review',()=>{
 const result=requirementSupport(['reasoning'],[],profile(.75,[1,1,1,.5,.5,.5]))
 expect(result).toMatchObject({status:'supported',stabilityReview:['reasoning']})
 const missing=profile(.75,[1,1,1,.5,.5,.5]);missing.reasoning.sufficient=false
 expect(requirementSupport(['reasoning'],[],missing)).toMatchObject({status:'unknown',pendingReason:'insufficient'})
})
it('does not treat an empty action as an effective leverage path',()=>{
 const p=profile(.5,[.5,.5,.5,.5,.5,.5]);p.reasoning=profile(1,[1,1,1,1,1,1]).reasoning
 expect(requirementSupport(['quantitative'],['reasoning'],p,classificationPolicy,{essential:['quantitative'],paths:[{ability:'reasoning',action:'  '}]}).status).toBe('attention')
})
it('does not grant an advantage while an explicit essential requirement is unsupported',()=>{
 const p=profile(.5,[.5,.5,.5,.5,.5,.5]);p.reasoning=profile(1,[1,1,1,1,1,1]).reasoning
 const result=requirementSupport(['reasoning'],['language'],p,classificationPolicy,{essential:['reasoning','language'],paths:[{ability:'reasoning',action:'连接材料中的条件与结论'}]})
 expect(result.status).toBe('entry')
})
it('does not count repeated submissions as independent evidence',()=>{
 const base:ScoredEvidence={taskId:'same',position:1,dimension:'reasoning',mechanism:'发现关系',role:'direct',nodeScore:{earned:1,possible:1},diagnosticPoints:[],durationMs:1000}
 const r=buildPrototypeReport(Array.from({length:6},(_,i)=>({...base,mechanism:i%2?'发现关系':'推出结论'})),'英语',['数学'])
 expect(r.dimensionSummary.find(d=>d.dimension==='reasoning')?.evidenceQuality).toBe('证据不足')
})
it('does not use leave-one-out stability as a classification gate',()=>{
 const p=profile(.75,[1,1,1,.5,.5,.5])
 expect(requirementSupport(['reasoning'],[],p).status).toBe('supported')
})
it('does not bypass an observed zero core with auxiliary full marks',()=>{
 const p=profile(1,[1,1,1,1,1,1]);p.quantitative={score:0,sufficient:true,samples:[0,0,0,0,0,0].map((score,i)=>({score,mechanism:String(i%3)}))}
 expect(requirementSupport(['quantitative'],['reasoning'],p).status).toBe('attention')
})
it('permits a documented path when the core has partial evidence and no repeated-zero gap',()=>{
 const p=profile(.65,[.5,.5,.5,1,1,.5]);p.reasoning={score:1,sufficient:true,samples:[1,1,1,1,1,1].map((score,i)=>({score,mechanism:String(i%3)}))}
 const result=requirementSupport(['quantitative'],['reasoning'],p,classificationPolicy,{essential:['quantitative'],paths:[{ability:'reasoning',action:'列出数量之间的关系'}]})
 expect(result.status).toBe('entry');expect(result.usablePaths[0].action).toBe('列出数量之间的关系')
})
it('distinguishes a supported threshold from repeated zero performance',()=>{
 expect(requirementSupport(['reasoning'],[],profile(.75,[1,1,1,.5,.5,.5])).details.reasoning).toBe('supported')
 expect(requirementSupport(['reasoning'],[],profile(0,[0,0,0,0,0,0])).details.reasoning).toBe('gap')
})
it('directly classifies a supported primary requirement without needing a leverage path',()=>{
 const result=requirementSupport(['reasoning'],[],profile(.75,[1,1,1,.5,.5,.5]))
 expect(result.status).toBe('supported')
 expect(result.stabilityReview).toContain('reasoning')
 expect(result.attention).toEqual([])
})

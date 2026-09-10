import { expect, it } from 'vitest'
import { requirementSupport, type AbilityObservations } from './requirement-support'
import { buildPrototypeReport } from './assessment'
import { assessmentTasksV16 } from '../data/assessment-bank-v1.6'
const observations = (quantitative = .9): AbilityObservations => ({memory:{score:.9,sufficient:true}, language:{score:.9,sufficient:true}, space:{score:.9,sufficient:true}, reasoning:{score:1,sufficient:true}, quantitative:{score:quantitative,sufficient:true}})
it('requires all primary support and explicit paths for partial support', () => {
 expect(requirementSupport(['reasoning','quantitative'],[],observations()).status).toBe('supported')
 expect(requirementSupport(['reasoning','quantitative'],[],observations(.2)).status).toBe('attention')
})
it('distinguishes auxiliary support, observed zero, and missing evidence', () => {
 expect(requirementSupport(['quantitative'],['reasoning'],observations(.2)).status).toBe('attention')
 expect(requirementSupport(['quantitative'],['reasoning'],observations(0)).status).toBe('attention')
 const missing = observations(0); missing.quantitative.sufficient=false
 const result=requirementSupport(['quantitative'],['reasoning'],missing)
 expect(result.status).toBe('unknown'); expect(result.attention).toEqual([])
})
it('withholds classification for missing auxiliary observations', () => {
 const profile=observations();profile.memory.sufficient=false
 const result=requirementSupport(['reasoning'],['memory'],profile)
 expect(result.status).toBe('unknown');expect(result.missing).toEqual(['memory'])
})
function report(quantitative:number, all=.9) {
 return buildPrototypeReport(assessmentTasksV16.map(task=>({taskId:task.id,position:task.position,dimension:task.dimension,mechanism:task.mechanism,role:task.role,nodeScore:{earned:task.dimension==='quantitative'?quantitative:all,possible:1},diagnosticPoints:[],durationMs:18000})), '英语', ['数学','数学','物理','语文'])
}
it('uses balanced high performance in both report layers without needing relative highlights',()=>{
 const r=report(.9)
 expect(r.advantageDimensions).toEqual([])
 expect(r.subjectOpportunityPlan).toHaveLength(3)
 expect(r.subjectOpportunityPlan.every(s=>s.tier==='优势发挥区')).toBe(true)
 expect(r.subjectTaskPlan).toHaveLength(3)
 expect(r.subjects.flatMap(s=>s.tasks.flatMap(t=>t.graphTopics)).some(t=>t.support.status==='supported')).toBe(true)
})
it('keeps quantitative practice visible when reasoning is strong',()=>{
 const r=report(.2,1)
 const math=r.subjectOpportunityPlan.find(s=>s.subject==='数学')!
 expect(math.tier).toBe('优势借力区')
 expect(math.support.practice).toContain('quantitative')
 expect(math.support.attention).toEqual([])
})

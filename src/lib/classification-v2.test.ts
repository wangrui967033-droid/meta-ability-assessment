import { expect, it } from 'vitest'
import { requirementSupport, type AbilityObservations } from './requirement-support'
import { classifySubjectOpportunity, subjectAbilityBaseline } from './subject-advantage'
import { buildPrototypeReport } from './assessment'
import { assessmentTasksV16 } from '../data/assessment-bank-v1.6'
const profile = (): AbilityObservations => ({memory:{score:.4,sufficient:true},language:{score:.5,sufficient:true},quantitative:{score:.2,sufficient:true},space:{score:.5,sufficient:true},reasoning:{score:1,sufficient:true}})
it('distinguishes fully observed no-support subjects from missing evidence in the compatibility API',()=>{
 expect(classifySubjectOpportunity(subjectAbilityBaseline.数学,[])).toBe('待发展区')
 expect(classifySubjectOpportunity(subjectAbilityBaseline.数学,[],[])).toBe('待了解区')
})
it('requires an explicit path before borrowing a supported requirement',()=>{
 expect(requirementSupport(['reasoning','quantitative'],[],profile()).status).toBe('attention')
})
it('does not compensate for a zero core',()=>{
 const p=profile();p.quantitative.score=0
 expect(requirementSupport(['quantitative'],['reasoning'],p).status).toBe('attention')
})
it('does not compensate with an unrelated strength',()=>{
 expect(requirementSupport(['quantitative'],['memory'],profile()).status).toBe('attention')
})
it('withholds classification if a mapped requirement is missing',()=>{
 const p=profile();p.memory.sufficient=false
 expect(requirementSupport(['reasoning'],['memory'],p).status).toBe('unknown')
})
it('uses a configurable boundary without rounding scores first',()=>{
 const p=profile();p.reasoning.score=.7499
 expect(requirementSupport(['reasoning'],[],p).status).toBe('attention')
 expect(requirementSupport(['reasoning'],[],p,{supportThreshold:.7}).status).toBe('supported')
 p.reasoning.score=.75
 expect(requirementSupport(['reasoning'],[],p).status).toBe('supported')
 expect(()=>requirementSupport(['reasoning'],[],p,{supportThreshold:0})).toThrow(RangeError)
})
it.each([
 {score:.9, reasoning:.9, tier:'优势发挥区'},
 {score:.2, reasoning:1, tier:'优势借力区'},
 {score:.2, reasoning:.2, tier:'待发展区'},
])('keeps subject, task and support states aligned: $tier',({score,reasoning,tier})=>{
 const evidence=assessmentTasksV16.map(t=>({taskId:t.id,position:t.position,dimension:t.dimension,mechanism:t.mechanism,role:t.role,nodeScore:{earned:t.dimension==='reasoning'?reasoning:score,possible:1},diagnosticPoints:[],durationMs:18000}))
 const report=buildPrototypeReport(evidence,'英语',['数学'])
 expect(report.subjectOpportunityPlan[0].tier).toBe(tier)
 const topics=report.subjects.flatMap(s=>s.tasks.flatMap(t=>t.graphTopics))
 expect(topics.length).toBeGreaterThan(0)
 for(const topic of topics){
   if(topic.support.status==='supported') expect(topic.strategy).toBe('优势直接参与')
   if(topic.support.status==='entry') expect(topic.strategy).toBe('可以借优势进入')
   if(topic.support.status==='attention') expect(topic.strategy).toBe('需要带动其他元能力')
   if(topic.support.status==='unknown') expect(topic.strategy).toBe('暂不判断')
 }
})

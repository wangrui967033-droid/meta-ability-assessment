import {render, screen} from '@testing-library/react'
import {expect, it} from 'vitest'
import Report from '../components/Report'
import {buildPrototypeReport, type ScoredEvidence} from './assessment'

const dims=['memory','language','quantitative','space','reasoning'] as const
function evidence(scores:number[]):ScoredEvidence[]{return dims.flatMap((dimension,d)=>Array.from({length:6},(_,i)=>({taskId:`${dimension}-${i}`,position:d*6+i+1,dimension,mechanism:`${dimension}-${i%3}`,role:'direct' as const,nodeScore:{earned:scores[d],possible:1},diagnosticPoints:[],durationMs:18000})))}

it.each([
 [[.3,.9,.3,.3,.3],['language']],
 [[.3,.9,.9,.3,.3],['language','quantitative']],
 [[.3,.9,.9,.9,.3],['language','quantitative','space']],
 [[.3,.9,.9,.9,.9],['language','quantitative','space','reasoning']],
 [[.3,.98,.88,.85,.3],['language','quantitative','space']],
])('keeps the complete separated high group for %j',(scores,want)=>{
 const r=buildPrototypeReport(evidence(scores as number[]),'英语',['物理'])
 expect(r.advantageDimensions).toEqual(want)
})
it('keeps all four tied high scores through highlights, subject matches and learning methods',()=>{
 const r=buildPrototypeReport(evidence([2/3,1,1,1,1]),'英语',['物理'])
 expect(r.advantageDimensions).toEqual(['language','quantitative','space','reasoning'])
 expect(r.subjectOpportunityPlan[0].directCoreMatches).toEqual(['quantitative','reasoning'])
 expect(r.subjectOpportunityPlan[0].supportingAdvantageMatches).toEqual(['space'])
 expect(r.subjectOpportunityPlan[0].otherAbilities).not.toContain('space')
 expect(r.subjectOpportunityPlan[0].otherAbilities).not.toContain('reasoning')
 const {container}=render(<Report name="并列测试" report={r}/>)
 expect(container.querySelectorAll('.score-row.featured')).toHaveLength(4)
 expect(container.querySelector('.report-hero')).toHaveTextContent('空间')
 expect(container.querySelector('.report-hero')).toHaveTextContent('推演')

})
it('does not invent a pair when all five are equal and successful',()=>{
 const r=buildPrototypeReport(evidence([1,1,1,1,1]),'英语',['数学'])
 expect(r.relativeDimensions).toHaveLength(5)
 expect(r.advantageDimensions).toEqual([])
 render(<Report name="全部同分" report={r}/>)
 expect(screen.getByRole('heading',{level:1})).toHaveTextContent('五项得分相近')
 expect(document.querySelectorAll('.score-row.featured')).toHaveLength(5)
 expect(document.querySelector('.profile-conclusion')).not.toHaveTextContent('这两类')
})
it('keeps zero or insufficient evidence from becoming highlights',()=>{
 expect(buildPrototypeReport(evidence([0,0,0,0,0]),'英语').relativeDimensions).toEqual([])
 expect(buildPrototypeReport(evidence([1,1,1,1,1]).slice(0,2),'英语').relativeDimensions).toEqual([])
})
it('explains partial subject coverage without calling unhighlighted abilities weak',()=>{
 const report=buildPrototypeReport(evidence([.3,.3,.3,.3,.9]),'英语',['数学'])
 const math=report.subjectOpportunityPlan[0]
 expect(math.tier).toBe('优势借力区')
 expect(math.keyAbilities).toEqual(['quantitative','reasoning'])
 expect(math.directCoreMatches).toEqual(['reasoning'])
 expect(math.uncoveredKeyAbilities).toEqual(['quantitative'])
 const {container}=render(<Report name="单项推演" report={report}/>)
 const card=container.querySelector('.opportunity-groups article > div > span')!
 expect(card).toHaveTextContent('可以用上的元能力：推演')
 expect(card).toHaveTextContent('还需配合练习：数理')
 expect(card.closest('article')).toHaveTextContent('还需配合练习')
})
it('puts insufficient subject evidence in the unknown group, not the low coverage group',()=>{
 const report=buildPrototypeReport(evidence([.3,.3,.3,.3,.9]).filter(e=>e.dimension!=='quantitative'),'英语',['数学'])
 expect(report.subjectOpportunityPlan[0].tier).toBe('待了解区')
 expect(report.subjectOpportunityPlan[0].unobservedAbilities).toContain('quantitative')
 const {container}=render(<Report name="缺少作答" report={report}/>)
 expect(container.querySelector('.opportunity-groups article')).toBeNull()
})
it('keeps reasoning full marks distinct from whole-subject coverage',()=>{
 const report=buildPrototypeReport(evidence([.3,.3,.3,.3,1]),'英语',['语文','数学','物理','历史'])
 expect(report.subjectOpportunityPlan.every(s=>s.tier==='优势借力区')).toBe(true)
 const {container}=render(<Report name="推演满分" report={report}/> )
 expect(container.querySelector('.report-hero')).toHaveTextContent('本次还没有学科进入优势发挥区')
})
it('supports balanced full marks without requiring relative highlights',()=>{
 const report=buildPrototypeReport(evidence([1,1,1,1,1]),'英语',['数学','物理'])
 expect(report.subjectOpportunityPlan.every(s=>s.tier==='优势发挥区')).toBe(true)
})

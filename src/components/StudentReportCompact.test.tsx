import {render,screen} from '@testing-library/react'
import {expect,it} from 'vitest'
import Report from './Report'
import {buildPrototypeReport,type ScoredEvidence} from '../lib/assessment'
const evidence:ScoredEvidence[]=(['memory','language','quantitative','space','reasoning'] as const).flatMap((dimension,d)=>Array.from({length:6},(_,i)=>({taskId:`${dimension}-${i}`,position:d*6+i+1,dimension,mechanism:`${dimension}-${i%3}`,role:'direct',nodeScore:{earned:dimension==='memory'?1:.3,possible:1},diagnosticPoints:[],durationMs:18000})))
it('keeps three summary rows with the classification explanation behind a disclosure',()=>{
 const {container}=render(<Report name="学生" report={buildPrototypeReport(evidence,'英语',['语文'])}/>);
 const card=container.querySelector('.opportunity-groups article > div > span')!;
 expect(card.querySelectorAll(':scope > small')).toHaveLength(3);
 expect(card.querySelector('details')).toBeNull();
 expect(card).toHaveTextContent('记忆');
 expect(card).toHaveTextContent('这门课需要：语言｜推演｜记忆');
})
it('replaces the long fifth section with one action on each concrete topic',()=>{
 const {container}=render(<Report name="学生" report={buildPrototypeReport(evidence,'英语',['数学'])}/>);
 expect(container.querySelector('.route-summary-section')).toBeNull();
 const topics=container.querySelectorAll('.module-row');expect(topics.length).toBeGreaterThan(0);
 topics.forEach(topic=>expect(topic.querySelectorAll('.topic-first-step')).toHaveLength(1));
 expect(screen.queryByText('05｜我的学科学习方法')).not.toBeInTheDocument();
})

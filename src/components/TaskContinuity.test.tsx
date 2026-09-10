import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { MultiChoiceTask } from './tasks/MultiChoiceTask'
import { assessmentTasksV16 } from '../data/assessment-bank-v1.6'
import { orderedV16Tasks, META_BANK_V16 } from '../data/meta-bank-v1.6'
const interaction=(code:string)=>{const t=assessmentTasksV16.find(t=>t.code===code)!;if(t.interaction.type!=='multi-choice')throw Error('not choice');return t.interaction}
it.each(['R03','R04'])('renders %s original items in order without deriving the rule',code=>{
 const projected=interaction(code), original=orderedV16Tasks.find(t=>t.code===code)!
 for(const [i,q]of projected.items.entries()){
  expect(q.series).toEqual(original.items[i].text.split('，').slice(0,-1))
  expect(q.options).toEqual(original.items[i].options)
 }
 const {container}=render(<MultiChoiceTask interaction={projected} value={null} onChange={vi.fn()}/> )
 expect(container.querySelectorAll('.missing-pattern')).toHaveLength(2)
 expect(container.textContent).not.toMatch(/规则一|规则二|循环移动|增量/)
})
it('offers all six positions without blanks and preserves canonical answer mapping',()=>{
 const onChange=vi.fn(), projected=interaction('M05')
 const {container}=render(<MultiChoiceTask interaction={projected} value={null} onChange={onChange}/> )
 expect(container.querySelectorAll('.unavailable-location')).toHaveLength(0)
 for(const [i,q]of projected.items.entries()){
  const group=screen.getAllByRole('radiogroup')[i]
  expect(within(group).getAllByRole('radio')).toHaveLength(6)
  for(const label of ['左上','中上','右上','左下','中下','右下']) expect(within(group).getByRole('radio',{name:label})).toBeEnabled()
  for(const o of q.options){fireEvent.click(within(group).getByRole('radio',{name:o.label}));expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({answers:{[i]:o.id}}))}
 }
 expect(within(screen.getAllByRole('radiogroup')[0]).getByRole('radio',{name:'左下'})).toHaveStyle({gridArea:'2 / 1'})
 expect(container.textContent).not.toMatch(/VA1|VB1|风筝形/)
})
it('requires the first dot comparison before exposing the second, and masks before answering',()=>{
 vi.useFakeTimers()
 const onChange=vi.fn()
 render(<MultiChoiceTask interaction={interaction('N01')} value={null} onChange={onChange}/>)
 expect(screen.getAllByRole('button',{name:'准备好了，看点阵'})).toHaveLength(1)
 fireEvent.click(screen.getByRole('button',{name:'准备好了，看点阵'}))
 const img=screen.getByRole('img', {name:'两侧点阵'})
 fireEvent.load(img)
 expect(screen.queryByRole('button',{name:'准备好了，看点阵'})).not.toBeInTheDocument()
 act(()=>vi.advanceTimersByTime(8000))
 fireEvent.click(within(screen.getAllByRole('radiogroup')[0]).getByRole('radio',{name:'左侧'}))
 expect(onChange).toHaveBeenCalledWith(expect.objectContaining({answers:{0:'A'}}))
 expect(img).not.toBeInTheDocument()
 vi.useRealTimers()
})
it('anchors recall to the correct materials without changing delays',()=>{
 const codes=orderedV16Tasks.map(t=>t.code)
 expect(codes.slice(codes.indexOf('S03'),codes.indexOf('M03')+1)).toEqual(['S03','R03','M03'])
 expect(codes.slice(codes.indexOf('S06'),codes.indexOf('M06')+1)).toEqual(['S06','R06','M06'])
 expect(META_BANK_V16.memoryPresentations.map(p=>p.durationSeconds)).toEqual([24,24,18,12])
 expect(META_BANK_V16.memoryPresentations[2].title).toBe('两组符号记忆')
 expect(orderedV16Tasks.find(t=>t.code==='M03')!.prompt).toContain('两组符号记忆')
 for(const q of orderedV16Tasks.find(t=>t.code==='R03')!.items)for(const o of q.options.filter(o=>o.id!==q.correctAnswer))expect(q.distractorReasons[o.id]?.length).toBeGreaterThan(0)
})

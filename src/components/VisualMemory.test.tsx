import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryGlyph } from './MemoryGlyph'
import { MemoryPresentationScreen } from './MemoryPresentationScreen'
import { MultiChoiceTask } from './tasks/MultiChoiceTask'
import { BriefArray } from './tasks/BriefArray'
import { META_BANK_V16, orderedV16Tasks } from '../data/meta-bank-v1.6'
import { assessmentTasksV16 } from '../data/assessment-bank-v1.6'

const names = /VA[123]|VB[123]|SC[123]|SD[123]|月牙形|钥匙孔形|风筝形|双环形|叶片形/
afterEach(()=>{cleanup();vi.useRealTimers()})
it('visual encoding has six shapes in fixed order, no text names or codes',()=>{
  vi.useFakeTimers()
  render(<MemoryPresentationScreen presentation={META_BANK_V16.memoryPresentations[0]} onComplete={vi.fn()}/>)
  fireEvent.click(screen.getByText('我已了解，开始记忆'))
  expect(screen.getAllByRole('img',{name:'记忆图形'})).toHaveLength(6)
  expect(document.body.innerHTML).not.toMatch(names)
  expect(META_BANK_V16.memoryPresentations[0].visualIds).toEqual(['VA1','VA2','VA3','VB1','VB2','VB3'])
})
it('semantic encoding retains object names but never shows group codes',()=>{
  vi.useFakeTimers()
  render(<MemoryPresentationScreen presentation={META_BANK_V16.memoryPresentations[1]} onComplete={vi.fn()}/>)
  fireEvent.click(screen.getByText('我已了解，开始记忆'))
  expect(screen.getByText('洛米—发蓝光')).toBeInTheDocument()
  expect(document.body.innerHTML).not.toMatch(names)
})
it('M01 only displays 12 graphic options with exactly one material match per question',()=>{
  const task=assessmentTasksV16.find(t=>t.code==='M01')!
  if(task.interaction.type!=='multi-choice')throw Error('wrong interaction')
  render(<MultiChoiceTask interaction={task.interaction} value={null} onChange={vi.fn()}/>)
  expect(screen.getAllByRole('img')).toHaveLength(12)
  expect(document.body.innerHTML).not.toMatch(names)
  const materials=META_BANK_V16.memoryPresentations[0].visualIds!.map(id=>renderToStaticMarkup(<MemoryGlyph id={id}/>))
  for(const item of orderedV16Tasks.find(t=>t.code==='M01')!.items){
    const matches=item.options.filter(o=>materials.includes(renderToStaticMarkup(<MemoryGlyph id={o.visualId!}/>)))
    expect(matches.map(o=>o.id)).toEqual([item.correctAnswer])
    expect(new Set(item.options.map(o=>renderToStaticMarkup(<MemoryGlyph id={o.visualId!}/>)))).toHaveProperty('size',4)
  }
})
it('M05 displays only targets and location choices, with original isolated positions',()=>{
  const task=assessmentTasksV16.find(t=>t.code==='M05')!
  if(task.interaction.type!=='multi-choice')throw Error('wrong interaction')
  render(<MultiChoiceTask interaction={task.interaction} value={null} onChange={vi.fn()}/>)
  expect(screen.getAllByRole('img')).toHaveLength(3)
  expect(document.body.innerHTML).not.toMatch(names)
  expect(task.interaction.items.map(i=>i.targetVisualId)).toEqual(['VB1','VB2','VB3'])
  const bank=orderedV16Tasks.find(t=>t.code==='M05')!
  expect(bank.items.map(i=>i.options.find(o=>o.id===i.correctAnswer)!.label)).toEqual(['左下','中下','右下'])
})
it('an unloaded or failed task image blocks choices and parent confirmation',()=>{
  const onVisualReady=vi.fn()
  render(<MultiChoiceTask interaction={{type:'multi-choice',items:[{text:'test',asset:'s03-rotation-a',options:[{id:'A',label:'A'}]}]}} value={null} onChange={vi.fn()} onVisualReady={onVisualReady}/>)
  expect(screen.getByRole('radio')).toBeDisabled();expect(onVisualReady).toHaveBeenLastCalledWith(false)
  fireEvent.load(screen.getByRole('img'));expect(screen.getByRole('radio')).toBeEnabled();expect(onVisualReady).toHaveBeenLastCalledWith(true)
  fireEvent.error(screen.getByRole('img'));expect(screen.getByRole('radio')).toBeDisabled();expect(onVisualReady).toHaveBeenLastCalledWith(false)
})
it('dots do not consume viewing time or enable an answer before the image loads',()=>{
  vi.useFakeTimers();const onReady=vi.fn()
  render(<BriefArray src="slow.svg" item={0} onReady={onReady}/>)
  fireEvent.click(screen.getByRole('button'))
  act(()=>vi.advanceTimersByTime(5000));expect(onReady).not.toHaveBeenCalled()
  fireEvent.error(screen.getByRole('img'));expect(screen.getByRole('alert')).toBeInTheDocument()
  fireEvent.click(screen.getByText('重新加载'));fireEvent.click(screen.getByText('准备好了，看点阵'))
  fireEvent.load(screen.getByRole('img'));act(()=>vi.advanceTimersByTime(8000));expect(onReady).toHaveBeenCalledOnce()
})

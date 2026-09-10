import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { BriefArray, alternateDots } from './components/tasks/BriefArray'
import { MemoryPresentationScreen } from './components/MemoryPresentationScreen'
import { META_BANK_V16, orderedV16Tasks } from './data/meta-bank-v1.6'
import { assessmentTasksV16 } from './data/assessment-bank-v1.6'
import { LocalPrototypeAdapter } from './lib/transport'

afterEach(() => {cleanup(); localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks()})
it('presents six symbols before S06, then S06 R06 M06 with no repeat', () => {
  expect(orderedV16Tasks.slice(-3).map(t => t.code)).toEqual(['S06','R06','M06'])
  expect(orderedV16Tasks.filter(t => t.memoryPresentationId === 'sequence-6').map(t => t.code)).toEqual(['S06'])
  expect(orderedV16Tasks.find(t => t.code === 'M06')?.practiceId).toBeUndefined()
  expect(orderedV16Tasks.find(t => t.code === 'S06')?.practiceId).toBe('practice-sequence')
  expect(META_BANK_V16.memoryPresentations.find(p => p.id === 'sequence-6')?.beforeTask).toBe('S06')
})
it('masks after 8000ms and keeps the mask across remount', () => {
  vi.useFakeTimers()
  const props = {src:'original.svg', item:0, storageKey:'testdots', onReady:vi.fn()}
  const view = render(<BriefArray {...props}/>)
  fireEvent.click(screen.getByRole('button')); fireEvent.load(screen.getByRole('img'))
  act(() => vi.advanceTimersByTime(7999))
  expect(screen.getByRole('img')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1))
  expect(screen.queryByRole('img')).toBeNull()
  view.unmount(); render(<BriefArray {...props}/>)
  expect(screen.queryByRole('button')).toBeNull()
  expect(props.onReady).toHaveBeenCalledTimes(2)
})
it('background interruption replaces dots without enabling an answer or marking wrong', () => {
  vi.useFakeTimers()
  const onReady=vi.fn()
  render(<BriefArray src="original.svg" item={0} storageKey="testdots" onReady={onReady}/>)
  fireEvent.click(screen.getByRole('button')); fireEvent.load(screen.getByRole('img'))
  vi.spyOn(document,'hidden','get').mockReturnValue(true)
  fireEvent(document,new Event('visibilitychange'))
  act(() => vi.advanceTimersByTime(2000))
  expect(onReady).not.toHaveBeenCalled()
  expect(screen.queryByRole('img')).toBeNull()
  vi.spyOn(document,'hidden','get').mockReturnValue(false)
  fireEvent.click(screen.getByRole('button')); fireEvent.load(screen.getByRole('img'))
  expect(screen.getByRole('img').getAttribute('src')).not.toBe('original.svg')
  act(() => vi.advanceTimersByTime(8000))
  expect(onReady).toHaveBeenCalledOnce()
})
it('refresh during exposure selects a fresh alternate', () => {
  localStorage.setItem('testdots',JSON.stringify({phase:'show',attempt:2}))
  render(<BriefArray src="original.svg" item={1} storageKey="testdots" onReady={vi.fn()}/>)
  fireEvent.click(screen.getByRole('button')); fireEvent.load(screen.getByRole('img'))
  expect(screen.getByRole('img').getAttribute('src')).toBe(alternateDots(1,3))
})
it('all backup arrays preserve the correct side and exact counts', () => {
  for(let item=0;item<2;item++) for(let attempt=1;attempt<=100;attempt++) {
    const svg=decodeURIComponent(alternateDots(item,attempt).split(',')[1])
    expect((svg.match(/<circle /g)??[]).length).toBe(item===0?77:81)
    expect(svg).not.toBe(decodeURIComponent(alternateDots(item,attempt+1).split(',')[1]))
  }
})
it('refresh never replays started memory material', () => {
  render(<MemoryPresentationScreen presentation={META_BANK_V16.memoryPresentations[0]} previouslyStarted onComplete={vi.fn()}/>)
  expect(screen.queryByText('我已了解，开始记忆')).toBeNull()
  expect(document.querySelector('.memory-content')).toBeNull()
  expect(screen.getByText('继续作答')).toBeInTheDocument()
})
it('all 30 tasks score max1 regardless of time and each dimension sums to6', async () => {
  const adapter=new LocalPrototypeAdapter(), totals:Record<string,number>={}
  for(const task of assessmentTasksV16) {
    const source=orderedV16Tasks.find(t => t.id===task.id)!
    const response={kind:'multi-choice' as const,answers:Object.fromEntries(source.items.map((i,n)=>[n,i.correctAnswer]))}
    const a=await adapter.submit({task,response,durationMs:1}), b=await adapter.submit({task,response,durationMs:999999})
    expect(a.nodeScore).toEqual({earned:1,possible:1});expect(b.nodeScore).toEqual(a.nodeScore)
    totals[task.dimension]=(totals[task.dimension]??0)+a.nodeScore.earned
  }
  expect(Object.values(totals)).toEqual([6,6,6,6,6])
})

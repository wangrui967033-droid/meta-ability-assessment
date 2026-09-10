import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryPresentationScreen } from './MemoryPresentationScreen'
import { MultiChoiceTask } from './tasks/MultiChoiceTask'

afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers() })

it('presents one sequence symbol at a time with a blank interval and no replay', () => {
  vi.useFakeTimers()
  const onComplete = vi.fn()
  render(<MemoryPresentationScreen presentation={{ id: 'sequence-test', beforeTask: 'M03', title: '测试', instruction: '记住顺序', durationSeconds: 6, content: ['甲 乙 丙'] }} onComplete={onComplete}/>)
  expect(screen.queryByText('甲')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('我已了解，开始记忆'))
  expect(screen.getByText('甲')).toBeInTheDocument()
  expect(screen.queryByText('乙')).not.toBeInTheDocument()
  act(() => vi.advanceTimersByTime(1800))
  expect(screen.queryByText('甲')).not.toBeInTheDocument()
  act(() => vi.advanceTimersByTime(200))
  expect(screen.getByText('乙')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(4000))
  expect(onComplete).toHaveBeenCalledOnce()
})

it('starts an eight-second exposure after image load and only then enables answers', () => {
  vi.useFakeTimers()
  render(<MultiChoiceTask interaction={{ type: 'multi-choice', items: [{ text: '比较数量', asset: 'n01-dot-a', options: [{ id: 'A', label: '左侧' }, { id: 'B', label: '右侧' }] }] }} value={null} onChange={vi.fn()}/>)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByRole('radio', { name: '左侧' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', {name:'准备好了，看点阵'}))
  act(() => vi.advanceTimersByTime(20000))
  expect(screen.getByRole('radio', { name: '右侧' })).toBeDisabled()
  fireEvent.load(screen.getByRole('img'))
  expect(screen.getByText('还剩8秒')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(7999))
  expect(screen.getByRole('img')).toBeVisible()
  expect(screen.getByRole('radio', { name: '右侧' })).toBeDisabled()
  act(() => vi.advanceTimersByTime(1))
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByRole('radio', { name: '右侧' })).toBeEnabled()
  expect(screen.queryByText('准备好了，看点阵')).not.toBeInTheDocument()
})

it('preserves a completed exposure on refresh and gates the second comparison independently', () => {
  vi.useFakeTimers()
  const interaction = {type:'multi-choice' as const, items:[0,1].map(i=>({text:`比较${i}`,asset:i ? 'n01-dot-b' : 'n01-dot-a',options:[{id:'A',label:'左侧'},{id:'B',label:'右侧'}]}))}
  const onChange=vi.fn(), onVisualReady=vi.fn()
  const props={interaction,onChange,onVisualReady,persistenceKey:'eight-second-refresh'}
  const first=render(<MultiChoiceTask {...props} value={null}/>)
  expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button',{name:'准备好了，看点阵'}))
  fireEvent.load(screen.getByRole('img'))
  act(()=>vi.advanceTimersByTime(8000))
  expect(onVisualReady).toHaveBeenLastCalledWith(false)
  fireEvent.click(screen.getByRole('radio',{name:'左侧'}))
  const answer=onChange.mock.lastCall![0]
  first.unmount()
  render(<MultiChoiceTask {...props} value={answer}/>)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getAllByRole('radiogroup')).toHaveLength(2)
  expect(screen.getAllByRole('button',{name:'准备好了，看点阵'})).toHaveLength(1)
  expect(onVisualReady).toHaveBeenLastCalledWith(false)
  fireEvent.click(screen.getByRole('button',{name:'准备好了，看点阵'}))
  fireEvent.load(screen.getByRole('img'))
  act(()=>vi.advanceTimersByTime(7999))
  expect(onVisualReady).toHaveBeenLastCalledWith(false)
  act(()=>vi.advanceTimersByTime(1))
  expect(onVisualReady).toHaveBeenLastCalledWith(true)
})

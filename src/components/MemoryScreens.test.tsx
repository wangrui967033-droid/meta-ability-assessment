import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EncodingScreen } from './EncodingScreen'
import { ShortSequenceScreen } from './ShortSequenceScreen'
import { MemoryPresentationScreen } from './MemoryPresentationScreen'
import { META_BANK_V16 } from '../data/meta-bank-v1.6'

describe('memory material instructions', () => {
  it('sets expectations for both recognition and later position recall', () => {
    render(<EncodingScreen onComplete={vi.fn()} />)

    expect(screen.getByText(/先判断哪些图形出现过/)).toBeInTheDocument()
    expect(screen.getByText(/再回想它们原来的位置/)).toBeInTheDocument()
  })

  it('starts the material and countdown only after the student confirms the instructions', () => {
    vi.useFakeTimers()
    window.history.replaceState({}, '', '/?test=1')
    const onComplete = vi.fn()
    render(<EncodingScreen onComplete={onComplete} />)

    expect(screen.getByRole('button', { name: '我已了解，开始记忆' })).toBeInTheDocument()
    expect(screen.queryByAltText('记忆编码材料')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('记忆材料剩余时间')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1_000))
    expect(onComplete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '我已了解，开始记忆' }))
    expect(screen.getByAltText('记忆编码材料')).toBeInTheDocument()
    expect(screen.getByLabelText('记忆材料剩余时间')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(500))
    expect(onComplete).toHaveBeenCalledOnce()

    vi.useRealTimers()
    window.history.replaceState({}, '', '/')
  })

  it('keeps the original encoding timer when interruption state and callback change', () => {
    vi.useFakeTimers()
    window.history.replaceState({}, '', '/?test=1')
    const firstComplete = vi.fn()
    const secondComplete = vi.fn()
    const { rerender } = render(<EncodingScreen onComplete={firstComplete} />)

    fireEvent.click(screen.getByRole('button', { name: '我已了解，开始记忆' }))
    act(() => vi.advanceTimersByTime(300))
    rerender(<EncodingScreen onComplete={secondComplete} interrupted />)
    act(() => vi.advanceTimersByTime(200))

    expect(firstComplete).not.toHaveBeenCalled()
    expect(secondComplete).toHaveBeenCalledOnce()
    vi.useRealTimers()
    window.history.replaceState({}, '', '/')
  })
})

describe('short-sequence preparation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits the full five-second preparation period before showing the first symbol', () => {
    const onComplete = vi.fn()
    render(<ShortSequenceScreen onComplete={onComplete} />)

    expect(screen.getByText('5 秒后开始')).toBeInTheDocument()
    expect(screen.queryByAltText('第1个符号')).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(4_999))
    expect(screen.queryByAltText('第1个符号')).not.toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByAltText('第1个符号')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_200))
    expect(screen.getByText('下一个符号即将出现')).toBeInTheDocument()
    expect(screen.queryByText(/\d 秒后开始/)).not.toBeInTheDocument()
  })

  it('does not restart the five-second preparation when the completion callback changes', () => {
    const firstComplete = vi.fn()
    const secondComplete = vi.fn()
    const { rerender } = render(<ShortSequenceScreen onComplete={firstComplete} />)

    act(() => vi.advanceTimersByTime(3_000))
    rerender(<ShortSequenceScreen onComplete={secondComplete} />)
    act(() => vi.advanceTimersByTime(2_000))

    expect(screen.getByAltText('第1个符号')).toBeInTheDocument()
  })
})

describe('V1.6 memory and practice gates', () => {
  it('does not expose or time memory material before explicit confirmation', () => {
    vi.useFakeTimers()
    window.history.replaceState({}, '', '/?test=1')
    const onComplete = vi.fn()
    render(<MemoryPresentationScreen presentation={{
      id: 'visual-board',
      beforeTask: 'M01',
      title: '记住图形与位置',
      instruction: '确认理解后开始',
      durationSeconds: 24,
      content: ['左上：月牙', '右下：叶片'],
    }} onComplete={onComplete} />)

    expect(screen.getByRole('button', { name: '我已了解，开始记忆' })).toBeInTheDocument()
    expect(screen.queryByText('左上：月牙')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(800))
    expect(onComplete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '我已了解，开始记忆' }))
    expect(screen.getByText('左上：月牙')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(500))
    expect(onComplete).toHaveBeenCalledOnce()
    vi.useRealTimers()
    window.history.replaceState({}, '', '/')
  })

  it('clearly tells students both shapes and positions before revealing the real material', () => {
    render(<MemoryPresentationScreen presentation={META_BANK_V16.memoryPresentations[0]} onComplete={vi.fn()} />)
    expect(screen.getByText('记住六个图形的形状，也要记住它们各自的位置。')).toBeInTheDocument()
    expect(screen.getByRole('button', {name: '我已了解，开始记忆'})).toBeInTheDocument()
    expect(screen.queryByText(/VA1|VB1/)).not.toBeInTheDocument()
  })
})

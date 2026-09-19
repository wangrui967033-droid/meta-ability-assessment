import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { META_BANK_V16 } from '../data/meta-bank-v1.6'
import { MemoryPresentationScreen } from './MemoryPresentationScreen'

describe('readable sequence pacing', () => {
  beforeEach(() => { vi.useFakeTimers(); window.history.replaceState({}, '', '/') })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it.each(['sequence-4-5', 'sequence-6'])('shows every symbol for 2.4s with a blank 0.6s gap: %s', id => {
    const presentation = META_BANK_V16.memoryPresentations.find(p => p.id === id)!
    const symbols = presentation.content.flatMap(line => line.replace(/^.*?：/, '').trim().split(/\s+/))
    const done = vi.fn()
    const { container } = render(<MemoryPresentationScreen presentation={presentation} readable onComplete={done} />)
    fireEvent.click(screen.getByRole('button', { name: '我已了解，开始记忆' }))
    const stage = () => container.querySelector('.sequence-content > div')!
    for (let index = 0; index < symbols.length; index++) {
      expect(stage().querySelector('svg.symbol-glyph')).not.toBeNull()
      expect(stage().textContent).toBe('')
      act(() => vi.advanceTimersByTime(2200))
      expect(stage().querySelector('svg.symbol-glyph')).not.toBeNull()
      expect(stage().textContent).toBe('')
      act(() => vi.advanceTimersByTime(200))
      expect(stage().innerHTML).toBe('')
      expect(container).not.toHaveTextContent('＋')
      act(() => vi.advanceTimersByTime(400))
      expect(stage().innerHTML).toBe('')
      expect(done).not.toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(200))
    }
    expect(done).toHaveBeenCalledOnce()
  })

  it('retains the 12-second duration for resumed legacy sessions', () => {
    const done = vi.fn()
    render(<MemoryPresentationScreen presentation={META_BANK_V16.memoryPresentations[3]} onComplete={done} />)
    fireEvent.click(screen.getByRole('button', { name: '我已了解，开始记忆' }))
    act(() => vi.advanceTimersByTime(11800))
    expect(done).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(200))
    expect(done).toHaveBeenCalledOnce()
  })
})

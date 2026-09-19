import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { META_BANK_V16 } from '../data/meta-bank-v1.6'
import { SymbolGlyph } from './SymbolGlyph'

afterEach(cleanup)
it('uses the same vector geometry for sequence answer options and individual stimuli', () => {
  const task = META_BANK_V16.tasks.find(task => task.code === 'M03')!
  for (const item of task.items) for (const option of item.options) {
    const {container,unmount} = render(<SymbolGlyph symbol={option.label}/>)
    const symbols = option.label.trim().split(/\s+/)
    const vectors = [...container.querySelectorAll('svg')]
    expect(vectors).toHaveLength(symbols.length)
    expect(container.textContent).toBe('')
    symbols.forEach((symbol,index)=>{
      const single=render(<SymbolGlyph symbol={symbol}/>)
      expect(vectors[index].innerHTML).toBe(single.container.querySelector('svg')!.innerHTML)
      single.unmount()
    })
    unmount()
  }
})

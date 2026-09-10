import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { DeckItem } from '../data/assessment-types'
import { Brand } from './IntakeScreen'

export const DECK_EXPOSURE_MS = 40_000

export function MemoryDeck({ title, deck, onContinue }: { title: string; deck: DeckItem[]; onContinue: () => void }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), DECK_EXPOSURE_MS)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <main className="app-shell memory-shell">
      <header className="simple-nav"><Brand /><span>信息暂存</span></header>
      <section className="memory-copy">
        <p>请先专心看一会儿</p>
        <h1>{title}</h1>
        <span>不用寻找规律，也不需要截图。后面会在别的任务里请你回忆。</span>
      </section>
      <div className="memory-grid memory-grid-six">
        {deck.map((item, index) => <article key={item.id}><small>0{index + 1}</small><strong>{item.symbol}</strong><i /><b>{item.word}</b></article>)}
      </div>
      <button className="primary-button" type="button" disabled={!ready} onClick={onContinue}>我记好了，继续<ChevronRight size={20} /></button>
      <p className="center-note" aria-live="polite">{ready ? '可以继续了。' : '请先专心记住这些信息。'}</p>
    </main>
  )
}

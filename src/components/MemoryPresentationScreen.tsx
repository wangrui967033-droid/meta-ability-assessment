import { useEffect, useRef, useState } from 'react'
import type { MemoryPresentation } from '../data/meta-bank-v1.6'
import { Brand } from './IntakeScreen'
import { MemoryGlyph } from './MemoryGlyph'
import { SymbolGlyph } from './SymbolGlyph'
import { SEQUENCE_SLOT_MS, SEQUENCE_VISIBLE_RATIO } from '../lib/presentation-protocol'

interface Props {
  presentation: MemoryPresentation
  onComplete: () => void
  interrupted?: boolean
  previouslyStarted?: boolean
  onStart?: () => void
  readable?: boolean
}

export function MemoryPresentationScreen({ presentation, onComplete, interrupted = false, previouslyStarted = false, onStart, readable = false }: Props) {
  const resumedMidway = useRef(previouslyStarted).current
  const testMode = import.meta.env.DEV && new URLSearchParams(window.location.search).get('test') === '1'
  const isSequence = presentation.id.startsWith('sequence-')
  const sequence = presentation.content.flatMap((line, group) => line.replace(/^.*?：/, '').trim().split(/\s+/).map(symbol => ({ symbol, group })))
  const durationSeconds = readable && isSequence ? sequence.length * SEQUENCE_SLOT_MS / 1000 : presentation.durationSeconds
  const durationMs = testMode ? 500 : durationSeconds * 1_000
  const [started, setStarted] = useState(false)
  const [remaining, setRemaining] = useState(durationMs)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])
  useEffect(() => {
    if (!started) return
    const startTime = Date.now()
    const timer = window.setInterval(() => {
      const next = Math.max(0, durationMs - (Date.now() - startTime))
      setRemaining(next)
      if (next === 0) {
        window.clearInterval(timer)
        onCompleteRef.current()
      }
    }, testMode ? 20 : 200)
    return () => window.clearInterval(timer)
  }, [durationMs, started, testMode])

  const elapsed = durationMs - remaining
  const slot = durationMs / sequence.length
  const activeIndex = Math.min(sequence.length - 1, Math.floor(elapsed / slot))
  const active = sequence[activeIndex]
  const visibleContent = isSequence ? [elapsed % slot < slot * SEQUENCE_VISIBLE_RATIO ? active.symbol : ''] : presentation.content

  return (
    <main className={'app-shell encoding-screen' + (readable ? ' readable-memory' : '')}>
      <header className="simple-nav"><Brand /><span>材料看完后不能返回</span></header>
      <section className={'encoding-panel' + (started ? ' memory-playing' : '')}>
        <p className="eyebrow">{started ? "正在展示" : "准备看图"}</p>
        <h1>{presentation.title}</h1>
        <p>{presentation.instruction}</p>
        {!started && !resumedMidway && <p className="memory-preview-note">点击开始后，你有{durationSeconds}秒可以看。时间到后，会自动进入题目。</p>}
        {resumedMidway ? <><p>这组材料刚才已经开始展示，不能再看一遍。我们会记下这次中断，报告中的记忆部分要多留意。</p><button className="primary-button" onClick={onComplete}>继续作答</button></> : !started ? (
          <button className="primary-button encoding-start" type="button" onClick={() => { onStart?.(); setStarted(true) }}>
            我已了解，开始记忆
          </button>
        ) : (
          <>
            <div className="encoding-countdown" aria-label="记忆材料剩余时间">
              <span>剩余</span><b>{testMode ? (remaining / 1000).toFixed(1) : Math.ceil(remaining / 1000)}</b><span>秒</span>
            </div>
            <div className={'memory-content ' + (isSequence ? 'sequence-content' : presentation.id === 'semantic-pairs' ? 'semantic-content' : '')}>
              {isSequence && presentation.content.length > 1 ? <p>第{active.group + 1}组</p> : null}
              {presentation.visualIds ? presentation.visualIds.map(id => <div key={id}><MemoryGlyph id={id}/></div>) : visibleContent.map((line, index) => <div key={index}>{isSequence ? line ? <SymbolGlyph symbol={line}/> : null : line}</div>)}
            </div>
          </>
        )}
        {interrupted ? <p className="field-error">刚才离开过页面，可能影响这组记忆表现。</p> : null}
      </section>
    </main>
  )
}

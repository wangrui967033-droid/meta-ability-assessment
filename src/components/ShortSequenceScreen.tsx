import { useEffect, useRef, useState } from 'react'
import { META_BANK } from '../data/meta-bank-v1.5'
import { questionAssetUrl } from '../data/legacy-question-assets'
import { Brand } from './IntakeScreen'

interface Props { onComplete: () => void }

export function ShortSequenceScreen({ onComplete }: Props) {
  const testMode = new URLSearchParams(window.location.search).get('test') === '1'
  const sequence = META_BANK.form.shortSequence
  const [index, setIndex] = useState(-1)
  const [hasStarted, setHasStarted] = useState(false)
  const [preparationSeconds, setPreparationSeconds] = useState(Math.ceil(sequence.leadInMs / 1_000))
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    const lead = testMode ? 100 : sequence.leadInMs
    const shown = testMode ? 180 : sequence.symbolMs
    const gap = testMode ? 40 : sequence.gapMs
    let timeout = 0
    let countdown = 0
    const advance = (next: number) => {
      if (next >= sequence.symbols.length) return onCompleteRef.current()
      window.clearInterval(countdown)
      setHasStarted(true)
      setIndex(next)
      timeout = window.setTimeout(() => {
        setIndex(-1)
        timeout = window.setTimeout(() => advance(next + 1), gap)
      }, shown)
    }
    if (!testMode) {
      countdown = window.setInterval(() => {
        setPreparationSeconds((current) => Math.max(1, current - 1))
      }, 1_000)
    }
    timeout = window.setTimeout(() => advance(0), lead)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(countdown)
    }
  }, [sequence.gapMs, sequence.leadInMs, sequence.symbolMs, sequence.symbols.length, testMode])

  const asset = index >= 0 ? questionAssetUrl(sequence.symbols[index]) : null
  const waitingLabel = hasStarted ? '下一个符号即将出现' : testMode ? '准备' : `${preparationSeconds} 秒后开始`
  return (
    <main className="app-shell sequence-screen">
      <header className="simple-nav"><Brand /><span>请集中注意</span></header>
      <section><p className="eyebrow">短序列</p><h1>记住符号出现的顺序</h1><p>符号会逐个出现，播放结束后自动进入作答。</p></section>
      <div className="sequence-stage">{asset ? <img src={asset} alt={`第${index + 1}个符号`} draggable={false} /> : <span>{waitingLabel}</span>}</div>
      <p className="sequence-status">{index >= 0 ? `${index + 1} / ${sequence.symbols.length}` : hasStarted ? '请继续看屏幕中央' : '请看屏幕中央，等待符号出现'}</p>
    </main>
  )
}

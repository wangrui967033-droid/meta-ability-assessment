import { useEffect, useRef, useState } from 'react'
import { questionAssetUrl } from '../data/legacy-question-assets'
import { Brand } from './IntakeScreen'

interface Props { onComplete: () => void; interrupted?: boolean }

export function EncodingScreen({ onComplete, interrupted = false }: Props) {
  const testMode = new URLSearchParams(window.location.search).get('test') === '1'
  const durationMs = testMode ? 500 : 40_000
  const [started, setStarted] = useState(false)
  const [remaining, setRemaining] = useState(durationMs)
  const asset = questionAssetUrl('f0-a')
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (!started) return
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const next = Math.max(0, durationMs - (Date.now() - startedAt))
      setRemaining(next)
      if (next === 0) {
        window.clearInterval(timer)
        onCompleteRef.current()
      }
    }, testMode ? 20 : 200)
    return () => window.clearInterval(timer)
  }, [durationMs, started, testMode])

  return (
    <main className="app-shell encoding-screen">
      <header className="simple-nav"><Brand /><span>固定在最前 · 不能返回</span></header>
      <section className="encoding-panel">
        <p className="eyebrow">记忆材料</p>
        <h1>请记住图形、位置和物品配对</h1>
        <p>这张材料后面会分开回想：先判断哪些图形出现过，再回想它们原来的位置；物品配对也会单独提问。点击后有40秒记忆时间，时间结束后材料会自动收起。</p>
        {!started ? <button className="primary-button encoding-start" type="button" onClick={() => setStarted(true)}>我已了解，开始记忆</button> : <>
          <div className="encoding-countdown" aria-label="记忆材料剩余时间"><span>剩余</span><b>{testMode ? (remaining / 1000).toFixed(1) : Math.ceil(remaining / 1000)}</b><span>秒</span></div>
          {asset ? <div className="encoding-asset"><img src={asset} alt="记忆编码材料" draggable={false} /></div> : null}
        </>}
        {interrupted ? <p className="field-error">记忆阶段曾切出页面，报告会把这部分记为“还需要更多观察”。</p> : null}
      </section>
    </main>
  )
}

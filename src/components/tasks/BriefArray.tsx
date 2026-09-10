import { useEffect, useRef, useState } from 'react'

type Exposure = { phase: 'ready' | 'show' | 'answer'; attempt: number }
export const DOT_EXPOSURE_MS = 8000
// Fresh layouts preserve counts, equal ink area and equal enclosing rectangles.
export function alternateDots(item: number, attempt: number) {
  let seed = (item + 1) * 739 + attempt * 9187
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  const counts = item === 0 ? [37, 40] : [42, 39]
  const panels = counts.map((count, side) => {
    const points = [[20, 20], [280, 20], [20, 250], [280, 250]]
    for (let tries = 0; points.length < count && tries < 10000; tries++) {
      const x = 20 + random() * 260, y = 20 + random() * 230
      if (points.every(([px, py]) => Math.hypot(px - x, py - y) > 22)) points.push([x, y])
    }
    if (points.length !== count) throw new Error('点阵生成失败')
    return `<g transform="translate(${side * 340 + 30} 45)"><text x="150" y="-16" text-anchor="middle" font-size="22">${side ? '右侧' : '左侧'}</text>${points.map(([x,y]) => `<circle cx="${x}" cy="${y}" r="${5.5 * Math.sqrt(40/count)}"/>`).join('')}</g>`
  })
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 330" fill="#10213f">${panels.join('')}</svg>`)}`
}

export function BriefArray({src, item, storageKey, onReady}: {src: string; item: number; storageKey?: string; onReady: () => void}) {
  const [state, setState] = useState<Exposure>(() => {
    try {
      const saved = storageKey && localStorage.getItem(storageKey)
      if (saved) {
        const entry = JSON.parse(saved) as Exposure
        if (entry.phase === 'answer') return entry
        if (entry.phase === 'show') return {phase:'ready', attempt:entry.attempt + 1}
        if (entry.phase === 'ready') return entry
      }
    } catch { /* no usable exposure record */ }
    return {phase:'ready', attempt:0}
  })
  const [imageReady, setImageReady] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [remaining, setRemaining] = useState(DOT_EXPOSURE_MS)
  const ready = useRef(onReady)
  ready.current = onReady
  const change = (next: Exposure) => {
    if (storageKey) { try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* storage unavailable */ } }
    setImageReady(false)
    setImageError(false)
    setRemaining(DOT_EXPOSURE_MS)
    setState(next)
  }
  useEffect(() => {
    if (storageKey) { try { localStorage.setItem(storageKey, JSON.stringify(state)) } catch { /* storage unavailable */ } }
    if (state.phase === 'answer') ready.current()
    if (state.phase !== 'show') return
    const startedAt = Date.now()
    const timer = imageReady ? window.setTimeout(() => change(document.hidden ? {phase:'ready', attempt:state.attempt + 1} : {...state, phase:'answer'}), DOT_EXPOSURE_MS) : undefined
    const countdown = imageReady ? window.setInterval(() => setRemaining(Math.max(0, DOT_EXPOSURE_MS - (Date.now() - startedAt))), 100) : undefined
    const interrupt = () => {
      if (!document.hidden) return
      window.clearTimeout(timer)
      change({phase:'ready', attempt:state.attempt + 1})
    }
    document.addEventListener('visibilitychange', interrupt)
    return () => { window.clearTimeout(timer); window.clearInterval(countdown); document.removeEventListener('visibilitychange', interrupt) }
  }, [state.phase, state.attempt, storageKey, imageReady])
  return <div className="question-asset">
    {state.phase === 'ready' ? <>{state.attempt > 0 && <p>刚才看图中断了。换一张图重新看，这次中断不算答错。</p>}<p>图片显示8秒，然后收起。看完再选。</p><button type="button" className="primary-button" onClick={() => { if (!document.hidden) change({...state, phase:'show'}) }}>准备好了，看点阵</button></> : state.phase === 'show' ? <>{imageReady && <p aria-label="看图剩余时间">还剩{Math.ceil(remaining / 1000)}秒</p>}<img onLoad={() => { if (document.hidden) change({phase: 'ready', attempt:state.attempt + 1}); else setImageReady(true) }} onError={() => { setImageReady(false); setImageError(true) }} src={state.attempt ? alternateDots(item, state.attempt) : src} alt="两侧点阵" draggable={false}/>{imageError && <p role="alert">图片没能打开，还没有开始计时。<button onClick={() => change({phase:'ready', attempt:state.attempt + 1})}>重新加载</button></p>}</> : <p>图片已收起。刚才哪边的点更多？</p>}
  </div>
}

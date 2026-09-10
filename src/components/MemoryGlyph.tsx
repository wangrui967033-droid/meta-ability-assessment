import type { ReactNode } from 'react'

// Internal identities only: never render these keys as text, titles or accessible names.
const crescent = <path d="M68 12A40 40 0 1 0 68 88A43 43 0 0 1 68 12Z"/>
const ring = <circle cx="50" cy="38" r="23"/>
const arches = <path d="M12 72Q30 12 50 72Q70 12 88 72"/>
export const memoryGlyphs: Record<string, ReactNode> = {
  VA1: crescent,
  'VA1-dot': <>{crescent}<circle cx="81" cy="50" r="5" fill="currentColor"/></>,
  'VA1-mirror': <g transform="translate(100 0) scale(-1 1)">{crescent}</g>,
  'VA1-star': <path d="M50 8L61 37L92 38L68 57L77 89L50 70L23 89L32 57L8 38L39 37Z"/>,
  VA2: <>{ring}<path d="M50 61V86"/></>,
  'VA2-ring': ring,
  'VA2-double': <><circle cx="35" cy="30" r="16"/><circle cx="65" cy="30" r="16"/><path d="M50 44V94"/></>,
  'VA2-filled': <><circle cx="50" cy="38" r="23" fill="currentColor"/><path d="M50 61V86"/></>,
  VA3: arches,
  'VA3-single': <path d="M24 72Q50 12 76 72"/>,
  'VA3-triple': <path d="M5 72Q20 12 35 72Q50 12 65 72Q80 12 95 72"/>,
  'VA3-line': <>{arches}<path d="M50 72V92"/></>,
  VB1: <><path d="M45 10L79 43L51 74L18 40Z"/><path d="M51 74L68 89L82 78"/></>,
  VB2: <path d="M50 50C15 0 0 94 50 50C85 0 100 94 50 50Z"/>,
  VB3: <><path d="M15 78Q8 18 82 15Q94 75 15 78Z"/><path d="M15 78L66 32"/></>,
}

export function MemoryGlyph({id}: {id: string}) {
  if (!memoryGlyphs[id]) throw new Error('缺少视觉记忆图形')
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="76" height="76" role="img" aria-label="记忆图形" style={{maxWidth:'100%',verticalAlign:'middle'}} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">{memoryGlyphs[id]}</svg>
}

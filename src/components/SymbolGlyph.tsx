export function SymbolGlyph({ symbol }: { symbol: string }) {
  const paths: Record<string, React.ReactNode> = {
    '○': <circle cx="50" cy="50" r="38" />,
    '▲': <path d="M50 10L92 86H8Z" fill="currentColor" />,
    '■': <rect x="12" y="12" width="76" height="76" fill="currentColor" />,
    '☂': <><path d="M10 48A40 36 0 0 1 90 48Q80 38 70 48Q60 38 50 48Q40 38 30 48Q20 38 10 48Z"/><path d="M50 12V79Q50 96 34 86"/></>,
    '☀': <><circle cx="50" cy="50" r="22"/>{Array.from({length:8},(_,i)=><path key={i} d="M50 6V18" transform={`rotate(${i*45} 50 50)`}/>)}</>,
    '♧': <><path d="M43 64C13 85 0 45 29 39C17 6 83 6 71 39C100 45 87 85 57 64L65 88H35Z"/></>,
    '★': <path d="M50 8L61 37L92 38L68 57L77 89L50 70L23 89L32 57L8 38L39 37Z" fill="currentColor" />,
    '◇': <path d="M50 8L90 50L50 92L10 50Z" />,
    '◊': <path d="M50 8L72 50L50 92L28 50Z" />,
    '◆': <path d="M50 8L90 50L50 92L10 50Z" fill="currentColor" />,
    '◈': <><path d="M50 8L90 50L50 92L10 50Z"/><path d="M50 34L66 50L50 66L34 50Z" fill="currentColor"/></>,
    '☾': <path d="M70 12A40 40 0 1 0 70 88A42 42 0 0 1 70 12Z" />,
    '◐': <><circle cx="50" cy="50" r="38"/><path d="M50 12A38 38 0 0 0 50 88Z" fill="currentColor"/></>,
    '◑': <><circle cx="50" cy="50" r="38"/><path d="M50 12A38 38 0 0 1 50 88Z" fill="currentColor"/></>,
    '◒': <><circle cx="50" cy="50" r="38"/><path d="M12 50A38 38 0 0 0 88 50Z" fill="currentColor"/></>,
    '⬟': <path d="M50 8L90 38L75 88H25L10 38Z"/>,
    '✚': <path d="M38 12H62V38H88V62H62V88H38V62H12V38H38Z"/>,
    '☁': <path d="M22 75C-2 73 5 41 25 42C25 9 71 9 75 40C102 40 105 76 79 76Z"/>,
  }
  if (!paths[symbol]) {
    const symbols = symbol.trim().split(/\s+/)
    if (symbols.length > 1 && symbols.every(part => paths[part])) {
      return <span className="symbol-run">{symbols.map((part, index) => <SymbolGlyph key={index} symbol={part}/>)}</span>
    }
    return <>{symbol}</>
  }
  return <svg className="symbol-glyph" viewBox="0 0 100 100" width="64" height="64" role="img" aria-label="抽象符号" style={{ verticalAlign: 'middle', maxWidth: '100%' }} fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round">{paths[symbol]}</svg>
}

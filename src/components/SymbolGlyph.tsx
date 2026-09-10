export function SymbolGlyph({ symbol }: { symbol: string }) {
  const paths: Record<string, React.ReactNode> = {
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
  if (!paths[symbol]) return <>{symbol}</>
  return <svg viewBox="0 0 100 100" width="64" height="64" role="img" aria-label="抽象符号" style={{ verticalAlign: 'middle', maxWidth: '100%' }} fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round">{paths[symbol]}</svg>
}

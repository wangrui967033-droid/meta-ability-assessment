import type { CompositionInteraction, TaskResponse } from '../../data/assessment-types'

interface CompositionTaskProps {
  interaction: CompositionInteraction
  value: TaskResponse | null
  onChange: (response: TaskResponse) => void
}

const sourcePaths = {
  one: 'M0 0H60V20H40V40H60V60H40V80H20V40H0Z',
  two: 'M20 0H60V20H40V40H60V80H40V60H20V40H0V20H20Z',
}

const optionPaths = [
  'M0 0H60V20H40V40H80V20H120V40H100V60H120V100H100V80H80V60H40V80H20V40H0Z',
  'M0 0H60V20H40V40H80V0H100V60H120V100H100V80H80V60H40V80H20V40H0Z',
  'M0 0H60V20H40V40H80V20H120V40H100V60H120V80H100V100H80V60H40V80H20V40H0Z',
  'M20 0H60V20H40V40H80V20H120V40H100V60H120V100H100V80H80V60H40V80H20V60H0V20H20Z',
]

function SourceComposition() {
  return (
    <svg className="source-composition" viewBox="0 0 360 140" role="img" aria-label="图块1和图块2，带粗短线的一边需要贴在一起">
      <rect x="12" y="4" width="132" height="132" rx="8" /><rect x="216" y="4" width="132" height="132" rx="8" />
      <text x="24" y="26">图块 1</text><text x="228" y="26">图块 2</text>
      <g transform="translate(28 38) scale(1.1)"><path d={sourcePaths.one} /><line x1="60" y1="40" x2="60" y2="60" className="connector" /></g>
      <g transform="translate(242 38) scale(1.1)"><path d={sourcePaths.two} /><line x1="0" y1="20" x2="0" y2="40" className="connector" /></g>
    </svg>
  )
}

export function CompositionTask({ interaction, value, onChange }: CompositionTaskProps) {
  const selected = value?.kind === 'composition' ? value.answerToken : ''
  return (
    <div className="composition-task">
      <SourceComposition />
      <div className="composition-options" role="radiogroup" aria-label="拼合后的外边轮廓">
        {interaction.options.map((option, index) => {
          const active = selected === option.id
          return <button key={option.id} type="button" role="radio" aria-checked={active} className={active ? 'composition-option selected' : 'composition-option'} onClick={() => onChange({ kind: 'composition', answerToken: option.id })}>
            <span>{String.fromCharCode(65 + index)}</span>
            <svg viewBox="-6 -6 132 112" aria-hidden="true"><path d={optionPaths[index]} /></svg>
          </button>
        })}
      </div>
    </div>
  )
}

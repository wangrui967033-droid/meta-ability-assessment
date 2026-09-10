import { Check } from 'lucide-react'
import type { ChoiceInteraction, TaskResponse } from '../../data/assessment-types'

interface SingleChoiceTaskProps {
  interaction: ChoiceInteraction
  value: TaskResponse | null
  onChange: (response: TaskResponse) => void
}

export function SingleChoiceTask({ interaction, value, onChange }: SingleChoiceTaskProps) {
  const selectedId = value?.kind === 'choice' ? value.selectedId : ''
  return (
    <>
      <div className="stimulus"><span>{interaction.stimulus}</span></div>
      <div className="option-grid" role="radiogroup" aria-label="答案选项">
        {interaction.options.map((option, index) => {
          const selected = selectedId === option.id
          return (
            <button key={option.id} className={selected ? 'option-button selected' : 'option-button'} type="button" role="radio" aria-checked={selected} onClick={() => onChange({ kind: 'choice', selectedId: option.id })}>
              <b>{String.fromCharCode(65 + index)}</b><span>{option.label}</span>{selected ? <Check size={18} /> : null}
            </button>
          )
        })}
      </div>
    </>
  )
}

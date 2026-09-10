import type { SequenceInteraction, TaskResponse } from '../../data/assessment-types'

interface SequenceTaskProps {
  interaction: SequenceInteraction
  value: TaskResponse | null
  onChange: (response: TaskResponse) => void
}

export function SequenceTask({ interaction, value, onChange }: SequenceTaskProps) {
  const ids = value?.kind === 'sequence' ? value.ids : []
  const add = (id: string) => {
    if (ids.includes(id)) return
    onChange({ kind: 'sequence', ids: [...ids, id] })
  }
  const remove = (id: string) => onChange({ kind: 'sequence', ids: ids.filter((item) => item !== id) })
  const label = (id: string) => interaction.items.find((item) => item.id === id)?.label ?? id
  return (
    <div className="sequence-task">
      <p className="slot-helper">{interaction.instruction}</p>
      <div className="sequence-row" aria-label="已选顺序">
        {ids.length === 0 ? <span>按顺序点选下方信息块</span> : ids.map((id, index) => <button key={id} type="button" onClick={() => remove(id)}><b>{index + 1}</b>{label(id)}</button>)}
      </div>
      <div className="block-bank" aria-label="可选信息块">
        {interaction.items.map((item) => <button key={item.id} type="button" className={ids.includes(item.id) ? 'block-choice used' : 'block-choice'} disabled={ids.includes(item.id)} onClick={() => add(item.id)}>{item.label}</button>)}
      </div>
    </div>
  )
}

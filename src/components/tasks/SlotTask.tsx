import { Check } from 'lucide-react'
import { useState } from 'react'
import type { SlotsInteraction, TaskResponse } from '../../data/assessment-types'

interface SlotTaskProps {
  interaction: SlotsInteraction
  value: TaskResponse | null
  onChange: (response: TaskResponse) => void
}

export function SlotTask({ interaction, value, onChange }: SlotTaskProps) {
  const [activeBlock, setActiveBlock] = useState<string | null>(null)
  const slots = value?.kind === 'slots' ? value.slots : {}
  const place = (slotId: string) => {
    if (!activeBlock) return
    onChange({ kind: 'slots', slots: { ...slots, [slotId]: activeBlock } })
    setActiveBlock(null)
  }
  const blockLabel = (id?: string) => interaction.blocks.find((block) => block.id === id)?.label
  return (
    <div className="slot-task">
      <p className="slot-helper">先选择一个信息块，再点对应位置。</p>
      <div className="block-bank" aria-label="信息块">
        {interaction.blocks.map((block) => {
          const active = activeBlock === block.id
          return <button key={block.id} type="button" className={active ? 'block-choice selected' : 'block-choice'} aria-pressed={active} onClick={() => setActiveBlock(block.id)}>{block.label}{active ? <Check size={16} /> : null}</button>
        })}
      </div>
      <div className="slot-board" aria-label="答案位置">
        {interaction.slots.map((slot) => <button key={slot.id} type="button" className={slots[slot.id] ? 'slot-target filled' : 'slot-target'} onClick={() => place(slot.id)}><small>{slot.label}</small><strong>{blockLabel(slots[slot.id]) ?? '点选后放在这里'}</strong></button>)}
      </div>
    </div>
  )
}

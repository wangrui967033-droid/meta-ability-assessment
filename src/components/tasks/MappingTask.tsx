import type { MappingInteraction, TaskResponse } from '../../data/assessment-types'

interface MappingTaskProps {
  interaction: MappingInteraction
  value: TaskResponse | null
  onChange: (response: TaskResponse) => void
}

export function MappingTask({ interaction, value, onChange }: MappingTaskProps) {
  const mapping = value?.kind === 'mapping' ? value.mapping : {}
  const update = (buttonId: string, lightId: string) => onChange({ kind: 'mapping', mapping: { ...mapping, [buttonId]: lightId } })
  return (
    <div className="mapping-task">
      <div className="record-list" aria-label="三次点灯记录">
        {interaction.records.map((record, index) => (
          <article className="record-set" key={record.id}>
            <small>记录 {index + 1}</small>
            <div><span>同时按下</span><strong>{record.buttons.map((button) => `${button}按钮`).join('、')}</strong></div>
            <div><span>同时亮起</span><strong>{record.lights.join('、')}</strong></div>
          </article>
        ))}
      </div>
      <fieldset className="mapping-board" aria-label="按钮与灯的对应">
        <legend>分别选择每个按钮控制的灯</legend>
        {interaction.buttons.map((button) => (
          <div className="mapping-row" key={button.id} role="radiogroup" aria-label={`${button.label}控制的灯`}>
            <strong>{button.label}控制</strong>
            <div>
              {interaction.lights.map((light) => (
                <label key={light.id} className={mapping[button.id] === light.id ? 'mapping-choice selected' : 'mapping-choice'}>
                  <input type="radio" name={button.id} value={light.id} checked={mapping[button.id] === light.id} onChange={() => update(button.id, light.id)} />
                  <span>{light.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
    </div>
  )
}

import type { AssessmentTask, TaskResponse } from '../data/assessment-types'
import { CompositionTask } from './tasks/CompositionTask'
import { MappingTask } from './tasks/MappingTask'
import { SequenceTask } from './tasks/SequenceTask'
import { SingleChoiceTask } from './tasks/SingleChoiceTask'
import { SlotTask } from './tasks/SlotTask'
import { MultiChoiceTask } from './tasks/MultiChoiceTask'

interface TaskRendererProps {
  task: AssessmentTask
  draft: TaskResponse | null
  onChange: (response: TaskResponse) => void
}

export function TaskRenderer({ task, draft, onChange }: TaskRendererProps) {
  switch (task.interaction.type) {
    case 'choice': return <SingleChoiceTask interaction={task.interaction} value={draft} onChange={onChange} />
    case 'mapping': return <MappingTask interaction={task.interaction} value={draft} onChange={onChange} />
    case 'slots': return <SlotTask interaction={task.interaction} value={draft} onChange={onChange} />
    case 'sequence': return <SequenceTask interaction={task.interaction} value={draft} onChange={onChange} />
    case 'composition': return <CompositionTask interaction={task.interaction} value={draft} onChange={onChange} />
    case 'multi-choice': return <MultiChoiceTask interaction={task.interaction} value={draft} onChange={onChange} />
  }
}

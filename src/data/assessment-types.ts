import type { SubjectName } from './subject-task-map'

export type Dimension = 'memory' | 'language' | 'quantitative' | 'space' | 'reasoning'

export type TaskRole = 'direct' | 'cross-representation' | 'cross-context'

export type ForeignLanguage = '英语' | '日语'

export interface TaskOption {
  displayId?: string
  visualId?: string
  id: string
  label: string
}

export interface ChoiceInteraction {
  type: 'choice'
  stimulus: string
  options: TaskOption[]
}

export interface MappingInteraction {
  type: 'mapping'
  records: Array<{ id: string; buttons: string[]; lights: string[] }>
  buttons: TaskOption[]
  lights: TaskOption[]
}

export interface SlotsInteraction {
  type: 'slots'
  blocks: TaskOption[]
  slots: TaskOption[]
}

export interface SequenceInteraction {
  type: 'sequence'
  items: TaskOption[]
  instruction: string
}

export interface CompositionInteraction {
  type: 'composition'
  options: TaskOption[]
}

export interface MultiChoiceInteraction {
  type: 'multi-choice'
  asset?: string | null
  items: Array<{
    assetLabels?: Record<string, string>
    reorderAssetChoices?: boolean
    targetVisualId?: string
    series?: string[]
    text: string
    asset?: string | null
    options: TaskOption[]
  }>
}

export type InteractionDefinition = ChoiceInteraction | MappingInteraction | SlotsInteraction | SequenceInteraction | CompositionInteraction | MultiChoiceInteraction

export interface AssessmentTask {
  code?: string
  id: string
  version: string
  position: number
  dimension: Dimension
  mechanism: string
  role: TaskRole
  pairId?: string
  difficulty: 'easy' | 'medium' | 'challenge'
  prompt: string
  helper?: string
  practiceId?: string
  memoryPresentationId?: string
  memoryTargetSubset?: string
  interaction: InteractionDefinition
  expectedSeconds: number
}

export type TaskResponse =
  | { kind: 'choice'; selectedId: string }
  | { kind: 'mapping'; mapping: Record<string, string> }
  | { kind: 'slots'; slots: Record<string, string> }
  | { kind: 'sequence'; ids: string[] }
  | { kind: 'composition'; answerToken: string }
  | { kind: 'multi-choice'; answers: Record<string, string>; selectionEvents?: Array<{ itemIndex: number; optionId: string; elapsedSinceTaskStartMs: number }> }

export interface DeckItem {
  id: string
  symbol: string
  word: string
}

export interface Intake {
  name: string
  phone: string
  grade: string
  foreignLanguage: ForeignLanguage | ''
  selectedSubjects: SubjectName[]
}

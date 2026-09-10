import type { AssessmentTask, Dimension } from './assessment-types'
import { orderedV16Tasks, type V16Ability } from './meta-bank-v1.6'

export const dimensionByV16Ability: Record<V16Ability, Dimension> = {
  '记忆': 'memory',
  '语言': 'language',
  '数理': 'quantitative',
  '空间': 'space',
  '推演': 'reasoning',
}

export const assessmentTasksV16: AssessmentTask[] = orderedV16Tasks.map((task) => ({
  code: task.code,
  id: task.id,
  version: '1.6',
  position: task.position,
  dimension: dimensionByV16Ability[task.primaryAbility],
  mechanism: task.mechanism,
  role: 'direct',
  difficulty: task.difficulty,
  prompt: task.prompt,
  helper: task.helper,
  practiceId: task.practiceId,
  memoryPresentationId: task.memoryPresentationId,
  memoryTargetSubset: task.memoryTargetSubset,
  expectedSeconds: task.expectedSeconds,
  interaction: {
    type: 'multi-choice',
    asset: null,
    items: task.items.map((sourceItem) => ({
      text: sourceItem.targetVisualId ? '这个图形原来在哪个位置？' : ['R03', 'R04'].includes(task.code) ? '空格中应填哪一项？' : sourceItem.text,
      series: ['R03', 'R04'].includes(task.code) ? sourceItem.text.split('，').slice(0, -1) : undefined,
      targetVisualId: sourceItem.targetVisualId,
      asset: sourceItem.asset ?? null,
      options: sourceItem.options.map(option => ({...option, label: option.visualId ? '' : option.label})),
    })),
  },
}))

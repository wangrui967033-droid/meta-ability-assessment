import type { AssessmentTask, Dimension } from './assessment-types'
import { orderedV15Tasks, type V15Ability } from './meta-bank-v1.5'

const dimensionByAbility: Record<V15Ability, Dimension> = {
  '记忆': 'memory',
  '语言': 'language',
  '数理': 'quantitative',
  '空间': 'space',
  '推演': 'reasoning',
}

export const assessmentTasksV15: AssessmentTask[] = orderedV15Tasks.map((task, index) => ({
  id: task.id,
  version: task.id,
  position: index + 1,
  dimension: dimensionByAbility[task.primaryAbility],
  mechanism: task.mechanism,
  role: 'direct',
  difficulty: task.difficultyBand === '基础—适中' ? 'easy' : 'challenge',
  prompt: task.prompt,
  helper: '请完成本页所有判断，再继续下一组。',
  expectedSeconds: task.duration,
  interaction: {
    type: 'multi-choice',
    asset: task.asset,
    items: task.items.map((item) => ({
      text: item.text,
      asset: item.asset,
      options: item.options.map((option) => ({ id: option, label: option })),
    })),
  },
}))

export { dimensionByAbility }

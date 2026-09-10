import type { AssessmentTask, TaskResponse } from '../data/assessment-types'
import { orderedV16Tasks } from '../data/meta-bank-v1.6'
const v16AnswerKey: Record<string, TaskResponse> = Object.fromEntries(orderedV16Tasks.map(task => [task.id, {kind: 'multi-choice', answers: Object.fromEntries(task.items.map((item, i) => [String(i), item.correctAnswer]))}]))
import type { ScoredEvidence } from './assessment'
import type { OptionAudit } from './option-order'

export interface SubmittedResponse { task: AssessmentTask; response: TaskResponse; durationMs: number; optionAudit?: OptionAudit[]; sessionId?: string; bankVersion?: string; optionOrderVersion?: string }
export interface AssessmentTransport { submit(input: SubmittedResponse): Promise<ScoredEvidence> }

function scoreResponse(expected: TaskResponse, actual: TaskResponse): { earned: number; possible: number; points: number[] } {
  if (expected.kind !== actual.kind) return { earned: 0, possible: 1, points: [0] }
  if (expected.kind === 'multi-choice' && actual.kind === 'multi-choice') {
    const points = Object.entries(expected.answers).map(([key, answer]) => actual.answers[key] === answer ? 1 : 0)
    const internalAccuracy = points.length
      ? points.reduce<number>((total, point) => total + point, 0) / points.length
      : 0
    return { earned: internalAccuracy, possible: 1, points }
  }
  return { earned: 0, possible: 1, points: [0] }
}

export class LocalPrototypeAdapter implements AssessmentTransport {
  async submit({ task, response, durationMs }: SubmittedResponse): Promise<ScoredEvidence> {
    const expected = v16AnswerKey[task.id]
    if (!expected) throw new Error('题库版本不匹配，请勿混用旧版任务。')
    if (response.kind !== 'multi-choice' || task.interaction.type !== 'multi-choice'
      || task.interaction.items.some((item,i)=>!item.options.some(option=>option.id===response.answers[String(i)]))
      || Object.keys(response.answers).length !== task.interaction.items.length) {
      throw new Error('作答不完整或选项无效，请完成当前题目后再提交。')
    }
    const score = expected ? scoreResponse(expected, response) : { earned: 0, possible: 1, points: [0] }
    return { taskId: task.id, position: task.position, dimension: task.dimension, mechanism: task.mechanism, role: task.role, nodeScore: { earned: score.earned, possible: score.possible }, diagnosticPoints: score.points, durationMs }
  }
}

import { assessmentTasksV16 } from '../data/assessment-bank-v1.6'
import type { AssessmentTask, MultiChoiceInteraction, TaskResponse } from '../data/assessment-types'

export const OPTION_ORDER_VERSION = 'session-options-2'
export type OptionOrders = Record<string, string[][]>
export type OrderMode = 'shuffle' | 'diagram-labels' | 'diagram-shuffle' | 'spatial-fixed'
type Item = MultiChoiceInteraction['items'][number]

export function optionOrderMode(item: Item): OrderMode {
  // Left/right and remembered coordinates are answer meanings, not arbitrary slots.
  if (item.targetVisualId || item.asset?.startsWith('n01-dot')) return 'spatial-fixed'
  if (item.asset && /^(s0[1-4]-|s06-transform-b$)/.test(item.asset)) return 'diagram-shuffle'
  if (item.asset && item.options.every(option => option.label === option.id)) return 'diagram-labels'
  return 'shuffle'
}

function randomIndex(size: number): number {
  const buffer = new Uint32Array(1)
  const limit = 0x100000000 - (0x100000000 % size)
  do { crypto.getRandomValues(buffer) } while (buffer[0] >= limit)
  return buffer[0] % size
}

export function createOptionOrders(pick = randomIndex): OptionOrders {
  return Object.fromEntries(assessmentTasksV16.map(task => [task.id,
    task.interaction.type === 'multi-choice' ? task.interaction.items.map(item => {
      const ids = item.options.map(option => option.id)
      if (optionOrderMode(item) !== 'spatial-fixed') {
        for (let i = ids.length - 1; i > 0; i--) {
          const j = pick(i + 1)
          ;[ids[i], ids[j]] = [ids[j], ids[i]]
        }
      }
      return ids
    }) : [],
  ]))
}

export function validOptionOrders(value: unknown): value is OptionOrders {
  if (!value || typeof value !== 'object') return false
  const orders = value as OptionOrders
  return assessmentTasksV16.every(task => task.interaction.type === 'multi-choice' &&
    Array.isArray(orders[task.id]) && orders[task.id].length === task.interaction.items.length &&
    task.interaction.items.every((item, i) => {
      const order = orders[task.id][i]
      return Array.isArray(order) && order.length === item.options.length &&
        new Set(order).size === order.length && order.every(id => item.options.some(option => option.id === id)) &&
        (optionOrderMode(item) !== 'spatial-fixed' || order.every((id, j) => id === item.options[j].id))
    }))
}

export function displayedInteraction(task: AssessmentTask, orders: OptionOrders): MultiChoiceInteraction {
  if (task.interaction.type !== 'multi-choice') throw new Error('不支持的题型')
  return { ...task.interaction, items: task.interaction.items.map((item, i) => {
    const order = orders[task.id][i]
    const mode = optionOrderMode(item)
    const displayLabels = Object.fromEntries(order.map((id, j) => [id, String.fromCharCode(65 + j)]))
    return { ...item,
      assetLabels: mode === 'diagram-labels' || mode === 'diagram-shuffle' ? displayLabels : undefined,
      reorderAssetChoices: mode === 'diagram-shuffle',
      options: order.map(id => {
        const source = item.options.find(option => option.id === id)!
        return { ...source, displayId: displayLabels[id], label: mode === 'diagram-labels' || mode === 'diagram-shuffle' ? displayLabels[id] : source.label }
      }),
    }
  }) }
}

export interface OptionAudit {
  itemIndex: number
  mode: OrderMode
  // All positions are one-based; originalId is the only scoring key.
  options: Array<{ originalId: string; originalPosition: number; displayPosition: number; displayId: string; spatialPosition?: string }>
  selectedOriginalId: string | null
  selectedOriginalPosition: number | null
  selectedDisplayPosition: number | null
  selectedDisplayId: string | null
}

export function optionAudit(task: AssessmentTask, orders: OptionOrders, response: TaskResponse): OptionAudit[] {
  if (task.interaction.type !== 'multi-choice') return []
  return task.interaction.items.map((item, i) => {
    const mode = optionOrderMode(item)
    const options = orders[task.id][i].map((id, j) => ({ originalId: id,
      originalPosition: item.options.findIndex(option => option.id === id) + 1,
      displayPosition: item.targetVisualId
        ? ['左上','中上','右上','左下','中下','右下'].indexOf(item.options.find(option => option.id === id)!.label) + 1
        : j + 1, displayId: String.fromCharCode(65 + j),
      ...(mode === 'spatial-fixed' ? { spatialPosition: item.options.find(option => option.id === id)!.label } : {}),
    }))
    const selected = options.find(option => option.originalId === (response.kind === 'multi-choice' ? response.answers[String(i)] : null))
    return { itemIndex: i, mode, options, selectedOriginalId: selected?.originalId ?? null,
      selectedOriginalPosition: selected?.originalPosition ?? null,
      selectedDisplayPosition: selected?.displayPosition ?? null, selectedDisplayId: selected?.displayId ?? null }
  })
}

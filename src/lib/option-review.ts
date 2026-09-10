import { orderedV16Tasks } from '../data/meta-bank-v1.6'
import type { OptionAudit } from './option-order'

// Internal review only. Student views never receive answer keys or explanations.
// A deployed server must reconstruct this from its own bank and registered order.
export function reviewDisplayedOptions(taskId: string, audit: OptionAudit[]) {
  const task = orderedV16Tasks.find(task => task.id === taskId)
  if (!task) throw new Error('题库版本不匹配')
  return audit.map(entry => {
    const source = task.items[entry.itemIndex]
    const letters = Object.fromEntries(entry.options.map(option => [option.originalId, option.displayId]))
    const displayText = (text: string) => entry.mode === 'diagram-labels' || entry.mode === 'diagram-shuffle'
      ? text.replace(/\b[A-D]\b/g, id => letters[id] ?? id) : text
    return {
      itemIndex: entry.itemIndex,
      derivation: displayText(source.standardDerivation),
      options: entry.options.map(position => {
        const option = source.options.find(option => option.id === position.originalId)
        if (!option) throw new Error('选项映射不匹配')
        return { ...position, label: entry.mode === 'diagram-labels' || entry.mode === 'diagram-shuffle' ? position.displayId : option.label,
          visualId: option.visualId, correct: option.id === source.correctAnswer,
          reason: displayText(source.distractorReasons[option.id] ?? source.standardDerivation) }
      }),
    }
  })
}

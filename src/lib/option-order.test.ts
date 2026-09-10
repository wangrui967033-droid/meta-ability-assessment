import { describe, expect, it } from 'vitest'
import { assessmentTasksV16 as tasks } from '../data/assessment-bank-v1.6'
import { orderedV16Tasks } from '../data/meta-bank-v1.6'
import { questionAssetUrl } from '../data/question-assets'
import { createOptionOrders, displayedInteraction, optionAudit, optionOrderMode, validOptionOrders } from './option-order'
import { createSessionSnapshot, parseSessionSnapshot } from './session'
import { LocalPrototypeAdapter } from './transport'
import { reviewDisplayedOptions } from './option-review'

describe('session option order', () => {
  it('makes complete permutations, preserves spatial coordinates, and can make distinct sessions', () => {
    const first = createOptionOrders(() => 0)
    const second = createOptionOrders(size => size - 1)
    expect(validOptionOrders(first)).toBe(true)
    expect(first).not.toEqual(second)
    for (const task of tasks) {
      if (task.interaction.type !== 'multi-choice') continue
      task.interaction.items.forEach((item, i) => {
        expect([...first[task.id][i]].sort()).toEqual(item.options.map(option => option.id).sort())
        if (optionOrderMode(item) === 'spatial-fixed') expect(first[task.id][i]).toEqual(second[task.id][i])
      })
    }
  })

  it('restores exactly the same order and rejects corrupt saved mappings', () => {
    const session = createSessionSnapshot()
    const restored = parseSessionSnapshot(JSON.stringify(session))!
    expect(restored.optionOrders).toEqual(session.optionOrders)
    for (const task of tasks) expect(displayedInteraction(task, restored.optionOrders)).toEqual(displayedInteraction(task, session.optionOrders))
    session.optionOrders[tasks[0].id][0] = ['A', 'A', 'C', 'D']
    expect(parseSessionSnapshot(JSON.stringify(session))).toBeNull()
  })

  it('keeps each of all 65 answers, visual IDs and error reasons attached to the original choice', async () => {
    const orders = createOptionOrders(() => 0)
    const adapter = new LocalPrototypeAdapter()
    let count = 0
    for (const task of tasks) {
      const source = orderedV16Tasks.find(entry => entry.id === task.id)!
      const view = displayedInteraction(task, orders)
      const response = { kind: 'multi-choice' as const, answers: Object.fromEntries(source.items.map((item, i) => [String(i), item.correctAnswer])) }
      const audit = optionAudit(task, orders, response)
      const review = reviewDisplayedOptions(task.id, audit)
      source.items.forEach((item, i) => {
        count++
        const correct = review[i].options.find(option => option.correct)!
        expect(correct.originalId).toBe(item.correctAnswer)
        expect(correct.displayPosition).toBe(audit[i].selectedDisplayPosition)
        view.items[i].options.forEach(option => {
          const canonical = item.options.find(original => original.id === option.id)!
          expect(option.visualId).toBe(canonical.visualId)
          expect(review[i].options.find(entry => entry.originalId === option.id)?.reason, `${task.code}/${i}/${option.id}`).toBeTruthy()
        })
      })
      expect((await adapter.submit({ task, response, optionAudit: audit, durationMs: 1234 })).nodeScore).toEqual({ earned: 1, possible: 1 })
      const wrong = {kind: 'multi-choice' as const, answers: Object.fromEntries(source.items.map((item, i) => [String(i), item.options.find(option => option.id !== item.correctAnswer)!.id]))}
      expect((await adapter.submit({task, response: wrong, durationMs: 800})).nodeScore.earned).toBe(0)
    }
    expect(count).toBe(65)
  })

  it('relabels every diagram choice without changing geometry or cube-face names', () => {
    const orders = createOptionOrders(() => 0)
    for (const task of tasks) {
      for (const item of displayedInteraction(task, orders).items) {
        if (!item.assetLabels) continue
        const svg = decodeURIComponent(questionAssetUrl(item.asset, item.assetLabels, item.reorderAssetChoices)!.split(',').slice(1).join(','))
        const labels = [...svg.matchAll(/<text\b[^>]*>([A-D])<\/text>/g)].map(match => match[1])
        expect(labels.sort()).toEqual(['A', 'B', 'C', 'D'])
        item.options.forEach(option => expect(option.label).toBe(item.assetLabels![option.id]))
      }
    }
    const cube = displayedInteraction(tasks.find(task => task.code === 'S05')!, orders)
    expect(cube.items.every(item => !item.assetLabels)).toBe(true)
    expect(cube.items[0].options.map(option => option.label).sort()).toEqual(['A','B','E','F'])
  })

  it('records the real six-grid display position rather than the DOM array position', () => {
    const task = tasks.find(task => task.code === 'M05')!
    const source = orderedV16Tasks.find(entry => entry.id === task.id)!
    const audit = optionAudit(task, createOptionOrders(), {kind:'multi-choice', answers:Object.fromEntries(source.items.map((item, i) => [String(i), item.correctAnswer]))})
    expect(audit.map(item => item.selectedDisplayPosition)).toEqual([4,5,6])
  })

  it('names the memory material without confusing shape recognition and location recall', () => {
    expect(tasks.find(task => task.code === 'M01')?.prompt).toBe('图形识别记忆：选出刚才看过的图形。')
    expect(tasks.find(task => task.code === 'M04')?.helper).toBe('回想之前看过的名字，以及每个名字对应的特点。')
    expect(tasks.find(task => task.code === 'M03')?.helper).not.toContain('不是最开始')
  })
})

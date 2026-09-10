import { describe, expect, it } from 'vitest'
import { META_BANK, orderedV15Tasks } from './meta-bank-v1.5'
import { questionAssetUrl } from './legacy-question-assets'

const canonicalMechanisms = [
  '快速记住', '保持信息', '准确提取',
  '理解意思', '组织信息', '准确表达',
  '感知数量', '理解变化', '处理符号',
  '识别结构', '空间想象', '空间转换',
  '发现关系', '归纳规律', '推出结论',
]

describe('V1.5 assessment bank contract', () => {
  it('uses the frozen 30-task single form in its fixed sequence', () => {
    expect(META_BANK.version).toBe('1.5')
    expect(orderedV15Tasks).toHaveLength(30)
    expect(orderedV15Tasks.map((task) => task.id)).toEqual(META_BANK.form.sequence)
    expect(orderedV15Tasks.reduce((total, task) => total + task.items.length, 0)).toBe(84)
  })

  it('covers every canonical mechanism with exactly two tasks', () => {
    const counts = new Map<string, number>()
    orderedV15Tasks.forEach((task) => counts.set(task.mechanism, (counts.get(task.mechanism) ?? 0) + 1))
    expect([...counts.keys()].sort()).toEqual([...canonicalMechanisms].sort())
    expect([...counts.values()].every((count) => count === 2)).toBe(true)
  })

  it('keeps every private answer inside the displayed option set', () => {
    expect(orderedV15Tasks.every((task) => task.items.every((item) => item.options.includes(item.answer)))).toBe(true)
  })

  it('gives the short-sequence material a five-second preparation interval', () => {
    expect(META_BANK.form.shortSequence.leadInMs).toBe(5_000)
  })

  it('separates appearance recognition from the later position recall', () => {
    const immediateRecognition = orderedV15Tasks.find((task) => task.id === 'M01-v5')
    const delayedPosition = orderedV15Tasks.find((task) => task.id === 'M05-v5')

    expect(immediateRecognition?.prompt).toBe('回想最开始看到的图形位置板。本页只判断图形是否出现。')
    expect(delayedPosition?.prompt).toBe('回想最开始的图形位置板。选择各位置当时放置的图形。')
  })

  it('removes answer cues and ambiguity from the calibrated verbal and quantitative items', () => {
    const task = (id: string) => orderedV15Tasks.find((item) => item.id === id)

    expect(task('M06-v5')?.prompt).toBe('选择最开始的位置板中出现过的图形。')
    expect(task('L01-v5')?.items[0]).toMatchObject({
      text: '三组相互独立的数据中，两组支持甲方案，一组未显示甲乙有明显差异。若后续样本与现有样本类似，甲更可能保持优势，但还不能推广到所有情境。',
      answer: '现有证据倾向甲，但结论受后续样本和适用情境限制',
    })
    expect(task('L02-v5')?.items[1]).toMatchObject({
      text: '系统规定：样本至少200份、缺失率低于5%，且两名审核员结论一致时，报告才会标记为“可发布”。本报告已标记为“可发布”。',
      answer: '三项条件都已满足',
    })
    expect(task('N01-v5')?.items[2].text).toBe('哪一边的点更多？')
    expect(task('N03-v5')?.items[0]).toMatchObject({
      text: '输出依次为6、11、19、30、44。按相同的变化方式，下一个输出是多少？',
      answer: '61',
    })
    expect(task('R02-v5')?.items).toEqual([
      expect.objectContaining({ text: '示例：实验记录—分析—研究结论', answer: '运行数据—比较—性能判断' }),
      expect.objectContaining({ text: '示例：规则—核对—发现冲突', answer: '标准—检查—识别偏差' }),
    ])
  })

  it('uses the recalibrated visual forms for the items marked as too easy', () => {
    const task = (id: string) => orderedV15Tasks.find((item) => item.id === id)

    expect(task('N01-v5')?.items.map((item) => item.asset)).toEqual(['n01q1', 'n01q2-v16', 'n01q3-v16'])
    expect(task('N02-v5')?.items.slice(0, 2)).toEqual([
      expect.objectContaining({ text: '在−0.4—1.1数轴上，0.53最接近哪个点？', answer: 'C', asset: 'n02q1-v16' }),
      expect.objectContaining({ text: '在−120—80数轴上，−37最接近哪个点？', answer: 'B', asset: 'n02q2-v16' }),
    ])
    expect(task('S01-v5')?.items.map((item) => item.asset)).toEqual(['s01q1', 's01q2-v16', 's01q3-v16'])
    expect(task('S02-v5')?.items.map((item) => item.asset)).toEqual(['s02q1-v17', 's02q2-v17', 's02q3-v17'])
    expect(task('S02-v5')?.items.map((item) => item.text)).toEqual([
      '使●与▲通过粗线相连。',
      '使●与▲通过粗线相连。',
      '同时使两组相同标记通过粗线分别相连，且两组线路互不接通。',
    ])
    expect(task('S03-v5')?.items.map((item) => item.asset)).toEqual(['s03q1-v17', 's03q2-v17', 's03q3-v17'])
    expect(task('S06-v5')?.items[0]).toMatchObject({ text: '从橙点先向右2格，再向上3格，最后向左1格。', answer: 'C', asset: 's06q1-v17' })
    expect(task('R01-v5')?.items.map((item) => item.asset)).toEqual(['r01q1-v16', 'r01q2-v16'])
  })

  it('resolves every task-level visual asset included by the calibrated bank', () => {
    const unresolved = orderedV15Tasks.flatMap((task) => task.items)
      .filter((item) => item.asset && !questionAssetUrl(item.asset))
      .map((item) => item.asset)

    expect(unresolved).toEqual([])
  })
})

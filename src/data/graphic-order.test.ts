import { describe, expect, it } from 'vitest'
import { reorderChoiceSvg } from './question-assets'

const sources = import.meta.glob('../assets/source-v1.6-quality/*.svg', {eager:true, import:'default', query:'?raw'}) as Record<string,string>
const parse = (text: string) => new DOMParser().parseFromString(text, 'image/svg+xml')
function permutations(ids: string[]): string[][] {
  return ids.length ? ids.flatMap(id => permutations(ids.filter(other => other !== id)).map(rest => [id, ...rest])) : [[]]
}

describe('graphical choice ordering', () => {
  it('moves whole candidates to A/B/C/D slots for all permutations, keeping shape and markers intact', () => {
    const selected = Object.entries(sources).filter(([path]) => /s0[1-4]-|s06-transform-b/.test(path))
    expect(selected).toHaveLength(9)
    for (const [path, svg] of selected) {
      const original = parse(svg)
      const labels = [...original.querySelectorAll('text')].filter(node => /^[A-D]$/.test(node.textContent ?? ''))
      for (const order of permutations(['A','B','C','D'])) {
        const mapping = Object.fromEntries(order.map((id,i) => [id,'ABCD'[i]]))
        const rendered = parse(reorderChoiceSvg(svg, mapping))
        const display = [...rendered.querySelectorAll('text')].filter(node => /^[A-D]$/.test(node.textContent ?? ''))
        expect(display.map(node => node.textContent), path).toEqual(['A','B','C','D'])
        display.forEach((node, i) => {
          expect([node.getAttribute('x'), node.getAttribute('y')]).toEqual([labels[i].getAttribute('x'),labels[i].getAttribute('y')])
          const sourceLabel = labels.find(label => label.textContent === order[i])!
          const wrapper = node.nextElementSibling!
          expect(wrapper.getAttribute('data-original-option')).toBe(order[i])
          expect(wrapper.firstElementChild?.isEqualNode(sourceLabel.nextElementSibling), `${path}/${order}/${i}`).toBe(true)
        })
        const parent = labels[0].parentElement!
        const originalPrefix = [...parent.children].slice(0,[...parent.children].indexOf(labels[0]))
        const newParent = display[0].parentElement!
        expect(originalPrefix.every((node,i) => node.isEqualNode(newParent.children[i]))).toBe(true)
      }
    }
  })

  it('rejects unsupported layouts rather than silently pairing the wrong diagram', () => {
    expect(() => reorderChoiceSvg('<svg xmlns="http://www.w3.org/2000/svg"><text>A</text></svg>',{A:'B',B:'A',C:'C',D:'D'})).toThrow()
  })
})

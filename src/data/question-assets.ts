const modules = import.meta.glob(['../assets/source-v1.6-quality/*.svg'], {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

const assets = new Map(
  Object.entries(modules).map(([path, url]) => [path.split('/').pop()?.replace(/\.(png|svg)$/, ''), url]),
)

const rawModules = import.meta.glob(['../assets/source-v1.6-quality/*.svg'], {
  eager: true, import: 'default', query: '?raw',
}) as Record<string, string>
const rawAssets = new Map(Object.entries(rawModules).map(([path, svg]) => [path.split('/').pop()?.replace(/\.svg$/, ''), svg]))

// Only called for assets whose A–D labels denote choices, never cube-face names.
export function relabelChoiceSvg(svg: string, labels: Record<string, string>): string {
  return svg.replace(/(<text\b[^>]*>)([A-D])(<\/text>)/g, (_, open, id, close) => `${open}${/^[A-D]$/.test(labels[id]) ? labels[id] : id}${close}`)
}

export function reorderChoiceSvg(svg: string, labels: Record<string, string>): string {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const choices = [...doc.querySelectorAll('text')].filter(node => /^[A-D]$/.test(node.textContent ?? ''))
  const parent = choices[0]?.parentElement
  if (choices.length !== 4 || !parent || choices.some((node, i) => node.textContent !== 'ABCD'[i] || node.parentElement !== parent || node.nextElementSibling?.tagName !== 'g') || new Set(Object.values(labels)).size !== 4 || !['A','B','C','D'].every(id => /^[A-D]$/.test(labels[id]))) throw new Error('候选图布局不匹配')
  const blocks = choices.map(node => ({label:node, shape:node.nextElementSibling!, x:Number(node.getAttribute('x')), y:Number(node.getAttribute('y'))}))
  blocks.forEach(block => { block.label.remove(); block.shape.remove() })
  for (let i = 0; i < 4; i++) {
    const originalId = Object.keys(labels).find(id => labels[id] === 'ABCD'[i])!
    const source = blocks['ABCD'.indexOf(originalId)]
    const destination = blocks[i]
    const label = destination.label.cloneNode(true) as Element
    label.textContent = 'ABCD'[i]
    const wrapper = doc.createElementNS('http://www.w3.org/2000/svg','g')
    wrapper.setAttribute('transform', `translate(${destination.x - source.x} ${destination.y - source.y})`)
    wrapper.setAttribute('data-original-option', originalId)
    wrapper.appendChild(source.shape.cloneNode(true))
    parent.append(label, wrapper)
  }
  return new XMLSerializer().serializeToString(doc)
}

const renderedAssets = new Map<string, string>()

export interface DiagramComparison { target: string; options: string[] }
// Crop only the existing, shuffled two-by-two option sheet. Geometry is never redrawn.
export function diagramComparison(src: string): DiagramComparison | undefined {
  if (!src.startsWith('data:image/svg+xml')) return undefined
  try {
    const svg = decodeURIComponent(src.slice(src.indexOf(',') + 1))
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    const root = doc.documentElement
    const box = root.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number)
    const labels = [...root.querySelectorAll('text')].filter(n => /^[A-D]$/.test(n.textContent ?? ''))
    if (!box || box.length !== 4 || box[0] !== 0 || box[1] !== 0 || labels.length !== 4 || labels.some((n,i)=>n.textContent !== 'ABCD'[i] || n.parentElement !== root || !n.nextElementSibling?.hasAttribute('data-original-option'))) return undefined
    const xs=labels.map(n=>Number(n.getAttribute('x'))), ys=labels.map(n=>Number(n.getAttribute('y')))
    if (xs.some(n=>!Number.isFinite(n)) || ys.some(n=>!Number.isFinite(n)) || xs[0] !== xs[2] || xs[1] !== xs[3] || ys[0] !== ys[1] || ys[2] !== ys[3] || xs[0] >= xs[1] || ys[0] >= ys[2]) return undefined
    const cut=(xs[0]+xs[1])/2, top=ys[0]-28, second=ys[2]-28
    if (top <= 0 || cut <= 0 || cut >= box[2] || second >= box[3]) return undefined
    const crop=(x:number,y:number,w:number,h:number,option=-1)=>{
      const panel=root.cloneNode(true) as Element
      const choices=[...panel.querySelectorAll('text')].filter(n=>/^[A-D]$/.test(n.textContent??''))
      if(option<0) choices.forEach(n=>{n.nextElementSibling?.remove();n.remove()})
      else {
        const label=choices[option], shape=label.nextElementSibling
        ;[...panel.children].forEach(n=>{if(n!==label && n!==shape && !['defs','style'].includes(n.tagName)) n.remove()})
      }
      panel.setAttribute('viewBox',`${x} ${y} ${w} ${h}`)
      panel.setAttribute('width',String(w));panel.setAttribute('height',String(h))
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(panel))}`
    }
    return {target:crop(0,0,box[2],top),options:[crop(0,top,cut,second-top,0),crop(cut,top,box[2]-cut,second-top,1),crop(0,second,cut,box[3]-second,2),crop(cut,second,box[2]-cut,box[3]-second,3)]}
  } catch { return undefined }
}

export function questionAssetUrl(assetId: string | null | undefined, labels?: Record<string, string>, reorder = false): string | null {
  if (!assetId) return null
  if (labels) {
    const key = `${assetId}:${reorder}:${JSON.stringify(labels)}`
    if (renderedAssets.has(key)) return renderedAssets.get(key)!
    const svg = rawAssets.get(assetId.toLowerCase())
    if (!svg) return null
    try {
      const value = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(reorder ? reorderChoiceSvg(svg, labels) : relabelChoiceSvg(svg, labels))}`
      renderedAssets.set(key, value)
      return value
    } catch { return null } // No usable image means the renderer keeps answering disabled.
  }
  return assets.get(assetId.toLowerCase()) ?? null
}

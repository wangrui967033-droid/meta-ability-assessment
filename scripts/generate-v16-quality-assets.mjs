import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const outputDir = fileURLToPath(new URL('../src/assets/source-v1.6-quality/', import.meta.url))
await mkdir(outputDir, { recursive: true })

const frame = (body, height = 300) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 ${height}" role="img">
<rect width="720" height="${height}" rx="18" fill="#f7f9fc"/>
<style>.s{stroke:#10213f;stroke-width:7;fill:none;stroke-linecap:round;stroke-linejoin:round}.t{font:700 24px system-ui,sans-serif;fill:#10213f}.m{font:600 18px system-ui,sans-serif;fill:#61708a}.o{fill:#fff;stroke:#10213f;stroke-width:5}.f{fill:#10213f}</style>${body}</svg>`

const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
function dots(count, x, y, width, height, seed) {
  const random = rng(seed)
  const points = [[18, 18], [width - 18, 18], [18, height - 18], [width - 18, height - 18]]
  let guard = 0
  while (points.length < count && guard < 20000) {
    guard += 1
    const candidate = [18 + random() * (width - 36), 18 + random() * (height - 36)]
    if (points.every(([px, py]) => Math.hypot(candidate[0] - px, candidate[1] - py) > 20)) points.push(candidate)
  }
  if (points.length !== count) throw new Error('点阵数量不足')
  const radius = 5.5 * Math.sqrt(40 / count)
  return points.map(([px, py]) => `<circle cx="${(x + px).toFixed(1)}" cy="${(y + py).toFixed(1)}" r="${radius}" class="f"/>`).join('')
}

const dotAsset = (leftCount, rightCount, seed) => frame(`
  <text x="180" y="42" text-anchor="middle" class="t">左侧</text><text x="540" y="42" text-anchor="middle" class="t">右侧</text>
  <rect x="35" y="62" width="290" height="205" rx="12" class="o"/><rect x="395" y="62" width="290" height="205" rx="12" class="o"/>
  ${dots(leftCount, 45, 72, 270, 185, seed)}${dots(rightCount, 405, 72, 270, 185, seed + 41)}
`)

const numberLine = ({ min, max, target, points, ticks }) => {
  const x = (value) => 75 + ((value - min) / (max - min)) * 570
  return frame(`
    <line x1="75" y1="170" x2="645" y2="170" class="s"/>
    <path d="M630 154 L648 170 L630 186" class="s"/>
    ${ticks.map((value) => `<line x1="${x(value)}" y1="156" x2="${x(value)}" y2="184" class="s"/><text x="${x(value)}" y="220" text-anchor="middle" class="m">${value}</text>`).join('')}
    ${points.map(([label, value]) => `<line x1="${x(value)}" y1="130" x2="${x(value)}" y2="170" class="s"/><text x="${x(value)}" y="112" text-anchor="middle" class="t">${label}</text>`).join('')}
    <text x="360" y="55" text-anchor="middle" class="t">目标数：${target}</text>
  `)
}

const assets = {
  'n01-dot-a.svg': dotAsset(37, 40, 101),
  'n01-dot-b.svg': dotAsset(42, 39, 809),
  'n02-line-a.svg': numberLine({ min: 20, max: 100, target: '57', points: [['A', 45], ['B', 55], ['C', 62], ['D', 70]], ticks: [20, 100] }),
  'n02-line-b.svg': numberLine({ min: 40, max: 160, target: '109', points: [['A', 94], ['B', 102], ['C', 112], ['D', 123]], ticks: [40, 160] }),
  's05-net.svg': frame(`
    <text x="45" y="42" class="m">沿边折成立方体</text>
    ${[['B',240,45],['A',175,110],['C',240,110],['D',305,110],['E',370,110],['F',240,175]].map(([label,x,y])=>`<rect x="${x}" y="${y}" width="65" height="65" fill="#fff" stroke="#10213f" stroke-width="5"/><text x="${Number(x)+32.5}" y="${Number(y)+42}" text-anchor="middle" class="t">${label}</text>`).join('')}
  `),
  's06-transform-a.svg': frame(`
    <text x="40" y="38" class="m">先沿箭头移动，再按弯箭头转向</text>
    <g transform="translate(65 62)">${Array.from({length:5},(_,i)=>`<line x1="0" y1="${i*42}" x2="168" y2="${i*42}" class="s"/><line x1="${i*42}" y1="0" x2="${i*42}" y2="168" class="s"/>`).join('')}<circle cx="42" cy="126" r="12" fill="#f3b84b" stroke="#10213f" stroke-width="5"/><path d="M42 126 V42 H126" stroke="#c58b28" stroke-width="8" fill="none"/><path d="M112 28 L128 42 L112 56" class="s"/></g>
    <g transform="translate(380 62)">${Array.from({length:5},(_,i)=>`<line x1="0" y1="${i*42}" x2="168" y2="${i*42}" class="s"/><line x1="${i*42}" y1="0" x2="${i*42}" y2="168" class="s"/>`).join('')}${[['A',84,42],['B',126,42],['C',126,84],['D',84,84]].map(([l,x,y])=>`<circle cx="${x}" cy="${y}" r="15" class="o"/><text x="${x}" y="${Number(y)+7}" text-anchor="middle" class="m">${l}</text>`).join('')}</g>
  `),
  's06-transform-b.svg': frame(`
    <text x="32" y="34" class="m">把左图沿虚线翻到另一侧</text>
    <g transform="translate(28 58)"><line x1="190" y1="0" x2="190" y2="185" stroke="#9aa6b8" stroke-width="4" stroke-dasharray="10 10"/><path d="M20 145H130V55" class="s"/><path d="M115 72L130 54L145 72" class="s"/><circle cx="20" cy="145" r="12" fill="#f3b84b" stroke="#10213f" stroke-width="5"/></g>
    <g transform="translate(300 48)">
      <text x="70" y="18" text-anchor="middle" class="t">A</text><g transform="translate(0 26)"><path d="M120 86H35V18" class="s"/><path d="M20 35L35 17L50 35" class="s"/><circle cx="120" cy="86" r="10" fill="#f3b84b" stroke="#10213f" stroke-width="5"/></g>
      <text x="245" y="18" text-anchor="middle" class="t">B</text><g transform="translate(175 26)"><path d="M120 18H35V86" class="s"/><path d="M20 69L35 87L50 69" class="s"/><circle cx="120" cy="18" r="10" fill="#f3b84b" stroke="#10213f" stroke-width="5"/></g>
      <text x="70" y="142" text-anchor="middle" class="t">C</text><g transform="translate(0 150)"><path d="M18 86H103V18" class="s"/><path d="M88 35L103 17L118 35" class="s"/><circle cx="18" cy="86" r="10" fill="#f3b84b" stroke="#10213f" stroke-width="5"/></g>
      <text x="245" y="142" text-anchor="middle" class="t">D</text><g transform="translate(175 150)"><path d="M120 86H35V18" class="s"/><path d="M20 35L35 17L50 35" class="s"/><circle cx="35" cy="18" r="10" fill="#f3b84b" stroke="#10213f" stroke-width="5"/></g>
    </g>
  `, 360),
}

await Promise.all(Object.entries(assets).map(([name, svg]) => writeFile(`${outputDir}/${name}`, svg)))
console.log(`Generated ${Object.keys(assets).length} V1.6 quality assets.`)

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const output = join(root, 'design', '元能力测评-题库报告联调版.html')
let html = await readFile(join(dist, 'index.html'), 'utf8')

for (const match of [...html.matchAll(/<link[^>]+href="\.\/(assets\/[^"]+\.css)"[^>]*>/g)]) {
  const css = await readFile(join(dist, match[1]), 'utf8')
  html = html.replace(match[0], () => `<style>${css}</style>`)
}

for (const match of [...html.matchAll(/<script[^>]+src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g)]) {
  const js = await readFile(join(dist, match[1]), 'utf8')
  html = html.replace(match[0], () => `<script type="module">${js}</script>`)
}

html = html
  .replace(/<title>[^<]*<\/title>/, '<title>元能力测评｜V1.6题库与报告联调版</title>')
  .replace('</head>', '<!-- 本地联调版：为在无服务器时生成报告，文件内包含题库答案键。正式上线请改为服务端评分。 -->\n</head>')

await mkdir(dirname(output), { recursive: true })
await writeFile(output, html)
console.log(output)

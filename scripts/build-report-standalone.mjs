import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const output = join(root, 'design', '元能力学习画像-报告端.html')

async function createPreviewSession() {
  const server = await createServer({ root, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  try {
    const { createSessionSnapshot } = await server.ssrLoadModule('/src/lib/session.ts')
    const { assessmentTasksV16 } = await server.ssrLoadModule('/src/data/assessment-bank-v1.6.ts')
    const { orderedV16Tasks } = await server.ssrLoadModule('/src/data/meta-bank-v1.6.ts')
    const { LocalPrototypeAdapter } = await server.ssrLoadModule('/src/lib/transport.ts')
    const adapter = new LocalPrototypeAdapter()
    const session = createSessionSnapshot()
    session.responses = await Promise.all(assessmentTasksV16.map(async (task, index) => {
      const response = {
        kind: 'multi-choice',
        answers: Object.fromEntries(orderedV16Tasks[index].items.map((item, itemIndex) => {
          const rate = {reasoning: 9, quantitative: 8, space: 5, memory: 4, language: 4}[task.dimension]
          const correct = (index * 7 + itemIndex * 3) % 10 < rate
          const wrong = task.interaction.items[itemIndex].options.find(option => option.id !== item.correctAnswer)?.id
          return [String(itemIndex), correct ? item.correctAnswer : wrong ?? item.correctAnswer]
        })),
      }
      const evidence = await adapter.submit({ task, response, durationMs: 18000 })
      // 合成作答通过与测评端相同的评分器计分，不直接改写得分。
      return { position: task.position, response, evidence, submittedAt: new Date().toISOString() }
    }))
    Object.assign(session, {
      screen: 'report',
      startedAt: Date.now() - 16 * 60 * 1000,
      taskStartedAt: Date.now(),
      completedTaskCount: assessmentTasksV16.length,
      actualDurationMs: 16 * 60 * 1000,
      reportGeneratedAt: new Date().toISOString(),
      intake: { name: '模拟学生（合成作答）', grade: '高三', foreignLanguage: '英语', selectedSubjects: ['物理', '化学', '生物'] },
    })
    return session
  } finally {
    await server.close()
  }
}

const previewSession = await createPreviewSession()
let html = await readFile(join(dist, 'index.html'), 'utf8')

for (const match of [...html.matchAll(/<link[^>]+href="\.\/(assets\/[^"]+\.css)"[^>]*>/g)]) {
  const css = await readFile(join(dist, match[1]), 'utf8')
  html = html.replace(match[0], () => `<style>${css}</style>`)
}

for (const match of [...html.matchAll(/<script[^>]+src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g)]) {
  const js = await readFile(join(dist, match[1]), 'utf8')
  html = html.replace(match[0], () => `<script type="module">${js}</script>`)
}

const previewPayload = JSON.stringify(previewSession).replaceAll('<', '\\u003c')
const bootstrap = `<script>window.__META_ABILITY_REPORT_PREVIEW__=${previewPayload};</script>`
html = html
  .replace(/<title>[^<]*<\/title>/, '<title>元能力学习画像｜报告端示例</title>')
  .replace('</head>', '<!-- 独立报告端：内置示例学生结果，仅用于预览页面结构。 -->\n</head>')
  .replace('<script type="module">', `${bootstrap}<script type="module">`)

await mkdir(dirname(output), { recursive: true })
await writeFile(output, html)
console.log(output)

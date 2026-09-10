import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const file = join(process.cwd(), 'design', '元能力测评-题库报告联调版.html')
const html = await readFile(file, 'utf8')
const checks = [
  ['persisted versions', /1.6-task-mean-1/],
  ['session option version', /session-options-2/],
  ['recognition wording', /图形识别记忆：选出刚才看过的图形/],
  ['semantic recall wording', /回想之前看过的名字，以及每个名字对应的特点/],
  ['audited original position', /selectedOriginalPosition/],
  ['audited display position', /selectedDisplayPosition/],
  ['report overview', /01｜核心结论/],
  ['complete subject requirements', /这门课需要：/],
  ['whole-candidate shuffle', /data-original-option/],
  ['eight-second dot comparison', /图片显示8秒/],
  ['inline module bundle', /<script type="module">[\s\S]{10000,}<\/script>/],
  ['inline stylesheet', /<style>[\s\S]{1000,}<\/style>/],
  ['assessment value proposition', /元能力学习画像/],
  ['V1.6 title', /V1\.6题库与报告联调版/],
  ['visual immediate subset', /选择出现过的图形，不需要回想位置/],
  ['delayed position subset', /回想最开始的六格图形/],
  ['encoding starts after confirmation', /我已了解，开始记忆/],
  ['inline operational rules', /左块不动，右块可以移动、转动/],
  ['sequence lengths', /四项序列的原顺序是|五项序列的原顺序是|六项序列的原顺序是/],

  ['dual-rule reasoning', /每组包含形状和数字/],
  ['shape and position instruction', /记住六个图形的形状，也要记住它们各自的位置/],
  ['report sections', /03｜学科优势与待发展方向/],
  ['relative high result', /这次得分较高/],
  ['compact subject cards', /还需配合练习：/],
  ['task first step', /可以先这样做/],
  ['geometry first step', /先画图标出已知条件，再把图中的关系写成式子/],
]
for (const [label, pattern] of checks) {
  if (!pattern.test(html)) throw new Error(`standalone validation failed: ${label}`)
}
if (/保存反馈到本机|href:"#pilot-feedback"/.test(html)) throw new Error('student report still includes pilot feedback')
if (/<(?:script|link)[^>]+(?:src|href)="\.\//.test(html)) throw new Error('standalone still references a local bundle')
if (/0—7门均可/.test(html)) throw new Error('standalone still contains the removed subject-count copy')
if (/不展示任何具体知识任务/.test(html)) throw new Error('standalone still contains the removed section 03 copy')
if (/任务元能力需求不会跟着学生结果改变/.test(html)) throw new Error('standalone still contains the removed section 04 copy')
if (/接近末尾会再回想它们原来的位置/.test(html)) throw new Error('standalone still contains the removed M01 reminder')
if (/V1\.5题库与报告联调版/.test(html)) throw new Error('standalone still uses the old V1.5 title')
console.log(`standalone OK: ${file}`)

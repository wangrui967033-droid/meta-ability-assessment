import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const previewPath = new URL('../design/元能力报告-学习起步路线预览.html', import.meta.url)
const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })

try {
  const assessment = await server.ssrLoadModule('/src/lib/assessment.ts')
  const earnedCounts = { memory: 3, language: 6, quantitative: 3, space: 6, reasoning: 4 }
  const mechanismSets = {
    memory: ['快速记住', '保持信息', '准确提取'],
    language: ['理解意思', '组织信息', '准确表达'],
    quantitative: ['感知数量', '处理符号', '理解变化'],
    space: ['识别结构', '空间想象', '空间转换'],
    reasoning: ['发现关系', '归纳规律', '推出结论'],
  }
  const evidence = Object.entries(earnedCounts).flatMap(([dimension, earnedCount], dimensionIndex) => Array.from({ length: 6 }, (_, index) => ({
    taskId: `preview-${dimension}-${index}`,
    position: dimensionIndex * 6 + index + 1,
    dimension,
    mechanism: mechanismSets[dimension][index % 3],
    role: 'direct',
    nodeScore: { earned: index < earnedCount ? 1 : 0, possible: 1 },
    diagnosticPoints: [index < earnedCount ? 1 : 0],
    durationMs: 18000,
  })))
  const report = assessment.buildPrototypeReport(evidence, '英语', ['语文', '英语', '数学', '物理'])
  const labels = assessment.dimensionLabels
  const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  const scoreValue = (score) => score === '基础' ? 100 : Number.parseFloat(score) || 0
  const representativeTopics = (plan, group) => {
    const sorted = group.tasks.flatMap((task) => task.graphTopics.map((topic) => ({ task, topic })))
      .sort((left, right) => scoreValue(right.topic.score) - scoreValue(left.topic.score))
    const modules = new Set()
    return sorted.filter(({ task }) => {
      if (modules.has(task.graphModule)) return false
      modules.add(task.graphModule)
      return true
    }).slice(0, 4)
  }

  const zoneCopy = {
    优势发挥区: '有优势命中了这门学科最常调用的元能力。',
    优势借力区: '优势元能力在这门学科中经常用到，但不是最主要的元能力。',
    待发展区: '当前优势与学科核心需求重合较少，需要带动其他元能力。',
  }
  const zones = ['优势发挥区', '优势借力区', '待发展区'].map((tier) => {
    const subjects = report.subjectOpportunityPlan.filter((item) => item.tier === tier)
    const body = subjects.length ? subjects.map((subject) => `<span><b>${escape(subject.subject)}</b><small>学科核心元能力：${subject.coreAbilities.map((ability) => labels[ability]).join('｜')}</small><small>直接命中的核心优势：${subject.directCoreMatches.length ? subject.directCoreMatches.map((ability) => labels[ability]).join('｜') : '暂无'}</small><small>可以提供帮助的其他优势元能力：${subject.supportingAdvantageMatches.length ? subject.supportingAdvantageMatches.map((ability) => labels[ability]).join('｜') : '暂无'}</small><small>判断依据：${escape(subject.reason)}</small><small>需要带动：${subject.otherAbilities.length ? subject.otherAbilities.map((ability) => labels[ability]).join('｜') : '暂无额外核心元能力'}</small></span>`).join('') : '<span><small>本次没有学科进入这一分区。</small></span>'
    return `<article class="zone"><div><h3>${tier}</h3><p>${zoneCopy[tier]}</p></div><div class="subjects">${body}</div></article>`
  }).join('') + '<p class="result-boundary">这张地图只说明优势在整门学科中的发挥机会，不代表整体元能力结构高度契合，也不代表成绩预测或最终选科结论。</p>'

  const taskCards = report.subjectTaskPlan.map((plan) => {
    const groups = plan.groups.map((group) => {
      const topics = representativeTopics(plan, group)
      const modules = topics.length ? topics.map(({ task, topic }) => {
        const match = topic.matchedAbilities.length
          ? `我的优势直接参与：${topic.matchedAbilities.map((dimension) => labels[dimension]).join('｜')}`
          : topic.matchedEntryAbilities.length
            ? `可以借优势进入：${topic.matchedEntryAbilities.map((dimension) => labels[dimension]).join('｜')}`
            : '需要带动其他元能力'
        const score = topic.displayScore ? `<span>${escape(topic.displayScore)}</span>` : ''
        return `<div class="module"><div class="module-title"><strong>${escape(topic.name)}</strong>${score}</div><small>所在模块：${escape(task.graphModule)}</small><small>主元能力：${topic.abilityDimensions.map((dimension) => labels[dimension]).join('｜')}</small><small>辅助元能力：${topic.entryDimensions.length ? topic.entryDimensions.map((dimension) => labels[dimension]).join('｜') : '无'}</small><small class="topic-match">${match}</small></div>`
      }).join('') : '<div class="zone-empty">本次没有代表任务放在这一组。</div>'
      return `<div class="strategy"><span class="tag ${group.label === '需要带动其他元能力' ? 'tag-develop' : ''}">${group.label}</span>${modules}</div>`
    }).join('')
    return `<article class="subject-card"><h3>${escape(plan.subject)}</h3>${groups}</article>`
  }).join('')

  let html = await readFile(previewPath, 'utf8')
  if (!html.includes('.result-boundary{')) html = html.replace('</style>', '.result-boundary{max-width:820px;margin:18px 0 0;color:var(--muted);font-size:11px;line-height:1.75}.module>small{display:block;margin-top:4px;color:var(--muted);font-size:10px}</style>')
  html = html.replace(/<!-- GENERATED_ZONES_START -->[\s\S]*?<!-- GENERATED_ZONES_END -->/, `<!-- GENERATED_ZONES_START -->${zones}<!-- GENERATED_ZONES_END -->`)
  html = html.replace(/<!-- GENERATED_TASKS_START -->[\s\S]*?<!-- GENERATED_TASKS_END -->/, `<!-- GENERATED_TASKS_START -->${taskCards}<!-- GENERATED_TASKS_END -->`)
  html = html.replace('报告预览｜01 我的核心结论</p><h1>', '报告预览｜01 我的核心结论</p><h1>')
  html = html.replace('</div></section>\n\n    <section class="section"><p class="title">02｜', '</div><p class="result-boundary">本次结果反映你在测评任务中的相对表现，用于发现更容易进入学习的方式，不直接代表学科成绩或决定学科选择。</p></section>\n\n    <section class="section"><p class="title">02｜')
  html = html.replaceAll('更容易用上</span>', '比较顺手</span>')
  html = html.replaceAll('比较容易用上</span>', '能较稳定地用上</span>')
  html = html.replaceAll('已经有表现</span>', '有时能用上</span>')
  html = html.replaceAll('还要多看看</span>', '还需要继续观察</span>')
  html = html.replaceAll('你能看出几句话、几个条件之间有什么关系。', '你能看懂几句话前后怎样接在一起。')
  html = html.replaceAll('你能看出几个量之间怎么对应。', '你能看懂数字、符号和几个量之间怎么对应。')
  html = html.replaceAll('你能从一堆信息里找出哪些是连在一起的。', '你能从条件里找出谁影响谁、谁限制谁。')
  html = html.replaceAll('看出几句话、几个条件之间的关系。', '看懂几句话前后怎样接在一起。')
  html = html.replaceAll('看出几个量之间怎样对应。', '看懂数字、符号和几个量之间怎么对应。')
  html = html.replaceAll('从信息里找出哪些是连在一起的。', '从条件里找出谁影响谁、谁限制谁。')
  html = html.replace('<b>还要继续发展</b><span>记忆、数理目前还要多练</span>', '<b>还需继续观察</b><span>记忆、数理在本次测评中没有语言和空间突出，仍需结合更多任务观察。</span>')
  html = html.replace('03｜我的优势可能在哪里发挥', '03｜我的学科机会地图')
  html = html.replace('同一项优势，放进不同学科能帮到哪里？', '哪些学科更容易发挥优势，哪些需要带动其他元能力？')
  html = html.replace('这里不把整门课分成“擅长”或“不擅长”，只把你的优势放回具体学习任务里，看它可能在哪些地方帮得上忙。', '这里只看整门学科：哪些更容易反复发挥优势、哪些需要带动其他元能力，以及为什么这样判断。')
  html = html.replace('我的能力结构，和整门学科的需要有多契合？', '哪些学科更容易发挥优势，哪些需要带动其他元能力？')
  html = html.replace(/这里比较的是你的五项元能力相对结构与整门学科的固定(?:元)?能力需求，不使用04里的知识任务数量，也不判断你“擅长或不擅长”这门课。/, '这里只看整门学科：哪些更容易反复发挥优势、哪些需要带动其他元能力，以及为什么这样判断。')
  html = html.replace(/<div class="plan-note"><b>这张图怎么来的？<\/b>[\s\S]*?<\/div><\/section>/, '</section>')
  html = html.replace('04｜我的知识任务策略图', '04｜我的学科任务机会图')
  html = html.replace('具体到每门课，哪些内容更容易用上我的优势？', '具体到每门课，哪些重点任务更容易用上我的优势？')
  html = html.replace(/<b>优势直接参与<\/b>：[^<]*；<b>可以借优势进入<\/b>：[^<]*；<b>需要带动其他能力<\/b>：[^<]*。/, '<b>优势直接参与</b>：优势包含任务预先标定的主元能力；<b>可以借优势进入</b>：优势不含主元能力，但包含预先标定的辅助元能力；<b>需要带动其他元能力</b>：优势与任务的主、辅助元能力都不重合。')
  html = html.replace('不同学科，我到底应该怎么学？', '这门课按什么顺序学？我的优势元能力在哪一步用？')
  html = html.replace('04告诉你哪些具体内容更容易借到优势；这里不再重复章节，而是把“语言 × 空间”变成一套整门课都能反复使用的学习顺序。', '每门课都按三件事说清楚：先看从学懂到会用的顺序，再找到优势元能力能帮上的一步，最后给出下次学习时可以直接照着走的路径。')
  const tentativeCopy = new Map([
    ['语言是主要入口，空间帮你整理', '先试语言理解，再试空间整理'],
    ['语言帮你理解和表达，空间帮你整理长文', '先试语言理解，再试空间整理'],
    ['空间帮你看见关系，语言帮你读清条件', '先试空间呈现，再试语言拆解'],
    ['空间帮你还原过程，语言帮你读清对象', '先试空间还原，再试语言确认'],
    ['先用自己的话说出内容和观点，再回到原文找依据。', '可以先用自己的话说出内容和观点，再回到原文找依据，看看是否更容易读清和表达。'],
    ['把文章分成几个部分，看清哪里展开、哪里转折、哪里收束。', '可以尝试把空间优势用在文章结构整理上，看看它能否帮助你更快看清段落关系。'],
    ['不要只记中文意思，把单词和语法放回句子里，先读懂它在表达什么。', '可以把单词和语法放回句子里，先读懂它在表达什么，看看是否更容易记住和使用。'],
    ['读长文时分出段落作用，标清信息位置和前后联系，回原文更快。', '可以试着分出段落作用，标清信息位置和前后联系，看看回原文时是否更快。'],
    ['遇到图形、函数和变化关系，先画出来、标位置，再进入公式。', '可以先把图形、函数和变化关系画出来、标清位置，再进入公式，看看关系是否更容易看懂。'],
    ['先说清已知什么、要求什么，把长条件拆成几条数学关系。', '可以先说清已知什么、要求什么，再把长条件拆成几条数学关系。'],
    ['把研究对象、方向、状态和变化过程画出来，让看不见的关系变得清楚。', '可以先画出研究对象、方向、状态和变化过程，看看关系是否更容易看清。'],
    ['先说清研究谁、发生什么、求什么，减少看漏条件和对象混淆。', '可以先说清研究谁、发生什么、求什么，再检查有没有看漏条件或混淆对象。'],
  ])
  tentativeCopy.forEach((next, current) => { html = html.replaceAll(current, next) })
  html = html.replaceAll('词汇是基础，但不参与优势分类', '英语的完整学习路径')
  html = html.replaceAll('<b>这门课怎么学</b>', '<b>学科规律</b>')
  html = html.replaceAll('<b>你的优势怎么帮</b>', '<b>优势作用</b>')
  html = html.replace(/<b>你的起步顺序<\/b><small>.*?<\/small>/g, '<b>我的学法</b><small>更适合你怎么完成</small>')
  html = html.replace(/\n  <script>[\s\S]*?<\/script>(?=\n<\/body>)/, '')
  await writeFile(previewPath, html)
} finally {
  await server.close()
}

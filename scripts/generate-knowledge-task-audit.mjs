import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const outputPath = new URL('../design/知识任务元能力映射审核表.html', import.meta.url)
const server = await createServer({ root, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })

const labels = {
  memory: '记忆',
  language: '语言',
  quantitative: '数理',
  space: '空间',
  reasoning: '推演',
}

const escape = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

try {
  const mappingModule = await server.ssrLoadModule('/src/data/knowledge-task-ability-map.ts')
  const rows = mappingModule.buildKnowledgeTaskAuditRows()
  const subjects = [...new Set(rows.map((row) => row.subject))]
  const reviewedCount = rows.filter((row) => row.reviewStatus === '图谱已标注').length
  const pendingCount = rows.length - reviewedCount
  const tableRows = rows.map((row, index) => `
    <tr data-subject="${escape(row.subject)}" data-status="${escape(row.reviewStatus)}">
      <td class="index">${index + 1}</td>
      <td><b>${escape(row.subject)}</b></td>
      <td>${escape(row.module)}</td>
      <td><b>${escape(row.task)}</b>${row.score ? `<small>${escape(row.score)}</small>` : ''}</td>
      <td>${escape(row.typicalAction)}</td>
      <td>${row.mechanisms.map(escape).join('｜')}</td>
      <td class="ability primary">${row.primary.map((item) => labels[item]).join('｜')}</td>
      <td class="ability">${row.supporting.length ? row.supporting.map((item) => labels[item]).join('｜') : '无'}</td>
      <td>${escape(row.basis)}</td>
      <td><span class="status ${row.reviewStatus === '图谱已标注' ? 'reviewed' : 'pending'}">${escape(row.reviewStatus)}</span><small class="source">${escape(row.source)}</small></td>
    </tr>`).join('')

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>知识任务元能力映射审核表</title>
  <style>
    :root{--paper:#f6f7f9;--ink:#10284d;--text:#50617a;--gold:#b77a17;--line:#d7dee8;--soft:#eaf0f7;--white:#fff;--warn:#fff5df;--ok:#e9f5ee}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif}.page{width:min(1680px,calc(100% - 48px));margin:28px auto 72px}.eyebrow{margin:0 0 12px;color:var(--gold);font-size:14px;letter-spacing:.08em}.hero{padding:34px 38px;background:var(--white);border-top:4px solid var(--gold);box-shadow:0 8px 30px rgba(16,40,77,.06)}h1{margin:0;font-family:"Songti SC",SimSun,serif;font-size:38px;letter-spacing:.02em}.lead{max-width:1050px;margin:18px 0 0;color:var(--text);font-size:16px;line-height:1.8}.metrics{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}.metrics span{padding:9px 14px;border:1px solid var(--line);border-radius:999px;color:var(--text);background:#fbfcfd}.metrics b{color:var(--ink)}.notice{margin:22px 0 0;padding:16px 18px;border-left:4px solid var(--gold);background:var(--soft);color:var(--text);line-height:1.75}.toolbar{position:sticky;top:0;z-index:3;display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:18px;padding:12px 0;background:rgba(246,247,249,.96);backdrop-filter:blur(8px)}button{appearance:none;padding:9px 14px;border:1px solid var(--line);border-radius:999px;background:var(--white);color:var(--ink);font:inherit;cursor:pointer}button.active{border-color:var(--gold);background:#fff9ee;color:#8a5b0d}.table-wrap{overflow:auto;border:1px solid var(--line);background:var(--white)}table{width:100%;min-width:1500px;border-collapse:collapse;font-size:13px;line-height:1.55}thead{position:sticky;top:59px;z-index:2;background:var(--ink);color:#fff}th{padding:13px 12px;text-align:left;white-space:nowrap}td{padding:13px 12px;border-bottom:1px solid var(--line);vertical-align:top;color:var(--text)}tr:hover td{background:#fbfcff}td.index{color:#98a3b3;text-align:right}td b,td.ability{color:var(--ink)}td.primary{font-weight:700}td small{display:block;margin-top:5px;color:var(--gold)}.status{display:inline-block;padding:4px 8px;border-radius:4px;white-space:nowrap}.status.reviewed{background:var(--ok);color:#28714b}.status.pending{background:var(--warn);color:#8a5b0d}.source{max-width:210px;overflow-wrap:anywhere;color:#97a1b0!important}.empty{padding:36px;text-align:center;color:var(--text)}
    @media print{body{background:#fff}.page{width:100%;margin:0}.hero{box-shadow:none}.toolbar{display:none}.table-wrap{overflow:visible;border:0}table{min-width:0;font-size:9px}thead{position:static}th,td{padding:7px 5px}.source{display:none}}
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <p class="eyebrow">元能力 × 知识图谱｜教研复核材料</p>
      <h1>知识任务元能力映射审核表</h1>
      <p class="lead">本表按固定链路呈现：二级知识内容 → 典型任务动作 → 具体元能力要求 → 主元能力 → 辅助元能力。映射不读取学生结果；同一任务面对不同学生时，主辅元能力保持不变。</p>
      <div class="metrics"><span>任务总数 <b>${rows.length}</b></span><span>图谱已标注 <b>${reviewedCount}</b></span><span>待教研复核 <b>${pendingCount}</b></span></div>
      <p class="notice"><b>审核边界：</b>“待教研复核”是用于逐项确认的 V1 候选标注，不代表已经通过学科教研。教师确认后，应把主、辅助元能力及标注依据写回知识图谱，再进入正式报告。分值只按“约 X 分／高频／中频／低频”展示，不参与元能力匹配。</p>
    </section>
    <nav class="toolbar" aria-label="审核表筛选">
      <button class="active" data-filter="all">全部</button>
      ${subjects.map((subject) => `<button data-filter="subject:${escape(subject)}">${escape(subject)}</button>`).join('')}
      <button data-filter="status:待教研复核">只看待复核</button>
      <button type="button" data-print>打印 / 导出 PDF</button>
    </nav>
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>学科</th><th>一级模块</th><th>二级知识任务</th><th>典型任务动作</th><th>具体元能力要求</th><th>主元能力</th><th>辅助元能力</th><th>标注依据</th><th>审核状态</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <p class="empty" hidden>当前筛选下没有任务。</p>
    </div>
  </main>
  <script>
    const buttons=[...document.querySelectorAll('[data-filter]')];const rows=[...document.querySelectorAll('tbody tr')];const empty=document.querySelector('.empty');buttons.forEach(button=>button.addEventListener('click',()=>{buttons.forEach(item=>item.classList.remove('active'));button.classList.add('active');const filter=button.dataset.filter;let visible=0;rows.forEach(row=>{const show=filter==='all'||filter.startsWith('subject:')&&row.dataset.subject===filter.slice(8)||filter.startsWith('status:')&&row.dataset.status===filter.slice(7);row.hidden=!show;if(show)visible+=1});empty.hidden=visible!==0}));document.querySelector('[data-print]').addEventListener('click',()=>window.print());
  </script>
</body>
</html>`

  await writeFile(outputPath, html)
  console.log(`Generated ${fileURLToPath(outputPath)} with ${rows.length} rows (${pendingCount} pending review).`)
} finally {
  await server.close()
}

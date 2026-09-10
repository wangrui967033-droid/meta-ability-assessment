import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const out=join(root,'design','300-500分模拟复测')
await mkdir(out,{recursive:true})
const server=await createServer({root,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
const dims=['memory','language','quantitative','space','reasoning']
const subjects=['语文','数学','英语','物理','化学','生物']
const cases=[
 [300,'均衡练习型',[5,5,5,5,5]], [300,'推演突出型',[4,5,4,5,10]], [300,'语言记忆突出型',[9,9,3,4,5]],
 [350,'均衡练习型',[6,6,6,6,6]], [350,'数理推演突出型',[5,5,9,5,9]], [350,'空间突出型',[5,6,5,10,6]],
 [400,'均衡练习型',[8,8,8,8,8]], [400,'数理推演突出型',[6,6,10,7,10]], [400,'语言记忆突出型',[10,10,6,6,7]],
 [450,'均衡支持型',[9,9,9,9,9]], [450,'数理推演突出型',[7,7,11,8,11]], [450,'语言记忆突出型',[11,11,7,7,8]],
 [500,'均衡支持型',[10,10,10,10,10]], [500,'数理推演突出型',[8,8,12,8,12]], [500,'语言记忆突出型',[12,12,8,8,8]],
 ['边界','五项均在门槛下',[8,8,8,8,8]], ['边界','仅推演多对一题',[8,8,8,8,9]],
 ['边界','仅推演满分其余零分',[0,0,0,0,12]], ['边界','全部零分',[0,0,0,0,0]],
 ['边界','未提交任何作答',[0,0,0,0,0],'missing'], ['边界','空答案提交',[0,0,0,0,0],'blank'],
 ['边界','仅推演再多对一题',[8,8,8,8,10]],
]
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
try{
 const {assessmentTasksV16:tasks}=await server.ssrLoadModule('/src/data/assessment-bank-v1.6.ts')
 const {orderedV16Tasks:keys}=await server.ssrLoadModule('/src/data/meta-bank-v1.6.ts')
 const {LocalPrototypeAdapter}=await server.ssrLoadModule('/src/lib/transport.ts')
 const {buildPrototypeReport}=await server.ssrLoadModule('/src/lib/assessment.ts')
 const {createSessionSnapshot}=await server.ssrLoadModule('/src/lib/session.ts')
 const {auditTaskTransition}=await server.ssrLoadModule('/src/lib/task-distribution-audit.ts')
 const adapter=new LocalPrototypeAdapter()
 let rejectedBlankTasks=0
 const totals=Object.fromEntries(dims.map(d=>[d,tasks.filter(t=>t.dimension===d).reduce((n,t)=>n+t.interaction.items.length,0)]))
 async function responses(counts,mode){
   if(mode==='missing')return []
   const positions=Object.fromEntries(dims.map(d=>[d,0]));const result=[]
   for(const [index,task] of tasks.entries()){
     const response={kind:'multi-choice',answers:{}}
     for(const [i,item] of keys[index].items.entries()){
       const rank=(positions[task.dimension]++*5)%totals[task.dimension]
       const wrong=task.interaction.items[i].options.find(o=>o.id!==item.correctAnswer)?.id
       if(!wrong)throw Error('Missing distractor')
       if(mode!=='blank')response.answers[String(i)]=rank<Math.round(counts[dims.indexOf(task.dimension)]/12*totals[task.dimension])?item.correctAnswer:wrong
     }
     try{
       const evidence=await adapter.submit({task,response,durationMs:18000})
       if(mode==='blank')throw Error('Blank response unexpectedly accepted')
       result.push({position:task.position,response,evidence,submittedAt:'2026-09-08T12:00:00.000Z'})
     }catch(error){if(mode==='blank' && error.message.includes('作答不完整'))rejectedBlankTasks++;else throw error}
   }
   return result
 }
 function summarize(report){
   const topics=report.subjects.flatMap(s=>s.tasks.flatMap(t=>t.graphTopics))
   const counts={supported:0,entry:0,attention:0,unknown:0}
   for(const t of topics)counts[t.support.status]++
   return {scores:Object.fromEntries(report.dimensionSummary.map(d=>[d.dimension,d.signal])),evidence:report.dimensionSummary.map(d=>[d.label,d.evidenceQuality]),highlight:report.advantageDimensions,relative:report.relativeDimensions,subjects:report.subjectOpportunityPlan.map(s=>({subject:s.subject,tier:s.tier})),counts,taskCount:topics.length}
 }
 function auditSnapshot(report){
   return report.subjects.flatMap(s=>s.tasks.flatMap(t=>t.graphTopics.map(topic=>({
     id:`${s.subject}::${t.label}::${topic.name}`,status:topic.support.status,pendingReason:topic.support.pendingReason,
     required:Object.keys(topic.support.details),paths:topic.support.usablePaths.map(p=>p.action),
     details:topic.support.details,stabilityReview:topic.support.stabilityReview,blocked:topic.support.blocked,mappingSource:topic.mappingSource,
     mappingBasis:topic.mappingBasis,reviewStatus:topic.reviewStatus,
   }))))
 }
 const template=await readFile(join(root,'design','元能力学习画像-报告端.html'),'utf8')
 const results=[]
 const snapshots=[]
 for(const [index,[band,label,counts,mode]] of cases.entries()){
   const answers=await responses(counts,mode)
   const report=buildPrototypeReport(answers.map(a=>a.evidence),'英语',subjects)
   const session=createSessionSnapshot()
   Object.assign(session,{responses:answers,screen:'report',completedTaskCount:answers.length,actualDurationMs:540000,reportGeneratedAt:'2026-09-08T12:00:00.000Z',intake:{name:`合成样例｜${band}${typeof band==='number'?'分':''}｜${label}`,grade:'高三',foreignLanguage:'英语',selectedSubjects:['物理','化学','生物']}})
   const file=String(index+1).padStart(2,'0')+'-'+band+'-'+label+'.html'
   const html=template.replace(/window\.__META_ABILITY_REPORT_PREVIEW__=[\s\S]*?;<\/script>/,()=>`window.__META_ABILITY_REPORT_PREVIEW__=${JSON.stringify(session).replaceAll('<','\\u003c')};</script>`)
   await writeFile(join(out,file),html)
   results.push({band,label,file,...summarize(report)})
   snapshots.push(auditSnapshot(report))
 }
 // 4^5 profiles cover low, just-below-threshold, boundary and full marks.
 let profiles=0,violations=0;const examples=[]
 const gridStates=[]
 for(let id=0;id<1024;id++){
   let code=id;const counts=dims.map(()=>{const n=[0,8,9,12][code%4];code=Math.floor(code/4);return n})
   const answers=await responses(counts)
   const report=buildPrototypeReport(answers.map(a=>a.evidence),'英语',subjects)
   const raw=Object.fromEntries(dims.map(d=>{const nodes=answers.filter(a=>a.evidence.dimension===d);return[d,nodes.reduce((n,a)=>n+a.evidence.nodeScore.earned/a.evidence.nodeScore.possible,0)/nodes.length]}))
   for(const topic of report.subjects.flatMap(s=>s.tasks.flatMap(t=>t.graphTopics))){
     const status=topic.support.status
     const meetsThreshold=topic.abilityDimensions.every(d=>raw[d]>=.75)
     const invalid=(status==='supported'&&(!meetsThreshold||topic.support.blocked.length))
       ||(status==='entry'&&(!topic.support.usablePaths.length||topic.support.blocked.length))
       ||(topic.mappingSource.startsWith('subject-framework:')&&status!=='unknown')
       ||(status!=='unknown'&&topic.support.missing.length)
     if(invalid){violations++;if(examples.length<5)examples.push({counts,name:topic.name,status})}
   }
   gridStates.push(auditSnapshot(report))
   profiles++
 }
 let improvingPairs=0,visibilityRegressions=0
 for(let id=0;id<1024;id++)for(let d=0;d<5;d++){
   const step=4**d
   if(Math.floor(id/step)%4===3)continue
   improvingPairs++
   gridStates[id].forEach((t,i)=>{if(t.status!=='unknown'&&gridStates[id+step][i].status==='unknown')visibilityRegressions++})
 }
 const output={assumption:'300–500为750分制学科总分场景标签；与元能力作答无已验证换算关系。全部为人为设定合成作答，不代表真实分数段分布。',dimensionOrder:dims,totals,results,rejectedBlankTasks,grid:{profiles,violations,examples}}
 await writeFile(join(out,'results.json'),JSON.stringify(output,null,2))
 const rows=results.map(r=>`<tr><td>${r.band}</td><td><a href="${encodeURI(r.file)}">${escape(r.label)}</a></td><td>${dims.map(d=>r.scores[d]).join(' / ')}</td><td>${r.subjects.map(s=>`${s.subject}：${s.tier}`).join('<br>')}</td><td>${r.counts.supported} / ${r.counts.entry} / ${r.counts.attention} / ${r.counts.unknown}</td></tr>`).join('')
 await writeFile(join(out,'模拟验收总览.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>300–500分合成场景验收</title><style>body{font:16px/1.7 system-ui;margin:32px;color:#10213f;background:#f7f9fc}table{border-collapse:collapse;width:100%;background:white}td,th{padding:14px;text-align:left;border:1px solid #ccd3dc;vertical-align:top}a{color:#245a8d}p{max-width:1000px}.scroll{overflow:auto}</style><h1>300–500分合成场景验收</h1><p>${output.assumption}</p><p>点击样例名称查看实际报告。五项顺序：记忆／语言／数理／空间／推演。任务数量顺序：优势可发挥／可借力／待发展／隐藏。共${results.length}份报告及1024组规则组合；规则一致性错误：${violations}。</p><div class="scroll"><table><thead><tr><th>场景标签</th><th>作答组合</th><th>五项得分比例</th><th>学科分类</th><th>任务数量</th></tr></thead><tbody>${rows}</tbody></table></div></html>`)
 const transitions=[[15,16],[16,21]].map(([a,b])=>({from:results[a].label,to:results[b].label,...auditTaskTransition(snapshots[a],snapshots[b],['reasoning'])}))
 // 相同维度总分、不同组题分布：差异应可追溯，不要求强行同分类。
 const sameScore=[]
 const base=(await responses([9,9,9,9,9])).map(a=>a.evidence)
 for(const d of dims){
   const reports=[[.75,.75,.75,.75,.75,.75],[1,1,1,.5,.5,.5]].map(pattern=>{
     let i=0
     return buildPrototypeReport(base.map(e=>e.dimension===d?{...e,nodeScore:{earned:pattern[i++],possible:1}}:e),'英语',subjects)
   })
   sameScore.push({dimension:d,...auditTaskTransition(auditSnapshot(reports[0]),auditSnapshot(reports[1]),[d])})
 }
 const pending=results.map((r,i)=>({label:`${r.band}-${r.label}`,insufficient:snapshots[i].filter(t=>t.pendingReason==='insufficient').length,stabilityReview:snapshots[i].filter(t=>t.stabilityReview?.length).length,counts:r.counts}))
 const audit={note:'预警仅供审核，不自动修改分类比例。借力路径仍待教研验证；记录每个变动任务及其路径、关键缺口和映射依据。',improvingPairs,visibilityRegressions,pending,transitions,sameScore,snapshots}
 await writeFile(join(out,'任务分布验收.json'),JSON.stringify(audit,null,2))
 const lines=[...transitions.map(t=>`${t.from} → ${t.to}：${t.changed}/${t.total} 项变化；批量预警=${t.bulkWarning}；无关联变化=${t.unexplained.length}`),...sameScore.map(t=>`${t.dimension}同分不同组题分布：${t.changed}/${t.total} 项变化；无关联变化=${t.unexplained.length}`)]
 await writeFile(join(out,'任务分布验收.md'),`# 任务分布验收\n\n${audit.note}\n\n${lines.map(l=>'- '+l).join('\n')}\n\n完整逐任务依据见同目录任务分布验收.json。\n`)
 const unexplained=[...transitions,...sameScore].flatMap(t=>t.unexplained)
 console.log(JSON.stringify({reports:results.length,rejectedBlankTasks,grid:output.grid,improvingPairs,visibilityRegressions,distribution:lines},null,2))
 if(violations || unexplained.length || visibilityRegressions) throw new Error('Classification invariant, unrelated transition or visibility regression failed')
}finally{await server.close()}

import {writeFile} from 'node:fs/promises'
import {createServer} from 'vite'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const server=await createServer({root,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
try{
 const {knowledgeGraphCatalog}=await server.ssrLoadModule('/src/data/knowledge-graph-catalog.ts')
 const {resolveKnowledgeTaskAbility}=await server.ssrLoadModule('/src/data/knowledge-task-ability-map.ts')
 const {taskLearningContext}=await server.ssrLoadModule('/src/data/task-learning-paths.ts')
 const {dimensionLabels:labels}=await server.ssrLoadModule('/src/lib/assessment.ts')
 const rows=knowledgeGraphCatalog.flatMap(module=>(module.topics.length?module.topics:[{name:module.name,score:module.score}]).map(topic=>{
   const mapping=resolveKnowledgeTaskAbility(module.subject,module.name,topic)
   const context=taskLearningContext(mapping.learningRuleId,mapping.primary,mapping.entry)
   return {subject:module.subject,module:module.name,task:topic.name,primary:mapping.primary.map(d=>labels[d]).join('、'),essential:context.essential.map(d=>labels[d]).join('、'),paths:context.paths.map(p=>labels[p.ability]+'：'+p.action).join('；'),basis:mapping.basis,rule:mapping.learningRuleId??'无具体路径规则',review:'待教研复核'}
 }))
 const fields=['subject','module','task','primary','essential','paths','basis','rule','review']
 const csv='\ufeff'+['学科,模块,任务,主要要求,不可绕过要求,借力步骤,现有依据,规则,审核状态',...rows.map(row=>fields.map(k=>'"'+row[k].replaceAll('"','""')+'"').join(','))].join('\n')
 await writeFile(join(root,'design','任务借力路径-教研审核表.csv'),csv)
 console.log(JSON.stringify({tasks:rows.length,withPaths:rows.filter(r=>r.paths).length,status:'全部待教研复核'}))
}finally{await server.close()}

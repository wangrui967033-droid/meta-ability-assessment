import { expect, it } from 'vitest'
import { buildPrototypeReport, type ScoredEvidence } from './assessment'

const names = { memory: ['快速记住','保持信息','准确提取'], language: ['理解意思','组织信息','准确表达'], quantitative: ['感知数量','处理符号','理解变化'], space: ['识别结构','空间想象','空间转换'], reasoning: ['发现关系','归纳规律','推出结论'] } as const
function fixture(value: number): ScoredEvidence[] {
  return Object.entries(names).flatMap(([dimension, mechanisms], d) => mechanisms.flatMap((mechanism, m) => [0,1].map(i => ({taskId:`${dimension}-${m}-${i}`,position:d*6+m*2+i,dimension:dimension as ScoredEvidence['dimension'],mechanism,role:'direct',nodeScore:{earned:value,possible:1},diagnosticPoints:[],durationMs:1000}))))
}
const topics = (e: ScoredEvidence[]) => buildPrototypeReport(e,'英语',['数学']).subjects.flatMap(s=>s.tasks.flatMap(t=>t.graphTopics))

it('keeps every displayed task in one student-facing strategy group', () => {
  const report = buildPrototypeReport(fixture(.8),'英语',['数学'])
  expect(report.advantageDimensions).toEqual([])
  expect(report.subjects[0].tasks.flatMap(task => task.graphTopics)
    .every(topic => ['优势直接参与', '可以借优势进入', '需要带动其他元能力', '重点练习', '暂不判断'].includes(topic.strategy))).toBe(true)
})
it('blocks direct classification when quantitative prerequisites are zero', () => {
  const evidence = fixture(0).map(item => item.dimension === 'reasoning' ? {...item, nodeScore:{earned:1,possible:1}} : item)
  const report = buildPrototypeReport(evidence,'英语',['数学'])
  const direct = report.subjects[0].tasks.flatMap(task => task.graphTopics).filter(topic => topic.strategy === '优势直接参与')
  expect(direct).toHaveLength(0)
  expect(direct.every(topic => topic.matchedAbilities.includes('reasoning'))).toBe(true)
})
it('does not label unobserved abilities as a student advantage', () => {
  const report = buildPrototypeReport([], '英语', ['数学'])
  expect(report.advantageDimensions).toEqual([])
  expect(topics([]).every(topic => topic.strategy === '暂不判断')).toBe(true)
})
it('groups every subject task once in the report plan', () => {
  const report = buildPrototypeReport(fixture(1),'英语',['数学'])
  const grouped = report.subjectTaskPlan[0].groups.flatMap(group => group.tasks)
  const keys=grouped.flatMap(task=>task.graphTopics.map(topic=>task.label+'::'+topic.name))
  expect(keys.length).toBe(report.subjects[0].tasks.reduce((n,t)=>n+t.graphTopics.length,0))
  expect(new Set(keys).size).toBe(keys.length)
})

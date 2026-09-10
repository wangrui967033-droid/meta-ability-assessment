import { expect, it } from 'vitest'
import { orderedV16Tasks } from './meta-bank-v1.6'
import chartA from '../assets/source-v1.6-quality/n03-trend-a.svg?raw'
import chartB from '../assets/source-v1.6-quality/n03-trend-b.svg?raw'
import lineA from '../assets/source-v1.6-quality/n02-line-a.svg?raw'
import lineB from '../assets/source-v1.6-quality/n02-line-b.svg?raw'
import graph from '../assets/source-v1.6-quality/r06-order-graph.svg?raw'
const task=(code:string)=>orderedV16Tasks.find(t=>t.code===code)!
it('verifies integer number-line answers from actual rendered coordinates',()=>{
 for(const [i,svg,min,max,target] of [[0,lineA,20,100,57],[1,lineB,40,160,109]] as const){
  const xs=[...svg.matchAll(/<line x1="([\d.]+)" y1="130"/g)].map(m=>Number(m[1]))
  expect(xs).toHaveLength(4)
  const targetX=75+(target-min)/(max-min)*570
  const distances=xs.map(x=>Math.abs(x-targetX))
  const best=distances.indexOf(Math.min(...distances))
  expect(task('N02').items[i].correctAnswer).toBe('ABCD'[best])
  expect(distances.filter(d=>Math.abs(d-distances[best])<0.001)).toHaveLength(1)
 }
})
it('checks both trend claims using plotted data rather than future extrapolation',()=>{
 const parse=(svg:string)=>svg.match(/data-series="([^"]+)"/)![1].split(';').map(s=>s.split(',').map(Number))
 const diff=(a:number[])=>a.slice(1).map((x,i)=>x-a[i])
 const [a,b]=parse(chartA)
 expect(diff(a)).toEqual([4,3,2]);expect(diff(b)).toEqual([2,3,4])
 expect(task('N03').items[0].correctAnswer).toBe('C')
 const [c,d]=parse(chartB)
 expect(diff(c)).toEqual(diff(d))
 expect(new Set(c.map((v,i)=>d[i]-v))).toEqual(new Set([4]))
 expect(task('N03').items[1].correctAnswer).toBe('B')
 expect(task('N03').items.map(i=>i.text).join('')).not.toMatch(/下一项|下一次/)
})
it('checks R03 cyclic transformations against the keyed options',()=>{
 const output=(i:number)=>task('R03').items[i].options.find(o=>o.id===task('R03').items[i].correctAnswer)!.label
 const left=(a:string)=>a.slice(1)+a[0]
 const right=(a:string)=>a.at(-1)!+a.slice(0,-1)
 expect(output(0)).toBe(left('□◇○△'))
 expect(output(1)).toBe(right('●○●○○'))
})
it('checks R04 against bounded simple rule families, not arbitrary mathematical continuations',()=>{
 for(const question of task('R04').items){
  const entries=[...question.text.matchAll(/([○△□◇])(\d+)/g)]
  const shapes=entries.map(m=>m[1]), nums=entries.map(m=>Number(m[2]))
  expect(entries).toHaveLength(7)
  const periods=[1,2,3,4].filter(p=>shapes.every((v,i)=>v===shapes[i%p]))
  expect(periods).toEqual([3])
  const fits:number[][]=[]
  for(let base=-6;base<=6;base++)for(let growth=-2;growth<=2;growth++)for(let even=-6;even<=6;even++){
   const candidate=[nums[0]]
   for(let step=1;step<=7;step++)candidate.push(candidate.at(-1)!+(step%2?base+growth*Math.floor(step/2):even))
   if(nums.every((v,i)=>v===candidate[i]))fits.push(candidate)
  }
  expect(fits).toHaveLength(1)
  const answer=shapes[7%3]+fits[0][7]
  expect(question.options.filter(o=>o.label===answer)).toHaveLength(1)
  expect(question.options.find(o=>o.label===answer)!.id).toBe(question.correctAnswer)
 }
})
it('R06 actual figure encodes only the intended order constraints',()=>{
 expect(graph).toContain('data-edges="甲-乙,丙-乙,乙-丁"')
 expect((graph.match(/marker-end=/g)||[])).toHaveLength(1)
 expect(task('R06').items[0].asset).toBe('r06-order-graph')
 expect(task('R06').items[1].asset).toBeUndefined()
})

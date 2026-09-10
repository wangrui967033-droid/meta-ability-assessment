import { expect, it } from 'vitest'
import { compositions, gaps, rotations, rotate, mapShape, type P, type Shape } from './spatial-refinement'
import { orderedV16Tasks } from './meta-bank-v1.6'
const task=(code:string)=>orderedV16Tasks.find(t=>t.code===code)!
const shapeKey=(s:Shape)=>{const origin=s.path[0];return JSON.stringify(mapShape(s,([x,y])=>[x-origin[0],y-origin[1]]))}
it('finds exactly one rigid rotation including branches and both markers',()=>{
 for(const [i,c] of rotations.entries()){
  const valid=c.options.map((o,j)=>[0,1,2,3].some(k=>shapeKey(rotate(c.target,k))===shapeKey(o))?j:-1).filter(j=>j>=0)
  expect(valid).toEqual([c.answer]);expect(task('S03').items[i].correctAnswer).toBe('ABCD'[c.answer])
 }
})
const cellKey=(cells:P[])=>{const x=Math.min(...cells.map(p=>p[0])),y=Math.min(...cells.map(p=>p[1]));return cells.map(p=>[p[0]-x,p[1]-y].join(',')).sort().join(';')}
it('checks composition placement, equal area, connectedness and unique fixed-direction outline',()=>{
 for(const [i,c]of compositions.entries()){
  expect(c.edgeRight.map(([x,y])=>[x+c.offset[0],y+c.offset[1]])).toEqual(c.edgeLeft)
  const union:P[]=[...c.left,...c.right.map(([x,y]):P=>[x+c.offset[0],y+c.offset[1]])]
  expect(new Set(union.map(p=>p.join(','))).size).toBe(10)
  const matches=c.options.map((o,j)=>cellKey(o)===cellKey(union)?j:-1).filter(j=>j>=0)
  expect(matches).toEqual([c.answer]);expect(task('S04').items[i].correctAnswer).toBe('ABCD'[c.answer])
  for(const cells of c.options){
   expect(new Set(cells.map(p=>p.join(','))).size).toBe(10)
   const seen=new Set<string>(),queue=[cells[0]]
   while(queue.length){const p=queue.pop()!;if(seen.has(p.join(',')))continue;seen.add(p.join(','));queue.push(...cells.filter(q=>!seen.has(q.join(','))&&Math.abs(q[0]-p[0])+Math.abs(q[1]-p[1])===1))}
   expect(seen.size).toBe(10)
  }
 }
})
it('keeps all six ports used once and only one matching partition',()=>{
 for(const [i,c]of gaps.entries()){
  for(const p of c.options)expect(p.flat().sort()).toEqual([0,1,2,3,4,5])
  const matches=c.options.map((p,j)=>JSON.stringify(p)===JSON.stringify(c.pairs)?j:-1).filter(j=>j>=0)
  expect(matches).toEqual([c.answer]);expect(task('S02').items[i].correctAnswer).toBe('ABCD'[c.answer])
 }
})

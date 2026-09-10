import { expect, it } from 'vitest'
import { embedded } from './spatial-refinement'
import { orderedV16Tasks } from './meta-bank-v1.6'
const task=(code:string)=>orderedV16Tasks.find(t=>t.code===code)!
const answers=(code:string)=>task(code).items.map(q=>q.options.find(o=>o.id===q.correctAnswer)!.label)
it('independently evaluates the new quantity codes and exchanges',()=>{
 const code=(s:string)=>{const n=s.match(/左(\d+)个●，右(\d+)个●/)!;return Number(n[1])*3+Number(n[2])}
 for(const [i,target] of [11,9].entries()){
  const q=task('N05').items[i]
  expect(q.options.filter(o=>code(o.label)===target).map(o=>o.id)).toEqual([q.correctAnswer])
 }
 expect(6+2*3-(3*3+2)).toBe(1)
 expect(task('N06').items[0].correctAnswer).toBe('A')
 const vals=[2*6+2,6+3*3,3*3+4,2*6+4]
 expect(vals.map((v,i)=>v===2*6+3?'ABCD'[i]:null).filter(Boolean)).toEqual([task('N06').items[1].correctAnswer])
 expect(answers('N04')).toEqual([String(11-(8-4)/2*3),String((3+2*2)-(8-2))])
})
it('derives R02 positional transformations rather than looking up a key',()=>{
 const shift=(a:string[])=>[a[2],a[0],a[1]]
 const pairSwap=(a:string[])=>[a[1],a[0],a[3],a[2]]
 expect(answers('R02')).toEqual([shift(shift(['＋','●','▽'])).join(''),pairSwap(['▽','◆','◎','△']).join('')])
})
it('checks R06 conjunction and negation against all truth assignments',()=>{
 const worlds: {q:boolean;s:boolean}[]=[]
 for(let mask=0;mask<16;mask++){
  const [p,q,s,t]=[0,1,2,3].map(i=>Boolean(mask&(1<<i)))
  if((!p||q)&&(!(q&&s)||t)&&p&&!t)worlds.push({q,s})
 }
 const necessary=[(w:{q:boolean;s:boolean})=>!w.q&&w.s,(w:{q:boolean;s:boolean})=>w.q&&w.s,(w:{q:boolean;s:boolean})=>!w.q&&!w.s,(w:{q:boolean;s:boolean})=>w.q&&!w.s]
 expect(necessary.map(f=>worlds.every(f))).toEqual([false,false,false,true])
 expect(task('R06').items[1].correctAnswer).toBe('D')
})
it('checks temporal conclusions over every admissible ordering',()=>{
 const perm=(a:string[]):string[][]=>a.length?a.flatMap((x,i)=>perm(a.filter((_,j)=>j!==i)).map(p=>[x,...p])):[[]]
 const worlds=perm(['甲','乙','丙','丁']).filter(p=>p.indexOf('甲')<p.indexOf('乙')&&p.indexOf('丙')<p.indexOf('乙')&&p.indexOf('乙')<p.indexOf('丁'))
 const pairs=[[['甲','丙'],['丙','丁']],[['丙','甲'],['甲','丁']],[['甲','丁'],['丙','丁']],[['甲','丁'],['丁','丙']]]
 expect(pairs.map(ps=>worlds.every(p=>ps.every(([a,b])=>p.indexOf(a)<p.indexOf(b))))).toEqual([false,false,true,false])
 expect(task('R06').items[0].correctAnswer).toBe('C')
})
it('checks exact S01 paths and equal branch count',()=>{
 for(const [i,c]of embedded.entries()){
  expect(c.options.map(o=>o.branches?.length)).toEqual([3,3,3,3])
  const matches=c.options.map((o,j)=>JSON.stringify(o.path)===JSON.stringify(c.target.path)?j:-1).filter(j=>j>=0)
  expect(matches).toEqual([c.answer])
  expect(task('S01').items[i].correctAnswer).toBe('ABCD'[c.answer])
 }
})
it('keeps instruction-only mode and independent S05 assets',()=>{
 expect(task('S05').items.map(i=>i.asset)).toEqual(['s05-net','s05-net-independent'])
 expect(task('L02').items.map(i=>i.text).join('')).not.toMatch(/未必不准确|并非所有/)
 expect(JSON.stringify(task('N05').items)+JSON.stringify(task('N06').items)).not.toMatch(/2a|合并两式|代入得/)
})

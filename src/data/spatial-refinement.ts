export type P = [number, number]
export interface Shape { path: P[]; closed?: boolean; branches?: P[][]; marks: { at: P; solid: boolean }[] }
const copy=(s:Shape):Shape=>JSON.parse(JSON.stringify(s))
export function mapShape(s:Shape, f:(p:P)=>P):Shape { return {...s,path:s.path.map(f),branches:s.branches?.map(b=>b.map(f)),marks:s.marks.map(m=>({...m,at:f(m.at)}))} }
export function rotate(s:Shape,k:number):Shape { return mapShape(s,([x,y])=>k===1?[-y,x]:k===2?[-x,-y]:k===3?[y,-x]:[x,y]) }
export const mirror=(s:Shape)=>mapShape(s,([x,y])=>[-x,y])
const line=(path:P[],branches:P[][]=[]):Shape=>({path,branches,marks:[{at:path[0],solid:true},{at:path[path.length-1],solid:false}]})
const ea=line([[20,140],[20,85],[65,85],[65,30],[125,30],[125,105],[170,105]])
const eb=line([[20,20],[75,20],[75,70],[125,70],[125,140],[165,140]])
const branches=(s:Shape):Shape=>({...s,branches:[[s.path[1],[s.path[1][0]-25,s.path[1][1]+25]],[s.path[2],[s.path[2][0]+25,s.path[2][1]+10]],[s.path[3],[s.path[3][0]-25,s.path[3][1]-20]]]})
const alter=(s:Shape,indices:number[],axis:0|1,amount:number):Shape=>{const n=copy(s);for(const i of indices)n.path[i][axis]+=amount;return n}
export const embedded = [
 {target:ea,options:[ea,alter(ea,[3,4],1,18),alter(ea,[2,3],0,18),alter(ea,[4,5],0,-18)].map(branches),answer:0},
 {target:eb,options:[alter(eb,[1,2],0,18),alter(eb,[2,3],1,-18),alter(eb,[3,4],0,18),eb].map(branches),answer:3},
]
const pa:Shape={path:[[0,0],[75,0],[75,25],[110,25],[110,90],[45,90],[45,60],[0,60]],closed:true,marks:[{at:[20,20],solid:true},{at:[60,45],solid:false}]}
const pc=copy(pa);pc.marks[1].at=[85,50]
const pd=alter(pa,[2,3],1,12)
const pb=line([[15,20],[70,20],[70,60],[115,60],[115,135],[160,135]],[[[70,60],[40,100]]])
const pb2=copy(pb);pb2.branches=[[[70,60],[40,30]]]
export const rotations=[
 {target:pa,options:[rotate(pa,1),rotate(mirror(pa),1),rotate(pc,2),rotate(pd,3)],answer:0},
 {target:pb,options:[rotate(mirror(pb),1),rotate(pb2,2),rotate(alter(pb,[3,4],0,15),1),rotate(pb,3)],answer:3}
]
export type Pair=[number,number]
export const ports:P[]=[[45,0],[115,0],[160,80],[115,160],[45,160],[0,80]]
export const pairings:Pair[][]=[
 [[0,5],[1,2],[3,4]], [[0,1],[2,3],[4,5]], [[0,1],[2,5],[3,4]], [[0,3],[1,2],[4,5]]
]
export const gaps=[{pairs:pairings[0],options:pairings,answer:0},{pairs:pairings[2],options:[pairings[0],pairings[2],pairings[1],pairings[3]],answer:1}]
export interface Composition { left:P[];right:P[];edgeLeft:[P,P];edgeRight:[P,P];offset:P;turn:number;answer:number;options:P[][] }
const union=(a:P[],b:P[],[dx,dy]:P):P[]=>[...a,...b.map(([x,y]):P=>[x+dx,y+dy])]
const move=(a:P[],from:P,to:P):P[]=>a.map(p=>p[0]===from[0]&&p[1]===from[1]?to:p)
const ca:P[]=[[0,0],[1,0],[0,1],[1,1],[0,2]], da:P[]=[[0,0],[1,0],[1,1],[1,2],[2,2]]
const ua=union(ca,da,[2,1])
const cb:P[]=[[0,0],[1,0],[2,0],[0,1],[2,1]], db:P[]=[[0,0],[0,1],[1,1],[2,1],[2,2]]
const ub=union(cb,db,[0,2])
export const compositions:Composition[]=[
 {left:ca,right:da,edgeLeft:[[2,1],[2,2]],edgeRight:[[0,0],[0,1]],offset:[2,1],turn:1,answer:0,options:[ua,move(ua,[4,3],[4,2]),move(ua,[0,2],[1,2]),move(ua,[0,0],[2,0])]},
 {left:cb,right:db,edgeLeft:[[0,2],[1,2]],edgeRight:[[0,0],[1,0]],offset:[0,2],turn:3,answer:1,options:[move(ub,[2,4],[1,4]),ub,move(ub,[2,1],[1,1]),move(ub,[2,0],[1,1])]}
]

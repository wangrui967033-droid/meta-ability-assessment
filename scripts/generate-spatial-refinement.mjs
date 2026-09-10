import {writeFile} from 'node:fs/promises'
import {embedded,rotations,gaps,ports,compositions} from '../src/data/spatial-refinement.ts'
const out=new URL('../src/assets/source-v1.6-quality/',import.meta.url)
const frame=(body,h=760)=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 '+h+'"><rect width="720" height="'+h+'" fill="#f7f9fc"/><style>text{font:600 28px sans-serif;fill:#10213f}.s{stroke:#10213f;stroke-width:5;fill:none;stroke-linejoin:round;stroke-linecap:round}</style>'+body+'</svg>'
const path=p=>'M'+p.map(v=>v.join(' ')).join('L')
function draw(s){
 const ps=[...s.path,...(s.branches||[]).flat(),...s.marks.map(m=>m.at)]
 const minX=Math.min(...ps.map(p=>p[0])),maxX=Math.max(...ps.map(p=>p[0])),minY=Math.min(...ps.map(p=>p[1])),maxY=Math.max(...ps.map(p=>p[1]))
 const dx=(190-(maxX-minX))/2-minX,dy=(190-(maxY-minY))/2-minY
 return '<g transform="translate(95 95) scale(1.35) translate(-95 -95)"><g transform="translate('+dx+' '+dy+')"><path class="s" d="'+path(s.path)+(s.closed?'Z':'')+'"/>'+(s.branches||[]).map(b=>'<path class="s" d="'+path(b)+'"/>').join('')+s.marks.map(m=>'<circle cx="'+m.at[0]+'" cy="'+m.at[1]+'" r="7" stroke="#10213f" stroke-width="4" fill="'+(m.solid?'#10213f':'white')+'"/>').join('')+'</g></g>'
}
for(const [prefix,cases] of [['s01-embedded',embedded],['s03-rotation',rotations]])for(const [i,c]of cases.entries()){
 let body='<text x="360" y="36" text-anchor="middle">目标</text><g transform="translate(265 55)">'+draw(c.target)+'</g>'
 c.options.forEach((s,j)=>{let x=95+(j%2)*340,y=285+Math.floor(j/2)*245;body+='<text x="'+(x+95)+'" y="'+(y-14)+'" text-anchor="middle">'+'ABCD'[j]+'</text><g transform="translate('+x+' '+y+')">'+draw(s)+'</g>'})
 await writeFile(new URL(prefix+'-'+['a','b'][i]+'.svg',out),frame(body))
}
function tile(pairs){
 return '<rect width="160" height="160" fill="white" stroke="#c9d2df" stroke-width="2"/>'+pairs.map(([a,b])=>'<path class="s" d="M'+ports[a].join(' ')+'Q80 80 '+ports[b].join(' ')+'"/>').join('')
}
function mark(type,x,y){
 return type===0?'<circle cx="'+x+'" cy="'+y+'" r="11" class="s"/>':type===1?'<path d="M'+x+' '+(y-12)+'l-12 23h24Z" class="s"/>':'<rect x="'+(x-10)+'" y="'+(y-10)+'" width="20" height="20" class="s"/>'
}
for(const [i,c]of gaps.entries()){
 let body='<g transform="translate(280 75)"><rect width="160" height="160" fill="white" stroke="#b98b36" stroke-width="3" stroke-dasharray="8 6"/>'
 for(let k=0;k<6;k++){let [x,y]=ports[k],dx=k<2?0:k===2?1:k<5?0:-1,dy=k<2?-1:k<5&&k>2?1:0;let type=c.pairs.findIndex(p=>p.includes(k));body+='<path class="s" d="M'+x+' '+y+'l'+dx*32+' '+dy*32+'"/>'+mark(type,x+dx*54,y+dy*54)}
 body+='</g>'
 c.options.forEach((p,j)=>{let x=115+j%2*340,y=345+Math.floor(j/2)*230;body+='<text x="'+(x+80)+'" y="'+(y-16)+'" text-anchor="middle">'+'ABCD'[j]+'</text><g transform="translate('+x+' '+y+')">'+tile(p)+'</g>'})
 await writeFile(new URL('s02-gap-'+['a','b'][i]+'.svg',out),frame(body,780))
}
function edges(cells){const set=new Set(cells.map(p=>p.join(',')));const a=[];for(const [x,y]of cells){if(!set.has([x,y-1].join(',')))a.push([[x,y],[x+1,y]]);if(!set.has([x+1,y].join(',')))a.push([[x+1,y],[x+1,y+1]]);if(!set.has([x,y+1].join(',')))a.push([[x+1,y+1],[x,y+1]]);if(!set.has([x-1,y].join(',')))a.push([[x,y+1],[x,y]])}return a}
function poly(cells,edge,turn=0,scale=42){
 const rot=([x,y])=>turn===1?[-y,x]:turn===3?[y,-x]:[x,y]
 const boundary=edges(cells).map(e=>e.map(rot));const points=boundary.flat()
 const minX=Math.min(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1]))
 const cv=([x,y])=>[(x-minX)*scale,(y-minY)*scale]
 let body=boundary.map(e=>'<path class="s" d="'+path(e.map(cv))+'"/>').join('')
 if(edge){const e=edge.map(rot).map(cv);body+='<path d="'+path(e)+'" stroke="#b98b36" stroke-width="8"/>'+e.map((p,i)=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="6" stroke="#10213f" stroke-width="3" fill="'+(i?'white':'#10213f')+'"/>').join('')}
 return body
}
for(const [i,c]of compositions.entries()){
 let body='<text x="190" y="40" text-anchor="middle">左块（不转动）</text><text x="525" y="40" text-anchor="middle">右块</text><g transform="translate(130 80)">'+poly(c.left,c.edgeLeft)+'</g><g transform="translate(450 80)">'+poly(c.right,c.edgeRight,c.turn)+'</g><text x="360" y="270" text-anchor="middle">同样的端点标记重合</text>'
 c.options.forEach((cells,j)=>{let x=95+j%2*340,y=340+Math.floor(j/2)*285;body+='<text x="'+(x+95)+'" y="'+(y-20)+'" text-anchor="middle">'+'ABCD'[j]+'</text><g transform="translate('+x+' '+y+')">'+poly(cells)+'</g>'})
 await writeFile(new URL('s04-compose-'+['a','b'][i]+'.svg',out),frame(body,875))
}
console.log('Generated 8 refined spatial assets')

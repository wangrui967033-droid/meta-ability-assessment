import { writeFile } from 'node:fs/promises'
const root = new URL('../src/assets/source-v1.6-quality/', import.meta.url)
const data = { a: [[4,8,11,13],[1,3,6,10]], b: [[2,5,9,14],[6,9,13,18]] }
for(const [name, series] of Object.entries(data)) {
 const x=i=>100+150*i, y=v=>390-v*14
 let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" data-series="'+series.map(s=>s.join(',')).join(';')+'"><rect width="640" height="480" fill="#f7f9fc"/><style>text{font:500 26px sans-serif;fill:#10213f}</style>'
 svg+='<path d="M140 38H195" stroke="#10213f" stroke-width="6"/><text x="208" y="47">甲</text><path d="M340 38H395" stroke="#a67524" stroke-width="6" stroke-dasharray="12 8"/><text x="408" y="47">乙</text>'
 for(const v of [0,5,10,15,20])svg+='<path d="M70 '+y(v)+'H590" stroke="#d6dde7"/><text x="53" y="'+(y(v)+9)+'" text-anchor="end">'+v+'</text>'
 svg+='<path d="M70 98V390H590" fill="none" stroke="#8290a5" stroke-width="2"/>'
 series.forEach((values,k)=>{
  const color=k===0?'#10213f':'#a67524'
  svg+='<polyline points="'+values.map((v,i)=>x(i)+','+y(v)).join(' ')+'" fill="none" stroke="'+color+'" stroke-width="6"'+(k?' stroke-dasharray="12 8"':'')+'/>'
  values.forEach((v,i)=>{
   svg+= k?'<rect x="'+(x(i)-6)+'" y="'+(y(v)-6)+'" width="12" height="12" fill="'+color+'"/>':'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="6" fill="'+color+'"/>'
   const offset=v>series[1-k][i]?-18:30
   svg+='<text x="'+x(i)+'" y="'+(y(v)+offset)+'" text-anchor="middle">'+v+'</text>'
  })
 })
 for(let i=0;i<4;i++)svg+='<text x="'+x(i)+'" y="450" text-anchor="middle">第'+(i+1)+'次</text>'
 svg+='</svg>'
 await writeFile(new URL('n03-trend-'+name+'.svg',root),svg)
}
const graph='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 330" data-edges="甲-乙,丙-乙,乙-丁"><rect width="640" height="330" fill="#f7f9fc"/><defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="#10213f"/></marker></defs><g fill="none" stroke="#10213f" stroke-width="4" marker-end="url(#arrow)"><path d="M143 93L280 149"/><path d="M143 237L280 181"/><path d="M360 165H501"/></g><g fill="white" stroke="#10213f" stroke-width="3"><circle cx="110" cy="80" r="38"/><circle cx="110" cy="250" r="38"/><circle cx="320" cy="165" r="38"/><circle cx="545" cy="165" r="38"/></g><g font-family="sans-serif" font-size="32" fill="#10213f" text-anchor="middle"><text x="110" y="91">甲</text><text x="110" y="261">丙</text><text x="320" y="176">乙</text><text x="545" y="176">丁</text></g></svg>'
await writeFile(new URL('r06-order-graph.svg',root),graph)
console.log('Generated N03 charts and R06 relation graph')

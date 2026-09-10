import {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import type {DiagramComparison} from '../data/question-assets'

export interface DiagramView {src:string; title:string; comparison?:DiagramComparison}

export function DiagramViewer({view,onClose}:{view:DiagramView;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null)
  const close=useRef(onClose);close.current=onClose
  const [mode,setMode]=useState<'compare'|'full'>(view.comparison?'compare':'full')
  const [option,setOption]=useState(0)
  const [width,setWidth]=useState(720)
  const [error,setError]=useState(false)
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null
    const overflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    const el=dialog.current!
    if(typeof el.showModal==='function') el.showModal();else el.setAttribute('open','')
    el.querySelector<HTMLButtonElement>('button')?.focus()
    return ()=>{
      if (el.open && typeof el.close==='function') el.close()
      document.body.style.overflow=overflow
      previous?.focus()
    }
  },[])
  return createPortal(<dialog ref={dialog} className="diagram-viewer" aria-label={view.title} onCancel={e=>{e.preventDefault();close.current()}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close.current()}}}>
    <header><b>{view.title}</b><button type="button" onClick={onClose}>返回题目</button></header>
    <div className="diagram-view-controls">
      {view.comparison && <button type="button" onClick={()=>{setMode(mode==='compare'?'full':'compare');setError(false)}}>{mode==='compare'?'看整张图':'目标与选项对照'}</button>}
      {mode==='full' && <><button type="button" disabled={width<=360} onClick={()=>setWidth(w=>Math.max(360,w-180))}>缩小</button><span>{Math.round(width/720*100)}%</span><button type="button" disabled={width>=1440} onClick={()=>setWidth(w=>Math.min(1440,w+180))}>放大</button></>}
    </div>
    {mode==='compare' && view.comparison ? <div className="diagram-compare">
      <div className="diagram-target"><span>目标与规则</span><img src={view.comparison.target} alt="目标与规则" draggable={false} onError={()=>setError(true)}/></div>
      <div className="diagram-option-tabs" aria-label="选择要查看的选项">{'ABCD'.split('').map((id,i)=><button key={id} type="button" aria-label={`查看选项${id}`} aria-pressed={i===option} onClick={()=>{setOption(i);setError(false)}}>{id}</button>)}</div>
      <div className="diagram-candidate"><img src={view.comparison.options[option]} alt={`对照选项${'ABCD'[option]}`} draggable={false} onError={()=>setError(true)}/></div>
    </div> : <div className="diagram-pan" tabIndex={0} aria-label="大图，可左右上下滑动"><img style={{width:`${width}px`}} src={view.src} alt={view.title} draggable={false} onError={()=>setError(true)}/></div>}
    {error && <p role="alert">大图没有加载好，请返回题目查看原图。</p>}
    <footer>{mode==='compare'?'点A、B、C、D切换大图。这里只看图，不会改变答案。':'可以左右、上下滑动看细节。返回后，之前选的答案还在。'}</footer>
  </dialog>,document.body)
}

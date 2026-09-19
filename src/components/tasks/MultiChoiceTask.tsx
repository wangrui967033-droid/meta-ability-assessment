import type { MultiChoiceInteraction, TaskResponse } from '../../data/assessment-types'
import { diagramComparison, questionAssetUrl } from '../../data/question-assets'
import { useEffect, useRef, useState } from 'react'
import { MemoryGlyph } from '../MemoryGlyph'
import { SymbolGlyph } from '../SymbolGlyph'
import { BriefArray } from './BriefArray'
import {DiagramViewer, type DiagramView} from '../DiagramViewer'

interface Props {
  persistenceKey?: string
  onVisualReady?: (ready: boolean) => void
  interaction: MultiChoiceInteraction
  value: TaskResponse | null
  onChange: (value: TaskResponse) => void
}

export function MultiChoiceTask({ interaction, value, onChange, onVisualReady, persistenceKey }: Props) {
  const answers = value?.kind === 'multi-choice' ? value.answers : {}
  const startedAt = useRef(Date.now())
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const [view,setView]=useState<DiagramView|null>(null)
  const ready = (!interaction.asset || Boolean(loaded.shared)) && interaction.items.every((item, i) => !item.asset || Boolean(loaded[String(i)]))
  useEffect(() => { onVisualReady?.(ready) }, [ready, onVisualReady])
  const sharedAsset = questionAssetUrl(interaction.asset)
  return (
    <div className="v15-task">
      {view && <DiagramViewer view={view} onClose={()=>setView(null)}/>}
      {sharedAsset ? <div className="question-asset shared"><img src={sharedAsset} onLoad={() => setLoaded(p => ({...p, shared:true}))} onError={() => setLoaded(p => ({...p, shared:false}))} alt="本题图形材料" draggable={false} /></div> : null}
      <div className="v15-answer-list">
        {interaction.items.map((item, index) => {
          const itemAsset = questionAssetUrl(item.asset, item.assetLabels, item.reorderAssetChoices)
          return (
            <section className="v15-answer-group" key={`${index}-${item.text}`} hidden={Boolean(item.asset?.startsWith('n01-dot') && index > 0 && !answers[String(index-1)])}>
              <p><span>{index + 1}</span>{item.text}</p>
              {item.series && <div className="pattern-material"><p>按编号顺序观察，再选择最后一格。</p><ol className={'pattern-series ' + (item.series.some(part => part.length > 3) ? 'wide-symbols' : '')}>{[...item.series, '?'].map((part, step) => <li key={step} className={part === '?' ? 'missing-pattern' : ''}><small>{step + 1}</small><span>{part}</span></li>)}</ol></div>}
              {item.targetVisualId && <div className="question-asset memory-target"><MemoryGlyph id={item.targetVisualId}/></div>}
              {itemAsset ? item.asset?.startsWith('n01-dot') ? <BriefArray src={itemAsset} item={index} storageKey={persistenceKey ? `${persistenceKey}:dots:${index}` : undefined} onReady={() => setLoaded(p => p[index] ? p : ({...p, [index]:true}))}/> : <div className="question-asset zoomable-diagram"><button type="button" className="diagram-open" disabled={!loaded[index]} aria-label={`放大第${index+1}题图形`} onClick={e=>{e.currentTarget.focus();setView({src:itemAsset,title:`第${index+1}题图形`,comparison:diagramComparison(itemAsset)})}}>放大 / 对照看</button><img src={itemAsset} onLoad={() => setLoaded(p => ({...p, [index]:true}))} onError={() => setLoaded(p => ({...p, [index]:false}))} alt={`第${index + 1}题图形材料`} draggable={false} /></div> : null}
              {item.asset && !item.asset.startsWith('n01-dot') && !loaded[index] && <p role="status">图片还没加载好，请稍等。如果一直看不到图，请检查网络后刷新。</p>}
              <div className={item.targetVisualId ? "v15-options memory-location-options" : item.options.every(option => option.visualId) ? "v15-options memory-visual-options" : item.options.every(option => Array.from(option.label.replace(/\s/g, '')).length <= 6) ? "v15-options compact-options" : "v15-options"} role="radiogroup" aria-label={`第${index + 1}题选项`}>
                {item.options.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    role="radio"
                    style={item.targetVisualId ? {gridArea: ({'左上':'1 / 1', '中上':'1 / 2', '右上':'1 / 3', '左下':'2 / 1', '中下':'2 / 2', '右下':'2 / 3'} as Record<string,string>)[option.label]} : undefined}
                    aria-label={option.visualId ? `选项 ${option.displayId ?? option.id}` : undefined}
                    disabled={Boolean((interaction.asset && !loaded.shared) || (item.asset && !loaded[index]))}
                    aria-checked={answers[String(index)] === option.id}
                    onClick={() => onChange({ kind: 'multi-choice', answers: { ...answers, [String(index)]: option.id }, selectionEvents: [...(value?.kind === 'multi-choice' ? value.selectionEvents ?? [] : []), { itemIndex: index, optionId: option.id, elapsedSinceTaskStartMs: Date.now() - startedAt.current }] })}
                  >
                    {option.visualId ? <MemoryGlyph id={option.visualId}/> : <SymbolGlyph symbol={option.label}/>}
                  </button>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

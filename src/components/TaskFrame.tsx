import { Check, ChevronRight, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'

interface TaskFrameProps {
  prompt: string
  helper?: string
  progress: number
  disabled: boolean
  children: ReactNode
  onConfirm: () => void
  confirmLabel?: string
}

export function TaskFrame({ prompt, helper, progress, disabled, children, onConfirm, confirmLabel = '确认并继续' }: TaskFrameProps) {
  return (
    <main className="app-shell question-shell task-frame">
      <header className="simple-nav question-nav">
        <a className="brand" href="#top" aria-label="解码学习首页"><span className="brand-mark">D</span><span>解码学习</span></a>
        <span>已完成 {progress}%</span>
      </header>
      <div className="progress-rail" aria-label={`测评进度，已完成${progress}%`}><i style={{ width: `${progress}%` }} /></div>
      <section className="question-copy">
        <h1>{prompt}</h1>
        {helper ? <p>{helper}</p> : null}
      </section>
      <div className="task-body">{children}</div>
      <button className="primary-button sticky-action" type="button" onClick={onConfirm} disabled={disabled}>
        {confirmLabel} <ChevronRight size={20} />
      </button>
      <p className="center-note"><ShieldCheck size={15} />作答过程中不会显示对错。<Check className="visually-hidden" /></p>
    </main>
  )
}

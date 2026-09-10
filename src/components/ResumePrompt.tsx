import { ArrowRight, RotateCcw } from 'lucide-react'
import { Brand } from './IntakeScreen'

export function ResumePrompt({ onResume, onRestart }: { onResume: () => void; onRestart: () => void }) {
  return (
    <main className="app-shell resume-shell">
      <header className="simple-nav"><Brand /><span>测评记录</span></header>
      <section className="resume-copy"><p>欢迎回来</p><h1>继续上次测评？</h1><span>已保留你的作答和进度，可以接着完成。</span></section>
      <button className="primary-button" type="button" onClick={onResume}>继续上次测评<ArrowRight size={19} /></button>
      <button className="secondary-button" type="button" onClick={onRestart}><RotateCcw size={17} />重新开始</button>
    </main>
  )
}

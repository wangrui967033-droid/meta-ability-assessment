import { Sparkles } from 'lucide-react'
import { Brand } from './IntakeScreen'

export function ProcessingView() {
  return <main className="app-shell processing-shell"><header className="simple-nav"><Brand /><span>正在生成</span></header><section><Sparkles size={34} /><p>正在整理你的任务表现</p><h1>看看这次做得怎样<br />整理可以尝试的学习方法</h1><i /></section></main>
}

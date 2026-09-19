import { ArrowRight, Eye, ShieldCheck } from 'lucide-react'
import { Brand } from './IntakeScreen'

export function InstructionsScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="app-shell instruction-shell">
      <header className="simple-nav"><Brand /><span>开始前</span></header>
      <section className="instruction-copy">
        <p>测评说明</p>
        <h1>开始前，先了解一下</h1>
        <div className="instruction-list">
          <article><span>01</span><div><strong>选好后，再点继续</strong><p>每道题选一项；本组题目都选完，才能继续。确认后不能返回修改。</p></div></article>
          <article><span>02</span><div><strong>准备好了，再点开始看图</strong><p>记忆材料只展示一次，看完会马上提问，或隔几组题再问。</p></div></article>
          <article><span>03</span><div><strong>请独立完成</strong><p>请根据自己的理解作答，不查资料，也不请别人代答。</p></div></article>
        </div>
        <p className="instruction-note"><Eye size={16} />中途退出后可以接着做。但看过的记忆材料不会再放一遍，看图时请不要切走页面。</p>
      </section>
      <button className="primary-button instruction-start" type="button" onClick={onStart}>我知道了，开始<ArrowRight size={19} /></button>
      <p className="center-note"><ShieldCheck size={15} />完成后会生成你的元能力学习画像</p>
    </main>
  )
}

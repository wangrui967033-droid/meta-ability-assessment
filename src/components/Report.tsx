import { useEffect } from 'react'
import { Brain, ChartNoAxesColumnIncreasing, Download, GitBranch, Quote, Shapes } from 'lucide-react'
import { studentTaskStep } from '../data/student-task-steps'
import { dimensionDefinitions, dimensionLabels, type Dimension, type KnowledgeGraphTopicResult, type ReportModel, type SubjectTaskResult } from '../lib/assessment'
import RadarChart from './RadarChart'

interface ReportProps {
  name: string
  report: ReportModel
  printMeta?: { generatedAt: string; revision: number }
}
const studyEntry: Record<Dimension, string> = { memory: '回想并记下重点', language: '用自己的话说清内容', quantitative: '比较数量和变化', space: '画图理清位置和关系', reasoning: '找出条件之间的关系，一步步往下推' }

const icons: Record<Dimension, typeof Brain> = { memory: Brain, language: Quote, quantitative: ChartNoAxesColumnIncreasing, space: Shapes, reasoning: GitBranch }
const evidenceStateCopy = { 表现较稳定: '比较顺手', 出现优势迹象: '有时能用上', 还需要更多观察: '还需要继续观察' } as const
const opportunityTierCopy = { 优势发挥区: '优势发挥区', 优势借力区: '优势借力区', 待发展区: '待发展区', 待了解区: '待了解区' } as const
const opportunityTierNote = { 优势发挥区: '这些课主要需要的元能力，在本次相关任务中都表现较顺手。', 优势借力区: '这些课的主要要求尚未全部得到支持，但已有元能力可以直接参与，帮助你入手。', 待发展区: '这些课的主要要求尚未得到充分支持，且已有元能力还不足以提供借力入口，建议专项练习。', 待了解区: '有些主要要求的作答信息还不够，暂时不判断。' } as const
const taskGroupCopy = { 优势直接参与: '优势可发挥任务', 可以借优势进入: '可借力任务', 需要带动其他元能力: '待发展任务', 重点练习: '待发展任务', 暂不判断: '暂不判断' } as const
const abilityNames = (items: readonly Dimension[]) => items.map(d => dimensionLabels[d]).join('、')
const scoreValue = (score: string) => score.includes('基础') ? 100 : Number.parseFloat(score) || 0
const representativeTopics = (items: Array<{ task: SubjectTaskResult; topic: KnowledgeGraphTopicResult }>) => {
  const sorted = [...items].sort((left, right) => scoreValue(right.topic.score) - scoreValue(left.topic.score))
  return sorted
}
function printDateTime(value: string): string {
  const date = new Date(new Date(value).getTime() + 8 * 60 * 60 * 1_000)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

export default function Report({ name, report, printMeta }: ReportProps) {
  useEffect(()=>{
    let closed:HTMLDetailsElement[]=[]
    const before=()=>{closed=[...document.querySelectorAll<HTMLDetailsElement>('details.task-list:not([open])')];closed.forEach(d=>d.open=true)}
    const after=()=>{closed.forEach(d=>d.open=false);closed=[]}
    window.addEventListener('beforeprint',before);window.addEventListener('afterprint',after)
    return ()=>{window.removeEventListener('beforeprint',before);window.removeEventListener('afterprint',after)}
  },[])
  const scores = Object.fromEntries(report.dimensionSummary.map((item) => [item.dimension, item.signal])) as Record<Dimension, number>
  const advantages = [...report.advantageDimensions]
  const relativeDimensions = [...report.relativeDimensions]
  const profileDimensions = advantages.length ? advantages : relativeDimensions
  const advantageLabel = profileDimensions.length ? profileDimensions.map((item) => dimensionLabels[item]).join(' × ') : '暂时看不出来'
  const developmentDimensions = [...new Set(report.subjectOpportunityPlan.flatMap(subject => [...subject.support.practice, ...subject.support.attention]))]
  const hasSufficientEvidence = report.dimensionSummary.some(d=>d.evidenceQuality==='证据充分')
  const hasIncompleteEvidence = report.dimensionSummary.some(d=>d.evidenceQuality !== '证据充分')
  const taskEmptyCopy = !hasSufficientEvidence ? '完成相关测评后，可查看对应任务和练习方法。' : '部分作答信息或任务对应资料还不完整，暂未列出任务分类。可以先参考02中的学习方法。'
  const developmentCopy = !hasSufficientEvidence ? '完成相关测评后，可查看对应的练习方向。' : developmentDimensions.length ? `根据本次表现，建议加强${abilityNames(developmentDimensions)}相关任务的练习。` : hasIncompleteEvidence ? '部分元能力的作答信息还不完整，暂不能确定全部练习方向。' : '本次未列出需要专项加强的部分。接下来可以通过综合任务，练习不同元能力之间的配合。'
  const allSupported = report.dimensionSummary.length === 5 && report.dimensionSummary.every(item=>report.subjectOpportunityPlan.some(s=>s.support.details[item.dimension]==='supported'))
  const overviewTitle = !hasSufficientEvidence ? '完成测评后，查看你的学习入口' : allSupported ? '五项表现较均衡，多种学习方法都可以尝试' : profileDimensions.length === 5 ? '五项得分相近，可以结合任务选择学习方法' : profileDimensions.length ? abilityNames(profileDimensions) : '本次没有明显突出项，可以从具体任务的练习方法入手'
  const strongSubjects = report.subjectOpportunityPlan.filter(s => s.tier === '优势发挥区').map(s => s.subject)
  const learningActions: Record<Dimension, string[]> = {memory:['记住新信息','回想并提取重点'],language:['理解意思','组织信息','清楚表达'],quantitative:['理解数量变化','处理数字和符号'],space:['看清结构和位置','在脑中移动或转动图形'],reasoning:['发现关系','一步步推出结论']}
  const overviewActions = profileDimensions.length && profileDimensions.length < 5 ? `在需要${profileDimensions.flatMap(d => learningActions[d]).join('、')}的学习任务中，可能更容易找到入手的方法。` : '可以结合当前学习内容，看看下面哪些方法适合尝试。'
  const borrowingSubjects = report.subjectOpportunityPlan.filter(s => s.tier === '优势借力区').map(s => s.subject)
  const overviewSubjects = !hasSufficientEvidence ? '完成相关测评后，可查看学科分析。' : report.subjectOpportunityPlan.every(s=>s.tier==='待了解区') ? '本次学科方向仍需进一步确认，暂不作分类。可以先参考02中的学习方法。' : [strongSubjects.length ? `${strongSubjects.join('、')}是本次报告中的优势发挥方向，可以尝试把已有元能力用在这些学科的相关任务上。` : '本次还没有学科进入优势发挥区。', borrowingSubjects.length ? `${borrowingSubjects.join('、')}可以借力入手，其他主要要求仍需配合练习。` : '', report.subjectOpportunityPlan.some(s=>s.tier==='待发展区') ? '待发展学科的练习方向可以查看03，具体做法见04。' : ''].join('')
  const visibleTaskStatuses = new Set(report.subjectTaskPlan.flatMap(plan=>plan.groups.flatMap(group=>group.tasks.flatMap(task=>task.graphTopics.map(topic=>topic.support.status)))))
  const nextActions = [visibleTaskStatuses.has('supported') ? '从04的“优势可发挥任务”中，选一个当前正在学的任务尝试' : '', visibleTaskStatuses.has('entry') ? '“可借力任务”按卡片中的入口开始' : '', visibleTaskStatuses.has('attention') ? '“待发展任务”按具体做法专项练习' : ''].filter(Boolean)
  const overviewNext = !hasSufficientEvidence ? '先完成相关测评，再查看适合尝试的任务和练习方法。' : nextActions.length ? `${nextActions.join('；')}。` : '本次暂未列出可判断的学科任务。可以先参考02中的学习方法，补充相关作答证据后再查看任务方向。'
  const frequencyCopy = (performance:string) => ({'比较顺手':'本次：经常用得上','能较稳定地用上':'本次：较常用得上','有时能用上':'本次：有时用得上','还需要继续观察':'本次：还需观察'}[performance])
  const opportunityGroups = (['优势发挥区', '优势借力区', '待发展区'] as const).map((tier) => ({
    tier,
    subjects: report.subjectOpportunityPlan.filter((item) => item.tier === tier),
  })).filter(group => group.subjects.length > 0)
  return (
    <main className="report-shell">
      <header className="report-nav"><a className="brand" href="#top" aria-label="解码学习首页"><span className="brand-mark">D</span><span>解码学习</span></a><button className="print-button" type="button" onClick={() => window.print()}><Download size={18} />保存报告</button></header>
      <div id="top" className="report-content">
        <section className="report-hero report-hero-compact"><p className="report-student-name">姓名：{name}</p><div className="section-heading"><p>01｜我的核心结论</p></div><div className="hero-detail"><h2>你可以先靠什么入手</h2><h1>{overviewTitle}</h1><p>{profileDimensions.length > 0 && profileDimensions.length < 5 ? '这是你本次测评中得分相对较高的部分。' : ''}{overviewActions}</p></div><div className="hero-detail"><h2>这些元能力可以用在哪里</h2><p>{overviewSubjects}</p></div><div className="hero-detail"><h2>接下来怎么用</h2><p>{overviewNext}</p></div></section>

        <section className="report-section profile-section">
          <div className="section-heading"><p>02｜我的元能力画像</p><h2>这次做题，我的表现怎么样？</h2></div><p className="score-reading-note">百分比表示本次对应任务的得分比例。</p>
          <div className="profile-layout"><RadarChart scores={scores} /><div className="score-list">{report.dimensionSummary.map((item) => { const Icon = icons[item.dimension]; const featured = profileDimensions.includes(item.dimension); return <div className={`score-row ${featured ? 'featured' : ''}`} key={item.dimension}><Icon size={17} /><span><b>{item.label}</b><small>{dimensionDefinitions[item.dimension]}</small></span><div className="score-track"><i style={{ width: `${Math.max(0, Math.min(100, item.signal))}%` }} /></div><b><span>{item.signal}%</span><small>{item.performance}</small></b></div> })}</div></div>
          <div className="profile-conclusion"><span>先看这三点</span><ul><li><b>这次哪些任务得分较高</b><span>{advantages.length ? `${advantageLabel}是你这次得分较高的部分。` : relativeDimensions.length === 5 ? '五组任务得分相同，不单独挑出某一项。' : relativeDimensions.length ? `${advantageLabel}得分相对较高，但还不能说是你的优势。` : '这次还看不出你在哪类任务中表现更突出。'}</span></li><li><b>我可以先从哪里开始</b><span>{profileDimensions.length > 2 ? `可以任选一个适合当前内容的方法：${profileDimensions.map(d => studyEntry[d]).join('；')}。` : profileDimensions.length === 2 ? `遇到新内容，可以先从${studyEntry[profileDimensions[0]]}开始，再试着${studyEntry[profileDimensions[1]]}。` : profileDimensions.length === 1 ? `遇到新内容，可以先从${studyEntry[profileDimensions[0]]}开始。` : '暂时没有固定的起点，可以结合平时学习尝试不同方法。'}</span></li><li><b>待发展部分</b><span>{developmentCopy}</span></li></ul></div>
          <div className="evidence-subheading"><b>每项元能力，具体看什么？</b><span>每项元能力分成三个方面。下面说明它们在学习中起什么作用，旁边标出你这次的表现。</span></div>
          <div className="dimension-evidence">{report.dimensionSummary.map((item) => <article key={item.dimension}><header><span>{item.label}</span><small>{item.evidenceQuality === '证据不足' ? '本次：还需观察' : frequencyCopy(item.performance)}</small></header><div>{item.mechanisms.map((mechanism) => <p key={mechanism.name}><b>{mechanism.name}</b><span>{mechanism.explanation}</span><i>{evidenceStateCopy[mechanism.state]}</i></p>)}</div></article>)}</div>
        </section>

        <section className="report-section opportunity-section">
          <div className="section-heading"><p>03｜我的学科发挥方向</p><h2>哪些学科更容易发挥，哪些还需要发展？</h2></div>
          <div className="task-priority-note opportunity-reading-note">
            <p><b>优势发挥区：</b>这门学科主要需要的元能力，在本次测评中都表现较顺手，可以尝试把它们用在相关学习任务上。</p>
            <p><b>优势借力区：</b>已有元能力可以帮助你入手，学科主要需要的其他元能力还要一起用好。</p>
            <p><b>待发展区：</b>这门学科的主要要求尚未全部达到本次支持标准，且没有足够的借力入口，建议结合04中的具体做法加强练习。这不等于你已经被判定为不擅长这门学科。</p>
          </div>
          <div className="opportunity-groups">{opportunityGroups.map(group => <article className={group.tier === '优势发挥区' ? 'opportunity-strong' : ''} key={group.tier}>
            <header><h3>{opportunityTierCopy[group.tier]}</h3><p>{opportunityTierNote[group.tier]}</p></header>
            <div>{group.subjects.length ? group.subjects.map(subject => <span key={subject.subject}>
              <b>{subject.subject}</b>
              <small>这门课需要：{subject.requiredAbilities.map(d => dimensionLabels[d]).join('｜')}</small>
              <small>可以用上的元能力：{abilityNames(subject.matchedAbilities) || '本次还没有明显表现'}</small>
              {subject.support.practice.length > 0 && <small>还需配合练习：{abilityNames(subject.support.practice)}</small>}
              {subject.support.attention.length > 0 && <small>重点练习：{abilityNames(subject.support.attention)}（本次相关任务尚未得分）</small>}
              {subject.support.missing.length > 0 && <small>还需了解：{abilityNames(subject.support.missing)}（作答信息不足）</small>}

            </span>) : <p className="empty-strategy">这次没有学科分到这一组。</p>}</div>
          </article>)}</div>
          
        </section>

        <section className="report-section task-priority-section"><div className="section-heading"><p>04｜我的学科任务指南</p><h2>哪些任务能发挥优势，哪些可以借力，哪些还需发展？</h2></div><div className="task-priority-note"><p><b>优势可发挥任务：</b>任务主要需要的元能力，在本次测评中都表现较顺手，可以尝试把它们用在这些任务上。</p><p><b>可借力任务：</b>本次表现较顺手的元能力可以帮助你入手，任务主要需要的其他元能力还要一起用好。</p><p><b>待发展任务：</b>任务的主要要求尚未全部达到本次支持标准，且没有足够的借力入口，建议按下面的做法加强练习。这不等于你已经被判定为能力不足。</p></div>{report.subjectTaskPlan.some(plan=>plan.groups.some(g=>g.label!=='暂不判断'&&g.tasks.some(t=>t.graphTopics.length))) ? <div className="subject-priority-grid">{report.subjectTaskPlan.filter(plan=>plan.groups.some(g=>g.label!=='暂不判断'&&g.tasks.some(t=>t.graphTopics.length))).map((plan) => <article key={plan.subject}><h3>{plan.subject}</h3><details className="task-list"><summary>查看本学科任务与做法</summary><div>{(['优势直接参与', '可以借优势进入', '需要带动其他元能力'] as const).map(label => ({label, tasks: plan.groups.filter(g => g.label === label || (label === '需要带动其他元能力' && g.label === '重点练习')).flatMap(g => g.tasks)})).map((group) => {
          const topics = representativeTopics(group.tasks.flatMap((task) => task.graphTopics.map((topic) => ({ task, topic }))))
          if (!topics.length) return null
          return <section key={group.label}><b>{taskGroupCopy[group.label]}</b>{topics.length ? topics.map(({ task, topic }) => <div className="module-row" key={`${group.label}-${task.graphModule}-${topic.name}`}><div className="module-title"><strong>{topic.name}</strong>{topic.displayScore ? <span>{topic.displayScore}</span> : null}</div><small>所属内容：{task.graphModule}</small><small className="module-ability">主要用到：{topic.abilityDimensions.map((ability) => dimensionLabels[ability]).join('｜')}</small><small>所需元能力：{[...new Set([...topic.abilityDimensions, ...topic.entryDimensions])].map((ability) => dimensionLabels[ability]).join('｜')}</small>{topic.support.missing.length > 0 && <small>还需了解：{abilityNames(topic.support.missing)}</small>}{topic.support.status === 'entry' && topic.support.usablePaths.length > 0 && <small>可以借力的步骤：{topic.support.usablePaths.map(p=>p.action).join('；')}。</small>}<small className="topic-first-step"><b>可以先这样做：</b>{studentTaskStep(plan.subject, topic.name)}</small></div>) : <p className="empty-strategy">这次没有题目内容分到这一组。</p>}</section>
        })}</div></details></article>)}</div> : <p className="empty-strategy">{taskEmptyCopy}</p>}</section>


        {printMeta ? <footer className="print-meta">报告版本：{printMeta.revision}<span>生成时间：{printDateTime(printMeta.generatedAt)}</span></footer> : null}
      </div>
    </main>
  )
}

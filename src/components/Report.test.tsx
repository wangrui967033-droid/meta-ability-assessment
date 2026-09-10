import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Report from './Report'
import { buildPrototypeReport, type ScoredEvidence } from '../lib/assessment'

const evidence: ScoredEvidence[] = (['memory', 'language', 'quantitative', 'space', 'reasoning'] as const).flatMap((dimension, dimensionIndex) =>
  Array.from({ length: 6 }, (_, index) => ({
    taskId: `${dimension}-${index}`,
    position: dimensionIndex * 6 + index + 1,
    dimension,
    mechanism: `${dimension}-${index % 3}`,
    role: 'direct' as const,
    nodeScore: { earned: index < (dimension === 'language' || dimension === 'space' ? 6 : 2) ? 1 : 0, possible: 1 },
    diagnosticPoints: [],
    durationMs: 18000,
  })),
)

const oneAdvantageEvidence: ScoredEvidence[] = (['memory', 'language', 'quantitative', 'space', 'reasoning'] as const).flatMap((dimension, dimensionIndex) =>
  Array.from({ length: 6 }, (_, index) => ({
    taskId: `${dimension}-${index}`,
    position: dimensionIndex * 6 + index + 1,
    dimension,
    mechanism: `${dimension}-${index % 3}`,
    role: 'direct' as const,
    nodeScore: { earned: index < (dimension === 'language' ? 6 : 3) ? 1 : 0, possible: 1 },
    diagnosticPoints: [],
    durationMs: 18000,
  })),
)

const spaceAdvantageEvidence: ScoredEvidence[] = (['memory', 'language', 'quantitative', 'space', 'reasoning'] as const).flatMap((dimension, dimensionIndex) =>
  Array.from({ length: 6 }, (_, index) => ({
    taskId: `${dimension}-${index}`,
    position: dimensionIndex * 6 + index + 1,
    dimension,
    mechanism: `${dimension}-${index % 3}`,
    role: 'direct' as const,
    nodeScore: { earned: index < (dimension === 'space' ? 6 : 3) ? 1 : 0, possible: 1 },
    diagnosticPoints: [],
    durationMs: 18000,
  })),
)

const relativeEvidence: ScoredEvidence[] = (['memory', 'language', 'quantitative', 'space', 'reasoning'] as const).flatMap((dimension, dimensionIndex) =>
  Array.from({ length: 6 }, (_, index) => ({
    taskId: `relative-${dimension}-${index}`,
    position: dimensionIndex * 6 + index + 1,
    dimension,
    mechanism: `${dimension}-${index % 3}`,
    role: 'direct' as const,
    nodeScore: { earned: index < (dimensionIndex < 2 ? 5 : 4) ? 1 : 0, possible: 1 },
    diagnosticPoints: [],
    durationMs: 18000,
  })),
)

describe('student report', () => {
  it('omits practice reminders from task cards while retaining the task and first step',()=>{
    const low=evidence.map(e=>({...e,nodeScore:{earned:.4,possible:1}}))
    const {container}=render(<Report name="练习" report={buildPrototypeReport(low,'英语')}/> )
    const section=container.querySelector('.task-priority-section')!
    expect(section.querySelectorAll('.module-row').length).toBeGreaterThan(0)
    expect(section.textContent).not.toContain('练习时留意')
    expect(section.textContent).toContain('可以先这样做')
    expect(section.textContent).toContain('待发展任务')
  })
  it('shows tasks for a complete threshold profile without adding report sections',()=>{
    const tentative=evidence.map((e,i)=>({...e,nodeScore:{earned:i%6<3?1:.5,possible:1}}))
    const report=buildPrototypeReport(tentative,'英语')
    const {container}=render(<Report name="临界" report={report}/> )
    expect(report.subjectOpportunityPlan.every(s=>s.tier==='优势发挥区')).toBe(true)
    expect(container.textContent).not.toContain('暂不判断为优势或待发展')
    expect(container.querySelectorAll('.module-row').length).toBeGreaterThan(0)
    expect(container.querySelector('.task-priority-section')?.textContent).not.toContain('支持仍需确认')
    expect(container.querySelector('.task-priority-section')?.textContent).not.toContain('完成相关测评后')
    expect(container.querySelectorAll('.report-section')).toHaveLength(3)
  })
  it('does not ask a completed low profile to finish and only recommends existing task groups', () => {
    const low = evidence.map(e => ({...e,nodeScore:{earned:0.4,possible:1}}))
    const {container}=render(<Report name="已完成" report={buildPrototypeReport(low,'英语')} />)
    const hero=container.querySelector('.report-hero') as HTMLElement
    expect(hero.textContent).not.toContain('完成测评后')
    expect(hero.textContent).not.toContain('优势可发挥任务')
    expect(hero.textContent).not.toContain('可借力任务')
    expect(hero.textContent).toContain('待发展任务')
  })
  it('recognizes uniformly supported performance without implying a lack of strengths', () => {
    const high=evidence.map(e=>({...e,nodeScore:{earned:0.9,possible:1}}))
    const {container}=render(<Report name="均衡" report={buildPrototypeReport(high,'英语')} />)
    const hero=container.querySelector('.report-hero') as HTMLElement
    expect(hero.textContent).toContain('五项表现较均衡，多种学习方法都可以尝试')
    expect(hero.textContent).not.toContain('暂不单列优势')
    expect(hero.textContent).not.toContain('待发展任务')
  })
  it('expands all task lists for printing and restores the reading state',()=>{
    render(<Report name="打印" report={buildPrototypeReport(evidence,'英语')}/> )
    const lists=[...document.querySelectorAll<HTMLDetailsElement>('details.task-list')]
    expect(lists.length).toBeGreaterThan(0)
    expect(lists.every(d=>!d.open)).toBe(true)
    window.dispatchEvent(new Event('beforeprint'))
    expect(lists.every(d=>d.open)).toBe(true)
    window.dispatchEvent(new Event('afterprint'))
    expect(lists.every(d=>!d.open)).toBe(true)
  })
  it('puts the student first and explains mechanisms and learning methods beyond the question format', () => {
    const {container} = render(<Report name="林晓" report={buildPrototypeReport(evidence, '英语')} />)
    expect(container.querySelector('.report-hero')?.firstElementChild).toHaveTextContent('姓名：林晓')
    const definitions = container.querySelectorAll('.dimension-evidence article > div > p > span')
    expect(definitions).toHaveLength(15)
    expect(screen.getByText('把意思说清楚，不漏条件，也不多加意思。')).toBeInTheDocument()
    expect(screen.getByText('根据已有信息，在脑中形成物体或空间的样子，包括眼前看不到的部分。')).toBeInTheDocument()
    expect(screen.queryByText(/这次是从几种说法里选/)).not.toBeInTheDocument()
    expect(container.querySelector('.route-summary-section')).toBeNull()
  })
  it('omits the long boundary while keeping the brief hero interpretation', () => {
    const {container} = render(<Report name="林晓" report={buildPrototypeReport(evidence, '英语')} />)
    expect(container.querySelector('.score-boundary')).toBeNull()
    expect(container.querySelector('.report-hero .result-boundary')).toBeNull()
    expect(container.querySelector('.score-reading-note')).toHaveTextContent('百分比表示本次对应任务的得分比例')
  })
  it('includes demand 3 but omits demands 1 and 2 in every subject tier without changing matches', () => {
    render(<Report name="e" report={buildPrototypeReport(spaceAdvantageEvidence, '英语', ['地理', '历史', '生物'])} />)
    const section = document.querySelector('.opportunity-section') as HTMLElement
    for (const [subject, needs] of [
      ['地理', '空间｜推演｜记忆｜语言｜数理'],
      ['历史', '记忆｜语言｜推演｜空间'],
      ['生物', '记忆｜推演｜语言｜数理'],
    ]) {
      const card = within(section).getByText(subject, { exact: true }).parentElement as HTMLElement
      expect(within(card).getByText('这门课需要：' + needs)).toBeInTheDocument()
    }
    expect(within(section).getByRole('heading', {name: '优势借力区'})).toBeInTheDocument()
    expect(screen.getByText('姓名：e')).toBeInTheDocument()
    expect(document.querySelector('.result-meta')).toBeNull()
    expect(document.querySelector('.report-footer')).toBeNull()
  })

  it('shows only one named advantage when only one is supported', () => {
    render(<Report name="林晓" report={buildPrototypeReport(oneAdvantageEvidence, '英语', ['语文', '英语'])} />)

    expect(screen.getByRole('heading',{level:1})).toHaveTextContent(/^语言$/)
    expect(screen.queryByText(/这次得分较高：语言 ×/)).not.toBeInTheDocument()
    expect(screen.getByText('03｜我的学科发挥方向')).toBeInTheDocument()
    expect(screen.getByText(/先看每门课需要哪些元能力/)).toBeInTheDocument()
    expect(screen.queryByText(/任务层分析放在04/)).not.toBeInTheDocument()
    expect(screen.getAllByText('优势可发挥任务').length).toBeGreaterThan(0)
    expect(screen.getByText('可借力任务：')).toBeInTheDocument()
    expect(screen.getByText('初阶词汇')).toBeInTheDocument()
  })

  it('does not generate personalized advantage sections when evidence is unclear', () => {
    render(<Report name="林晓" report={buildPrototypeReport([], '英语', ['语文'])} />)

    expect(screen.getByRole('heading',{level:1})).toHaveTextContent('完成测评后，查看你的学习入口')
    expect(document.querySelectorAll('.module-row')).toHaveLength(0)
    expect(document.querySelectorAll('.opportunity-groups article')).toHaveLength(0)
    expect(document.querySelectorAll('.subject-priority-grid > article')).toHaveLength(0)
    expect(document.querySelector('.profile-conclusion')).toHaveTextContent('完成相关测评后')
    for(const track of document.querySelectorAll<HTMLElement>('.score-track i'))expect(track.style.width).toBe('0%')
  })

  it('shows percentages and uses relatively higher dimensions when no clear advantage is separated', () => {
    render(<Report name="林晓" report={buildPrototypeReport(relativeEvidence, '英语', ['语文', '数学'])} />)

    expect(screen.getByRole('heading',{level:1})).toHaveTextContent('记忆、语言')
    expect(screen.getAllByText(/%$/).length).toBeGreaterThanOrEqual(5)
    expect(screen.getAllByText('优势可发挥任务').length).toBeGreaterThan(0)
    expect(screen.getAllByText('待发展任务').length).toBeGreaterThan(0)
    expect(screen.queryByText(/五项元能力之间还没有拉开足够清楚的差距/)).not.toBeInTheDocument()
  })

  it('presents five abilities as results and mechanisms only as cautious signals', () => {
    render(<Report name="林晓" report={buildPrototypeReport(evidence, '英语', ['语文'])} />)

    expect(screen.getByText(/百分比表示本次对应任务的得分比例/)).toBeInTheDocument()
    expect(screen.getByText('准确表达')).toBeInTheDocument()
    expect(screen.queryByText('表达辨析')).not.toBeInTheDocument()
  })

  it('opens with one conclusion and follows the approved four-section structure', () => {
    render(<Report name="林晓" report={buildPrototypeReport(evidence, '日语')} />)

    const conclusion = screen.getByRole('heading',{level:1})
    expect(conclusion).toHaveTextContent('语言、空间')
    expect(screen.getByText('01｜我的核心结论')).toBeInTheDocument()
    expect(conclusion).toBeInTheDocument()
    expect(screen.getByLabelText('五维元能力雷达图')).toBeInTheDocument()
    expect(screen.getByText('02｜我的元能力画像')).toBeInTheDocument()
    expect(screen.queryByText(/放到学科里：/)).not.toBeInTheDocument()
    expect(document.querySelectorAll('.dimension-evidence p')).toHaveLength(15)
    expect(screen.getByText('03｜我的学科发挥方向')).toBeInTheDocument()
    expect(screen.getAllByText('优势可发挥任务').length).toBeGreaterThan(0)
    expect(screen.getByText('可借力任务：')).toBeInTheDocument()
    expect(screen.getAllByText('待发展任务').length).toBeGreaterThan(0)
    const opportunity = document.querySelector('.opportunity-section') as HTMLElement
    expect(within(opportunity).queryByText(/小说|数列|函数|电学实验/)).not.toBeInTheDocument()
    expect(screen.getByText('04｜我的学科任务指南')).toBeInTheDocument()
    expect(screen.getAllByText('优势可发挥任务').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('.module-match')).toHaveLength(0)
    expect(screen.queryByText(/不会跟着学生结果改变/)).not.toBeInTheDocument()
    expect(document.querySelector('.route-summary-section')).toBeNull()
    expect(document.querySelectorAll('.topic-first-step').length).toBeGreaterThan(0)
    expect(screen.queryByText(/我的主入口/)).not.toBeInTheDocument()
    expect(screen.queryByText(/先做：/)).not.toBeInTheDocument()
  })
  it('summarizes the learning entry, actual subject directions and next action in the hero', () => {
    const { container } = render(<Report name="林晓" report={buildPrototypeReport(evidence, '日语')} />)
    const hero = within(container.querySelector('.report-hero') as HTMLElement)
    expect(hero.getByRole('heading', {name: '你可以先靠什么入手'})).toBeInTheDocument()
    expect(hero.getByRole('heading', {name: '这些元能力可以用在哪里'})).toBeInTheDocument()
    expect(hero.getByRole('heading', {name: '接下来怎么用'})).toBeInTheDocument()
    expect(hero.getByText(/待发展任务/)).toBeInTheDocument()
    expect(hero.queryByText(/提分|拿分/)).not.toBeInTheDocument()
    expect(hero.queryByText(/英语/)).not.toBeInTheDocument()
  })
})

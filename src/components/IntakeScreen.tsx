import { ArrowRight, BrainCircuit, Clock3, ShieldCheck, Sparkles } from 'lucide-react'
import type { Intake } from '../data/assessment-types'
import type { SubjectName } from '../data/subject-task-map'

interface IntakeScreenProps {
  intake: Intake
  errors: Partial<Record<'name' | 'phone' | 'grade' | 'foreignLanguage' | 'selectedSubjects', string>>
  onChange: (next: Intake) => void
  onStart: () => void
}

export function Brand() {
  return <a className="brand" href="#top" aria-label="解码学习首页"><span className="brand-mark">D</span><span>解码学习</span></a>
}

export function IntakeScreen({ intake, errors, onChange, onStart }: IntakeScreenProps) {
  const update = <K extends keyof Intake>(key: K, value: Intake[K]) => onChange({ ...intake, [key]: value })
  const availableSubjects: SubjectName[] = ['物理', '化学', '生物', '历史', '政治', '地理', '技术']
  const updateForeignLanguage = (foreignLanguage: Intake['foreignLanguage']) => {
    onChange({ ...intake, foreignLanguage })
  }
  const toggleSubject = (subject: SubjectName) => {
    const selectedSubjects = intake.selectedSubjects.includes(subject)
      ? intake.selectedSubjects.filter((item) => item !== subject)
      : [...intake.selectedSubjects, subject]
    onChange({ ...intake, selectedSubjects })
  }
  return (
    <main className="app-shell intro-shell" id="top">
      <header className="simple-nav"><Brand /><span>25分钟左右</span></header>
      <section className="intro-copy">
        <h1 aria-label="元能力学习画像">元能力<br />学习画像</h1>
        <p>完成30组小任务，了解自己的元能力表现，找到适合的学习方法。请预留25分钟左右，按自己的节奏完成。</p>
        <div className="intro-points">
          <span><BrainCircuit size={18} />五种元能力</span>
          <span><Clock3 size={18} />25分钟左右</span>
          <span><Sparkles size={18} />一份学习方法参考</span>
        </div>
      </section>
      <section className="intake-panel" aria-label="学生信息">
        <label htmlFor="name">姓名</label>
        <input id="name" aria-label="姓名" value={intake.name} onChange={(event) => update('name', event.target.value)} placeholder="请输入姓名" autoComplete="name" />
        {errors.name ? <p className="field-error">{errors.name}</p> : null}
        <label htmlFor="phone">手机号</label>
        <input id="phone" aria-label="手机号" inputMode="tel" value={intake.phone} onChange={(event) => update('phone', event.target.value)} placeholder="请输入11位手机号" autoComplete="tel" />
        {errors.phone ? <p className="field-error">{errors.phone}</p> : null}
        <label htmlFor="grade">年级</label>
        <select id="grade" aria-label="年级" value={intake.grade} onChange={(event) => update('grade', event.target.value)}>
          <option value="">请选择</option><option value="高一">高一</option><option value="高二">高二</option><option value="高三">高三</option>
        </select>
        {errors.grade ? <p className="field-error">{errors.grade}</p> : null}
        <label htmlFor="foreignLanguage">高考外语语种</label>
        <select id="foreignLanguage" aria-label="高考外语语种" value={intake.foreignLanguage} onChange={(event) => updateForeignLanguage(event.target.value as Intake['foreignLanguage'])}>
          <option value="">请选择</option><option value="英语">英语</option><option value="日语">日语</option>
        </select>
        {errors.foreignLanguage ? <p className="field-error">{errors.foreignLanguage}</p> : null}
        <fieldset className="subject-choice" aria-describedby="subject-choice-help">
          <legend>选择想在报告中查看的选考科目（可多选）</legend>
          <p id="subject-choice-help">语文、数学和外语会自动进入报告，选考科目按需选择。</p>
          <div>{availableSubjects.map((subject) => <button className={intake.selectedSubjects.includes(subject) ? 'selected' : ''} type="button" aria-pressed={intake.selectedSubjects.includes(subject)} aria-label={subject} key={subject} onClick={() => toggleSubject(subject)}>{subject}</button>)}</div>
        </fieldset>
        {errors.selectedSubjects ? <p className="field-error">{errors.selectedSubjects}</p> : null}
        <button className="primary-button" type="button" onClick={onStart}>开始测评<ArrowRight size={19} /></button>
        <p className="privacy-note"><ShieldCheck size={16} />手机号仅供机构查找报告，不影响评分，也不会保存在本机测评记录中。</p>
      </section>
    </main>
  )
}

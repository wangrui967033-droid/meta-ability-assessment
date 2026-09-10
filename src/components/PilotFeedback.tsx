import { useState } from 'react'
import type { AssessmentTask } from '../data/assessment-types'
import type { SubjectName } from '../data/subject-task-map'

export interface PilotFeedbackRecord {
  experience: string
  taskId: string
  taskNote: string
  subject: string
  action: string
  tried: boolean
  observation: string
  methodNote: string
  savedAt: string
}

interface Props {
  tasks: AssessmentTask[]
  subjects: SubjectName[]
  initial?: PilotFeedbackRecord
  onSave: (record: PilotFeedbackRecord) => boolean
  onExport: () => void
}

export function PilotFeedback({tasks, subjects, initial, onSave, onExport}: Props) {
  const [draft, setDraft] = useState<PilotFeedbackRecord>(initial ?? {experience:'',taskId:'',taskNote:'',subject:'',action:'',tried:false,observation:'',methodNote:'',savedAt:''})
  const [message, setMessage] = useState('')
  const update = (patch: Partial<PilotFeedbackRecord>) => { setDraft(value => ({...value,...patch})); setMessage('') }
  const save = () => {
    if (!draft.experience && !draft.taskNote.trim() && !draft.tried) {setMessage('可以先记录一项作答感受，或在试过学习方法后再回来。');return}
    if (draft.tried && (!draft.subject || !draft.action || !draft.observation)) {setMessage('请补全试用的学科、做法和感受。');return}
    const value = {...draft, savedAt:new Date().toISOString(), observation:draft.tried ? draft.observation : ''}
    if (onSave(value)) {setDraft(value);setMessage('已保存到本机。刷新后仍可继续补充。')}
    else setMessage('本机保存失败，请勿关闭页面。请检查浏览器是否允许本地存储。')
  }
  return <aside className="app-shell pilot-feedback" id="pilot-feedback" aria-label="预测试反馈">
    <h2>帮我们改进这次体验（选填）</h2>
    <p>反馈不计分，也不会改变报告。内容只保存在这台设备，导出后才便于交给组织者。</p>
    <div className="intake-panel">
      <label htmlFor="pilot-experience">作答时，主要卡在哪里？</label>
      <select id="pilot-experience" value={draft.experience} onChange={e => update({experience:e.target.value, ...(e.target.value === 'none' ? {taskId:'',taskNote:''} : {})})}>
        <option value="">暂不填写</option><option value="none">没有遇到操作困难</option><option value="rules">没看懂要求</option><option value="visual">图形或文字看不清</option><option value="interaction">知道怎么做，但操作不顺手</option><option value="solution">理解要求，但没想出答案</option><option value="other">其他</option>
      </select>
      <label htmlFor="pilot-task">是哪一组？（记不清可以不选）</label>
      <select id="pilot-task" value={draft.taskId} disabled={draft.experience === 'none'} onChange={e=>update({taskId:e.target.value})}>
        <option value="">不指定题目</option>{tasks.map(task=><option key={task.id} value={task.id}>第{task.position}组 · {task.prompt}</option>)}
      </select>
      <label htmlFor="pilot-task-note">当时发生了什么？</label>
      <textarea id="pilot-task-note" rows={2} maxLength={500} value={draft.taskNote} disabled={draft.experience === 'none'} onChange={e=>update({taskNote:e.target.value})}/>
      <h3>学习方法试用记录</h3><p>先用报告中的一项方法完成一次实际学习，再回来填写。这里记录个人感受，不作为提分效果的证明。</p>
      <label className="trial-checkbox"><input type="checkbox" checked={draft.tried} onChange={e=>update({tried:e.target.checked, observation:e.target.checked ? draft.observation : ''})}/>我已经在实际学习中试过一项方法</label>
      <label htmlFor="pilot-subject">试用的学科</label><select id="pilot-subject" value={draft.subject} onChange={e=>update({subject:e.target.value})}><option value="">请选择</option>{subjects.map(subject=><option key={subject}>{subject}</option>)}</select>
      <label htmlFor="pilot-action">试用的是哪项做法？</label><select id="pilot-action" value={draft.action} onChange={e=>update({action:e.target.value})}><option value="">请选择</option><option value="learn">学</option><option value="memorize">背</option><option value="practice">练</option><option value="repair">补</option><option value="ability">利用本次表现尝试的那一步</option></select>
      <label htmlFor="pilot-observation">这次使用的感受</label><select id="pilot-observation" disabled={!draft.tried} value={draft.observation} onChange={e=>update({observation:e.target.value})}><option value="">试用后再选</option><option value="easier">比平时更容易独立完成</option><option value="same">没有感到明显不同</option><option value="harder">步骤更多或更难完成</option><option value="uncertain">还判断不出来</option></select>
      <label htmlFor="pilot-method-note">做了什么，哪一步仍需帮助？</label><textarea id="pilot-method-note" rows={3} maxLength={800} value={draft.methodNote} onChange={e=>update({methodNote:e.target.value})}/>
      <button className="primary-button" type="button" onClick={save}>保存反馈到本机</button>
      <p role="status">{message || (initial ? '已有本机记录，可以补充后再保存。' : '')}</p>
      <button className="print-button" type="button" onClick={onExport}>导出已保存的本次记录</button><small>导出文件含姓名、作答、用时和已保存的反馈。请确认接收人后再分享。</small>
    </div>
  </aside>
}

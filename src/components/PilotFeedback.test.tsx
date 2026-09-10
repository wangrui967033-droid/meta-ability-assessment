import {fireEvent, render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'
import {PilotFeedback, type PilotFeedbackRecord} from './PilotFeedback'
import {assessmentTasksV16} from '../data/assessment-bank-v1.6'

describe('optional pilot feedback', () => {
  it('does not invent feedback or an improvement before an actual trial', () => {
    const save = vi.fn((_record: PilotFeedbackRecord)=>true)
    render(<PilotFeedback tasks={assessmentTasksV16} subjects={['数学']} onSave={save} onExport={()=>{}} />)
    expect(screen.getByLabelText('这次使用的感受')).toBeDisabled()
    fireEvent.click(screen.getByText('保存反馈到本机'))
    expect(save).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('作答时，主要卡在哪里？'),{target:{value:'rules'}})
    fireEvent.click(screen.getByText('保存反馈到本机'))
    expect(save.mock.calls[0][0]).toMatchObject({experience:'rules',tried:false,observation:''})
    expect(screen.getByRole('status')).toHaveTextContent('已保存到本机')
  })

  it('requires a subject, action and observation for a completed trial, and reports save failures', () => {
    const save = vi.fn((_record: PilotFeedbackRecord)=>false)
    render(<PilotFeedback tasks={assessmentTasksV16} subjects={['数学']} onSave={save} onExport={()=>{}} />)
    fireEvent.click(screen.getByLabelText('我已经在实际学习中试过一项方法'))
    fireEvent.click(screen.getByText('保存反馈到本机'))
    expect(save).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('试用的学科'),{target:{value:'数学'}})
    fireEvent.change(screen.getByLabelText('试用的是哪项做法？'),{target:{value:'learn'}})
    fireEvent.change(screen.getByLabelText('这次使用的感受'),{target:{value:'uncertain'}})
    fireEvent.click(screen.getByText('保存反馈到本机'))
    expect(save.mock.calls[0][0]).toMatchObject({subject:'数学',action:'learn',tried:true,observation:'uncertain'})
    expect(screen.getByRole('status')).toHaveTextContent('本机保存失败')
  })

  it('restores saved observations and exports only on request', () => {
    const exportRecord = vi.fn()
    render(<PilotFeedback tasks={assessmentTasksV16} subjects={['数学']} initial={{experience:'visual',taskId:assessmentTasksV16[3].id,taskNote:'看不清标记',subject:'数学',action:'learn',tried:true,observation:'same',methodNote:'仍会漏条件',savedAt:'2026-09-07'}} onSave={()=>true} onExport={exportRecord} />)
    expect(screen.getByLabelText('当时发生了什么？')).toHaveValue('看不清标记')
    expect(screen.getByLabelText('这次使用的感受')).toHaveValue('same')
    expect(exportRecord).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('导出已保存的本次记录'))
    expect(exportRecord).toHaveBeenCalledOnce()
    expect(screen.getByText(/导出文件含姓名/)).toBeInTheDocument()
  })
})

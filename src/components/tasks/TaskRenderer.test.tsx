import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TaskFrame } from '../TaskFrame'
import { TaskRenderer } from '../TaskRenderer'
import { assessmentTasks } from '../../data/assessment-bank'
import type { AssessmentTask } from '../../data/assessment-types'

const taskAt = (position: number) => {
  const task = assessmentTasks.find((item) => item.position === position)
  if (!task) throw new Error(`Missing task ${position}`)
  return task
}

describe('task renderer', () => {
  it('renders every item in a V1.5 task and records one answer per item', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const task: AssessmentTask = {
      id: 'L01-v5', version: 'L01-v5', position: 1, dimension: 'language', mechanism: '理解意思',
      role: 'direct', difficulty: 'easy', expectedSeconds: 25, prompt: '选择答案',
      interaction: { type: 'multi-choice', items: [
        { text: '第一题', options: [{ id: 'A', label: 'A' }, { id: 'B', label: 'B' }] },
        { text: '第二题', options: [{ id: 'C', label: 'C' }, { id: 'D', label: 'D' }] },
      ] },
    }
    render(<TaskRenderer task={task} draft={{ kind: 'multi-choice', answers: { 0: 'A' } }} onChange={onChange} />)

    expect(screen.getByText('第一题')).toBeInTheDocument()
    expect(screen.getByText('第二题')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'D' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ kind: 'multi-choice', answers: { 0: 'A', 1: 'D' }, selectionEvents: [expect.objectContaining({ itemIndex: 1, optionId: 'D', elapsedSinceTaskStartMs: expect.any(Number) })] }))
  })
  it('does not enable confirmation until a required answer is selected', () => {
    render(
      <TaskFrame prompt="测试" progress={34} disabled onConfirm={vi.fn()}>
        <TaskRenderer task={taskAt(2)} draft={null} onChange={vi.fn()} />
      </TaskFrame>,
    )

    expect(screen.getByRole('button', { name: '确认并继续' })).toBeDisabled()
  })

  it('renders position 06 as three independent radio groups without duplicate blocking', () => {
    render(<TaskRenderer task={taskAt(6)} draft={null} onChange={vi.fn()} />)

    expect(screen.getByRole('radiogroup', { name: '甲控制的灯' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio', { name: '圆灯' })).toHaveLength(3)
    expect(screen.getByText('三角灯、圆灯')).toBeInTheDocument()
  })

  it('renders position 08 without drag controls or a composition preview', () => {
    render(<TaskRenderer task={taskAt(8)} draft={null} onChange={vi.fn()} />)

    expect(screen.getByText('图块 1')).toBeInTheDocument()
    expect(screen.getByText('图块 2')).toBeInTheDocument()
    expect(screen.queryByLabelText('拖动图块')).not.toBeInTheDocument()
    expect(screen.queryByText('预览拼合结果')).not.toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import App from '../App'
import { orderedV16Tasks } from '../data/meta-bank-v1.6'
import { createSessionSnapshot, SESSION_STORAGE_KEY } from '../lib/session'
afterEach(()=>window.localStorage.clear())
it.each(['S02','S03','S04','S05','N05','S06'])('shows %s rules in the task, without a separate rules page', async code=>{
 const task=orderedV16Tasks.find(t=>t.code===code)!
 const snapshot=createSessionSnapshot()
 snapshot.screen='tasks';snapshot.currentPosition=task.position
 snapshot.seenPresentations=['visual-board','semantic-pairs','sequence-4-5','sequence-6']
 localStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify(snapshot))
 render(<App/>)
 await userEvent.click(screen.getByRole('button',{name:'继续上次测评'}))
 expect(screen.getByRole('heading',{name:task.prompt})).toBeInTheDocument()
 expect(screen.getByText(task.helper)).toBeInTheDocument()
 expect(screen.queryByText('规则与操作')).not.toBeInTheDocument()
})
it('keeps helpers operational, not instructional solutions',()=>{
 expect(orderedV16Tasks.map(t=>t.helper).join('')).not.toMatch(/先遮住|先看每一步|先代入|先记住沿线|只做正向传递/)
})

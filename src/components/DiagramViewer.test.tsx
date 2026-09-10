import {fireEvent, render, screen, within} from '@testing-library/react'
import {expect,it,vi} from 'vitest'
import {MultiChoiceTask} from './tasks/MultiChoiceTask'

it('opens the displayed diagram at readable size and closes without losing the selected answer',()=>{
 render(<MultiChoiceTask interaction={{type:'multi-choice',items:[{text:'看图选择',asset:'s04-compose-a',options:[{id:'D',displayId:'A',label:'A'},{id:'B',displayId:'B',label:'B'}]}]}} value={{kind:'multi-choice',answers:{0:'D'}}} onChange={vi.fn()}/>)
 const original=screen.getByRole('img').getAttribute('src')
 fireEvent.load(screen.getByRole('img'))
 fireEvent.click(screen.getByRole('button',{name:'放大第1题图形'}))
 const dialog=screen.getByRole('dialog')
 expect(within(dialog).getByRole('img')).toHaveAttribute('src',original)
 expect(within(dialog).getByRole('img')).toHaveStyle({width:'720px'})
 fireEvent.click(within(dialog).getByRole('button',{name:'放大'}))
 expect(within(dialog).getByRole('img')).toHaveStyle({width:'900px'})
 fireEvent.click(within(dialog).getByRole('button',{name:'返回题目'}))
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
 expect(screen.getByRole('radio',{name:'A'})).toHaveAttribute('aria-checked','true')
})
it('never offers a replay or zoom path for timed dots',()=>{
 render(<MultiChoiceTask interaction={{type:'multi-choice',items:[{text:'点阵',asset:'n01-dot-a',options:[{id:'A',label:'左侧'},{id:'B',label:'右侧'}]}]}} value={null} onChange={vi.fn()}/>)
 expect(screen.queryByRole('button',{name:/放大/})).not.toBeInTheDocument()
})

it('compares the target against each displayed option without changing its canonical mapping',()=>{
 render(<MultiChoiceTask interaction={{type:'multi-choice',items:[{text:'拼图',asset:'s04-compose-a',assetLabels:{A:'C',B:'A',C:'D',D:'B'},reorderAssetChoices:true,options:[{id:'B',displayId:'A',label:'A'},{id:'D',displayId:'B',label:'B'},{id:'A',displayId:'C',label:'C'},{id:'C',displayId:'D',label:'D'}]}]}} value={null} onChange={vi.fn()}/>)
 fireEvent.load(screen.getByRole('img'))
 fireEvent.click(screen.getByRole('button',{name:'放大第1题图形'}))
 const dialog=screen.getByRole('dialog')
 expect(within(dialog).getByRole('img',{name:'目标与规则'})).toBeVisible()
 const a=within(dialog).getByRole('img',{name:'对照选项A'}).getAttribute('src')!
 expect(decodeURIComponent(a)).toContain('viewBox="0 292 360 285"')
 expect(decodeURIComponent(a)).toContain('data-original-option="B"')
 expect(decodeURIComponent(a).match(/data-original-option=/g)).toHaveLength(1)
 fireEvent.click(within(dialog).getByRole('button',{name:'查看选项B'}))
 expect(decodeURIComponent(within(dialog).getByRole('img',{name:'对照选项B'}).getAttribute('src')!)).toContain('viewBox="360 292 360 285"')
 fireEvent.click(within(dialog).getByRole('button',{name:'看整张图'}))
 expect(within(dialog).queryByRole('img',{name:'目标与规则'})).not.toBeInTheDocument()
 expect(within(dialog).getByRole('img')).toHaveStyle({width:'720px'})
 fireEvent.keyDown(dialog,{key:'Escape'})
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
 expect(screen.getByRole('button',{name:'放大第1题图形'})).toHaveFocus()
})

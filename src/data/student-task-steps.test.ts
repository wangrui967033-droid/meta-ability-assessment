import {expect,it} from 'vitest'
import {studentTaskStep} from './student-task-steps'
it('gives geometry an actionable diagram step, not a vocabulary instruction',()=>{
 expect(studentTaskStep('数学','立体几何')).toBe('先画图标出已知条件，再把图中的关系写成式子。')
 expect(studentTaskStep('英语','初阶词汇')).toContain('遮住释义')
})
it('keeps domain-specific experiments distinct and provides an action for unmapped topics',()=>{
 expect(studentTaskStep('物理','实验误差')).toContain('保持什么不变')
 expect(studentTaskStep('技术','未分类内容')).toContain('相关条件列在旁边')
})

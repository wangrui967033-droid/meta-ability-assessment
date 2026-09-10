import { expect, it } from 'vitest'
import { auditTaskTransition, type AuditTask } from './task-distribution-audit'

const task=(id:string,status:AuditTask['status']):AuditTask=>({id,status,required:['reasoning'],pendingReason:status==='unknown'?'insufficient':undefined,paths:[]})
it('flags bulk transitions and retains the individual task reasons',()=>{
 const result=auditTaskTransition([task('a','unknown'),task('b','attention')],[task('a','supported'),{...task('b','entry'),paths:['连接已知条件']}],['reasoning'])
 expect(result.changed).toBe(2)
 expect(result.bulkWarning).toBe(true)
 expect(result.transitions).toEqual({'unknown→supported':1,'attention→entry':1})
 expect(result.items[1].after.paths).toEqual(['连接已知条件'])
})
it('rejects changes to tasks unrelated to the changed ability',()=>{
 expect(auditTaskTransition([task('a','attention')],[task('a','supported')],['memory']).unexplained).toEqual(['a'])
})
it('does not warn on an unchanged distribution or hide catalog mismatches',()=>{
 expect(auditTaskTransition([task('a','supported')],[task('a','supported')],['reasoning']).bulkWarning).toBe(false)
 expect(()=>auditTaskTransition([task('a','supported')],[task('b','supported')],['reasoning'])).toThrow()
})

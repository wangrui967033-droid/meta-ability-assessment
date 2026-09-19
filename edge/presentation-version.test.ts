// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { Backend } from './backend'
import { createHandler } from './handler'
import { orderedV16Tasks } from '../src/data/meta-bank-v1.6'
import { ASSESSMENT_VERSIONS } from '../shared/score-assessment'
import { LEGACY_BANK_VERSION, READABLE_BANK_VERSION } from '../src/lib/presentation-protocol'

describe('presentation version storage', () => {
  it('accepts both versions, preserves their identity, and hashes them separately', async () => {
    const backend = new Backend({url:'https://example.supabase.co',key:'test-only',projectKey:'meta-ability-assessment',origin:'https://school.example',phoneEncryptionKey:'a'.repeat(32),phoneLookupSecret:'b'.repeat(32)})
    vi.spyOn(backend, 'projectId').mockResolvedValue('project-test')
    const rows: Record<string, unknown>[] = []
    vi.spyOn(backend, 'rpc').mockImplementation(async (name, input) => {
      if(name === 'assessment_rate_limit') return 0
      rows.push(input)
      return [{id:input.p_id,created:true,matches_payload:true}]
    })
    vi.spyOn(backend, 'detail').mockImplementation(async id => ({id,status:'ready',report:rows.at(-1)!.p_report,report_generated_at:new Date().toISOString(),report_revision:1}))
    const handler=createHandler(backend)
    const submissionId=crypto.randomUUID()
    for(const bankVersion of [LEGACY_BANK_VERSION,READABLE_BANK_VERSION]) {
      const response=await handler(new Request('https://example.supabase.co/functions/v1/assessment-api/assessments',{
        method:'POST',headers:{'Content-Type':'application/json',Origin:'https://school.example'},
        body:JSON.stringify({submissionId,name:'本地测试',phone:'13800138000',grade:'高三',foreignLanguage:'英语',selectedSubjects:[],bankVersion,scoringVersion:ASSESSMENT_VERSIONS.scoring,mappingVersion:ASSESSMENT_VERSIONS.mapping,responses:orderedV16Tasks.map(task=>({position:task.position,response:{kind:'multi-choice',answers:Object.fromEntries(task.items.map((item,i)=>[String(i),item.correctAnswer]))}}))})
      }))
      expect(response.status).toBe(201)
      expect(rows.at(-1)!.p_bank_version).toBe(bankVersion)
    }
    expect(rows[0].p_report).toEqual(rows[1].p_report)
    expect(rows[0].p_submission_payload_hash).not.toBe(rows[1].p_submission_payload_hash)
  })
})

import {expect,it} from 'vitest'
import {randomId} from './random-id'
it('generates distinct UUID v4 submission IDs when HTTP lacks randomUUID',()=>{
  const httpCrypto = {getRandomValues:crypto.getRandomValues.bind(crypto)}
  const ids = Array.from({length:100},()=>randomId(httpCrypto))
  expect(new Set(ids).size).toBe(100)
  for (const id of ids) expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
})

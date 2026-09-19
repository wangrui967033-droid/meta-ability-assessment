import { describe, expect, it } from 'vitest'

import {
  canonicalAnswers,
  findStudentBundleLeaks,
} from './student-bundle-audit.mjs'

describe('student bundle answer-material detector', () => {
  it('rejects a minified answer-only canonical vector with no field names', () => {
    const syntheticBundle = `const a=${JSON.stringify(canonicalAnswers)};export{a}`

    expect(findStudentBundleLeaks(syntheticBundle)).toContain('canonical answer vector')
  })

  it('rejects a stringified answer-only canonical vector', () => {
    const encoded = JSON.stringify(JSON.stringify(canonicalAnswers))

    expect(findStudentBundleLeaks(`const a=${encoded}`)).toContain('canonical answer vector')
  })

  it('rejects every exact nonempty explanation, including short distractors', () => {
    expect(findStudentBundleLeaks('const text="把镜像干扰当成原图。"')).toContain(
      'canonical explanation text',
    )
  })

  it('does not flag an unrelated safe student bundle', () => {
    expect(findStudentBundleLeaks('const status="正在安全保存作答，请稍候。"')).toEqual([])
  })
})

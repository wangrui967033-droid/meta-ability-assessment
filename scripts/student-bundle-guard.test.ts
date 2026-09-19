// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { canonicalAnswersByTask } from './student-bundle-audit.mjs'
import { resolveDevelopmentApiProxyTarget, studentBundleGuard } from '../vite.config'

function runBuildGuard(code: string) {
  const guard = studentBundleGuard(true)
  guard.generateBundle.call({
    getModuleIds: () => [][Symbol.iterator](),
    getModuleInfo: () => null,
  }, {}, { 'assets/student.js': { code } })
}

describe('Vite student artifact guard', () => {
  it('uses a configurable development API target with a loopback default', () => {
    expect(resolveDevelopmentApiProxyTarget(undefined)).toBe('http://127.0.0.1:3001')
    expect(resolveDevelopmentApiProxyTarget(' http://127.0.0.1:4100 ')).toBe(
      'http://127.0.0.1:4100',
    )
    expect(() => resolveDevelopmentApiProxyTarget('file:///tmp/socket')).toThrow(
      'API_PROXY_TARGET',
    )
  })

  it('fails the build on a nested per-task answer-only vector', () => {
    expect(() => runBuildGuard(`const answers=${JSON.stringify(canonicalAnswersByTask)}`)).toThrow(
      'canonical answer vector',
    )
  })

  it('fails the build on a JSON-stringified nested answer-only vector', () => {
    const stringified = JSON.stringify(JSON.stringify(canonicalAnswersByTask))

    expect(() => runBuildGuard(`const answers=${stringified}`)).toThrow(
      'canonical answer vector',
    )
  })

  it('allows unrelated student output', () => {
    expect(() => runBuildGuard('const status="saved作答"')).not.toThrow()
  })
})

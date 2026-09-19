import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { assertSafeStudentArtifact } from './scripts/student-bundle-audit.mjs'

const studentBankModuleId = '\0student-bank-v1.6'
const forbiddenStudentModules = [
  'src/data/meta-bank-v1.6.ts',
  'src/lib/transport.ts',
  'prototype-answer-key',
]

export function resolveDevelopmentApiProxyTarget(value: string | undefined): string {
  const target = value?.trim() || 'http://127.0.0.1:3001'
  let url: URL
  try {
    url = new URL(target)
  } catch {
    throw new Error('API_PROXY_TARGET 必须是有效的 HTTP(S) Origin')
  }
  if (!['http:', 'https:'].includes(url.protocol)
    || url.origin !== target
    || url.username
    || url.password) {
    throw new Error('API_PROXY_TARGET 必须是有效的 HTTP(S) Origin')
  }
  return url.origin
}

function deploymentStudentBank() {
  const projectRoot = fileURLToPath(new URL('.', import.meta.url))
  const bankUrl = pathToFileURL(fileURLToPath(new URL('./src/data/meta-bank-v1.6.ts', import.meta.url))).href
  const extraction = `
    const source = await import(${JSON.stringify(bankUrl)});
    const tasks = source.orderedV16Tasks.map((task) => ({
      code: task.code,
      id: task.id,
      position: task.position,
      primaryAbility: task.primaryAbility,
      mechanism: task.mechanism,
      difficulty: task.difficulty,
      expectedSeconds: task.expectedSeconds,
      prompt: task.prompt,
      helper: task.helper,
      practiceId: task.practiceId,
      memoryPresentationId: task.memoryPresentationId,
      memoryTargetSubset: task.memoryTargetSubset,
      items: task.items.map((item) => ({
        text: item.text,
        asset: item.asset,
        targetVisualId: item.targetVisualId,
        options: item.options,
      })),
    }));
    process.stdout.write(JSON.stringify({ tasks, memoryPresentations: source.META_BANK_V16.memoryPresentations }));
  `
  const serialized = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', extraction], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
  return {
    name: 'deployment-student-bank',
    enforce: 'pre' as const,
    resolveId(source: string) {
      return source.endsWith('meta-bank-v1.6') ? studentBankModuleId : null
    },
    load(id: string) {
      if (id !== studentBankModuleId) return null
      return `const studentBank=${serialized};export const orderedV16Tasks=studentBank.tasks;export const META_BANK_V16={memoryPresentations:studentBank.memoryPresentations};`
    },
  }
}

export function studentBundleGuard(safeStudentBuild: boolean) {
  return {
    name: 'v16-only-bank-guard',
    generateBundle(this: { getModuleIds(): IterableIterator<string>; getModuleInfo(id: string): { isIncluded?: boolean } | null }, _options: unknown, bundle: Record<string, { code?: string; source?: unknown }>) {
      for (const id of Array.from(this.getModuleIds())) {
        if (this.getModuleInfo(id)?.isIncluded && ['meta-bank-v1.5', 'assessment-bank-v1.5', 'prototype-answer-key', 'legacy-question-assets', 'components/TaskRenderer', 'data/assessment-bank.ts'].some(retired => id.includes(retired))) throw new Error('V1.6打包混入旧模块：' + id)
        if (safeStudentBuild && this.getModuleInfo(id)?.isIncluded && forbiddenStudentModules.some((forbidden) => id.includes(forbidden))) {
          throw new Error('学生部署包混入答案或本地评分模块：' + id)
        }
      }
      if (safeStudentBuild) {
        const output = Object.values(bundle).map((asset) => asset.code ?? String(asset.source)).join('\n')
        assertSafeStudentArtifact(output)
      }
    },
  }
}

export default defineConfig(({ mode, command, isSsrBuild }) => {
  const safeStudentBuild = command === 'build' && !isSsrBuild && mode !== 'preview'
  const studentBank = safeStudentBuild ? deploymentStudentBank() : null
  const developmentProxyTarget = command === 'serve'
    ? resolveDevelopmentApiProxyTarget(
        loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'API_PROXY_').API_PROXY_TARGET,
      )
    : null
  return {
  plugins: [...(studentBank ? [studentBank] : []), react(), studentBundleGuard(safeStudentBuild)],
  base: './',
  server: command === 'serve'
    ? {
        proxy: {
          '/api': developmentProxyTarget!,
        },
      }
    : undefined,
  build: {
    assetsInlineLimit: 1_000_000,
  },
}})

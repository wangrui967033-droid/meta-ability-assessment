import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({mode}) => {
  if (mode === 'deployment') throw new Error('正式部署已阻止：当前为含本地答案的联调版。必须先移除客户端答案及解析，并接入服务端判分，不允许降级为本地评分。')
  return {
  plugins: [react(), {
    name: 'v16-only-bank-guard',
    generateBundle() {
      for (const id of this.getModuleIds()) {
        if (this.getModuleInfo(id)?.isIncluded && ['meta-bank-v1.5', 'assessment-bank-v1.5', 'prototype-answer-key', 'legacy-question-assets', 'components/TaskRenderer', 'data/assessment-bank.ts'].some(retired => id.includes(retired))) throw new Error('V1.6打包混入旧模块：' + id)
      }
    },
  }],
  base: './',
  build: {
    assetsInlineLimit: 1_000_000,
  },
}})

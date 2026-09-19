import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentMatchGlobs: [['server/**/*.test.ts', 'node']],
    setupFiles: './src/test/setup.ts',
  },
})

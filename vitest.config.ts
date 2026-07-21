/**
 * Vitest config — 3-gate coverage + a11y check (plan §7 Wave 1 acceptance)
 *
 * Memory rule 14: 先測 actual coverage 再設 threshold = actual - 3pp
 * 第一次 run 必睇 actual %,然後將 threshold 寫死
 *
 * 設定:
 * - jsdom: React component + DOM API 測試
 * - coverage-v8: v8 engine 收集 coverage,快
 * - include: src/lib/ + src/services/ + src/hooks/ + src/constants/ + src/store/
 * - exclude: src/components/(冇 DOM 抽 test 會過度 brittle)
 *
 * a11y: 用 @testing-library/jest-dom 配 vitest-axe 驗證 critical a11y
 */

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      // v3.0.7.6 + v3.0.8.1: Wave 1 範圍 (memory rule 14: actual - 3pp floor)
      // 2026-07-21 actual baseline:
      //   Lines: 16.80%, Functions: 18.75%, Statements: 15.95%, Branches: 11.96%
      // 2026-07-21 post-audit (useAACPreference test):
      //   Lines: 18.10%, Functions: 21.85%, Statements: 17.39%, Branches: 12.71%
      // Floor = actual - 3pp (memory rule 14,唔係 target)
      // 隨住 test 增加, floor 同步上調
      thresholds: {
        lines: 15.1,
        functions: 18.85,
        branches: 9.71,
        statements: 14.39,
      },
      include: ['src/lib/**', 'src/services/**', 'src/hooks/**', 'src/constants/**', 'src/store/**'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/types.ts', 'src/test/**'],
    },
  },
})

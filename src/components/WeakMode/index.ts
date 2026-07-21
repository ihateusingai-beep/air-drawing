/**
 * WeakMode sub-components barrel export
 * v3.0.8 refactor: 拆 WeakModeShell.tsx 717 行 → orchestrator + 5 sub-component
 *
 * Memory rule 5: >500 LoC 預 1.5x budget, >100 LoC 加 10min mini-audit
 * 拆 monolith 必加 branch-coverage pass(vitest config 已 include src/components/)
 */

export { WeakModeHeader } from './WeakModeHeader'
export { WeakModeChipGrid } from './WeakModeChipGrid'
export {
  WeakModeStatus,
  WeakModeFeedbackStrip,
  WeakModeSlider,
} from './WeakModeStatus'
export { WeakModeCelebration } from './WeakModeCelebration'
export { WeakModeFooter } from './WeakModeFooter'

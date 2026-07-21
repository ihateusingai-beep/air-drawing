/**
 * WeakModeFooter — Bottom status bar (mode + click count + storage)
 */

export interface WeakModeFooterProps {
  isIpad: boolean
  dwellTimeMs: number
  fingerDetectionActive: boolean
  clickCount: number
}

export function WeakModeFooter({
  isIpad,
  dwellTimeMs,
  fingerDetectionActive,
  clickCount,
}: WeakModeFooterProps): React.JSX.Element {
  return (
    <footer className="px-4 py-3 text-center text-xs text-slate-500 border-t border-slate-700/50 space-y-1 shrink-0">
      <div>
        🟢 弱模式 · 揀情緒表達 ·{' '}
        {isIpad
          ? 'iPad 觸控'
          : fingerDetectionActive
            ? '手指 / Dwell-click'
            : `Dwell-click ${(dwellTimeMs / 1000).toFixed(1)}s`}{' '}
        · 本地紀錄
      </div>
      <div className="opacity-60">
        已揀 {clickCount} 次 · 本地儲存(IndexedDB) · 私隱:零外流 🔒
      </div>
    </footer>
  )
}

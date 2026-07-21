/**
 * InstallBanner — 雙 install prompt UX (PLAN §6.5 對應 R14).
 *
 * 設計:
 *   - iPad Safari: custom in-app banner 教用戶「分享 → 加到主畫面」
 *     (iOS Safari 唔 fire beforeinstallprompt,必須手動教)
 *   - Chrome / Edge notebook: 用 useInstallPrompt.triggerInstall() 開 native prompt
 *   - Firefox / Safari desktop: hidden
 *   - 7 日 dismiss cooldown(localStorage)
 *
 * 對標 plan §6.5 部署要求。
 *
 * 對 SEN niche 私隱考慮(R27):
 *   - Banner 純 local state,冇 telemetry
 *   - 用戶 dismiss 即時生效,冇 hidden cost
 */

import { useInstallPrompt } from '../hooks/useInstallPrompt'

export function InstallBanner(): React.JSX.Element | null {
  const { canShowBanner, platform, triggerInstall, dismiss } = useInstallPrompt()

  if (!canShowBanner) return null

  return (
    <div
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-30
                 bg-slate-800 border-2 border-amber-400 rounded-2xl p-4 shadow-2xl
                 animate-bounce-subtle"
      role="alertdialog"
      aria-live="polite"
      aria-label="安裝應用程式"
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl flex-shrink-0" aria-hidden="true">📲</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-amber-400 mb-1">加到主畫面</h3>
          {platform === 'ios' ? (
            <p className="text-xs text-slate-300 leading-relaxed">
              喺 Safari 底部 點 <span aria-hidden>⬆️</span>{' '}
              <strong>分享</strong> → 選 <strong>「加到主畫面」</strong>。
              <br />
              開 app 會全螢幕,冇 Safari chrome。
            </p>
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed">
              裝成獨立 app:全螢幕、離線可用、唔需要再打網址。
            </p>
          )}
          <div className="mt-3 flex gap-2">
            {platform === 'chrome' ? (
              <button
                type="button"
                onClick={() => void triggerInstall()}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-900 text-xs font-bold hover:bg-amber-400 active:scale-95"
              >
                📲 立即安裝
              </button>
            ) : (
              <button
                type="button"
                onClick={dismiss}
                className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-600 active:scale-95"
              >
                我知道點做
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="px-3 py-1.5 rounded-lg text-slate-400 text-xs hover:text-slate-300"
              aria-label="稍後再說"
            >
              稍後
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-slate-500 hover:text-slate-300 flex-shrink-0"
          aria-label="關閉"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

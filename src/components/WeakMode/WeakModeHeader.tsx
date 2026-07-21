/**
 * WeakModeHeader — Top bar (title + tts/webcam toggle + exit)
 *
 * v3.0.7.x UX 全部集中喺呢度, 改動 1 個 button 唔影響其他 component
 */

import { isTtsSupported } from '../../services/tts'

export interface WeakModeHeaderProps {
  ttsOn: boolean
  showWebcam: boolean
  onTtsToggle: () => void
  onWebcamToggle: () => void
  onExit: () => void
}

export function WeakModeHeader({
  ttsOn,
  showWebcam,
  onTtsToggle,
  onWebcamToggle,
  onExit,
}: WeakModeHeaderProps): React.JSX.Element {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-900/60 backdrop-blur shrink-0">
      <h1 className="text-base sm:text-lg font-semibold flex items-center gap-2">
        <span aria-hidden>🟢</span>
        <span>輕鬆模式</span>
        <span className="text-xs text-slate-400 hidden sm:inline">(Low / Beginner)</span>
      </h1>
      <div className="flex items-center gap-2">
        {isTtsSupported() && (
          <button
            type="button"
            onClick={onTtsToggle}
            aria-pressed={ttsOn}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-semibold
              ${ttsOn ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-300'}
              hover:opacity-90 active:scale-95 transition
            `}
          >
            {ttsOn ? '🔊 語音 ON' : '🔇 語音 OFF'}
          </button>
        )}
        <button
          type="button"
          onClick={onWebcamToggle}
          aria-pressed={showWebcam}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-semibold border transition active:scale-95
            ${showWebcam
              ? 'bg-green-500/20 border-green-500/50 text-green-300'
              : 'bg-slate-700 text-slate-300 border-transparent'
            }
          `}
        >
          {showWebcam ? '🟢 鏡頭 ON' : '📷 鏡頭 OFF'}
        </button>
        <button
          type="button"
          onClick={onExit}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
        >
          ← 返模式選擇
        </button>
      </div>
    </header>
  )
}

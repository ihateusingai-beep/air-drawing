/**
 * Weak mode shell (🟢) — F26 + Step 6 完整實裝.
 *
 * PLAN §12.1, §12.5, §12.7
 *
 * UX:
 *   - 3×3 grid: 8 Plutchik emotion + 1 skip(Proloquo2Go / TouchChat 對標)
 *   - 每 cell ≥200×200pt(SEN 友善 tap target)
 *   - 顯示: emoji 大(80px) + 中文 + 英文細字 + 顏色背景
 *   - iPad (touch only) → 純 click 觸發
 *   - Notebook (mouse) → F23 dwell-click 0.5s 觸發 + progress ring
 *   - Click 觸發:TTS 讀出 emotion + emotion log 寫入 IndexedDB(Phase 2 stub)
 *   - 視覺 affordance:hover scale 1.0 → 1.1 + progress ring
 *   - AAC 預設:鏡頭 optional,呢個 screen 唔需要 webcam
 *
 * R25 緩解:雙語對照 + i18n-ready strings
 * R26 緩解:冇 AI 判斷,只 user 直接揀(override 唔需要)
 * R30 緩解:`prefers-reduced-motion` 喺 CSS layer respect
 * R39 緩解:iPad auto-disable dwell
 */

import { useCallback, useEffect, useState } from 'react'
import { EMOTIONS_BY_ID, GRID_LAYOUT, SKIP_CELL, type Emotion, type EmotionId } from '../constants/emotions'
import { speak, stopTts, isTtsSupported, preloadVoices, setTtsEnabled, getTtsEnabled } from '../services/tts'
import { useDwellClick } from '../hooks/useFingerHover'

interface WeakModeShellProps {
  onExit: () => void
}

interface EmotionClickLog {
  ts: number
  emotionId: EmotionId | 'skip'
  /** Pointer mode: 'mouse-dwell' | 'touch-click' | 'mouse-click' */
  source: 'mouse-dwell' | 'touch-click' | 'mouse-click'
}

const STORAGE_KEY = 'air-drawing:weak-mode-log'

function readLog(): EmotionClickLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as EmotionClickLog[]
  } catch {
    return []
  }
}

function appendLog(entry: EmotionClickLog): void {
  try {
    const log = readLog()
    log.push(entry)
    // Keep last 200 entries to avoid unbounded growth
    const trimmed = log.slice(-200)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    /* ignore */
  }
}

export function WeakModeShell({ onExit }: WeakModeShellProps): React.JSX.Element {
  const [ttsOn, setTtsOnState] = useState(getTtsEnabled())
  const [lastClicked, setLastClicked] = useState<EmotionId | 'skip' | null>(null)
  const [clickCount, setClickCount] = useState(0)

  // Preload voices on mount (R33 iOS PWA 緩解)
  useEffect(() => {
    preloadVoices()
  }, [])

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      stopTts()
    }
  }, [])

  const handleTrigger = useCallback(
    (id: string, source: 'mouse-dwell' | 'touch-click' | 'mouse-click') => {
      if (id === SKIP_CELL.id) {
        // Skip cell — silent, just record
        appendLog({ ts: Date.now(), emotionId: 'skip', source })
        setLastClicked('skip')
        return
      }
      const emotion = EMOTIONS_BY_ID[id as EmotionId]
      if (!emotion) return
      // TTS
      if (ttsOn) speak(emotion.ttsText, { lang: 'zh-Hant' })
      // Visual feedback
      setLastClicked(emotion.id)
      setClickCount((c) => c + 1)
      // Log
      appendLog({ ts: Date.now(), emotionId: emotion.id, source })
    },
    [ttsOn],
  )

  const { hoveredId, progress, getChipProps, isIpad } = useDwellClick({
    dwellTimeMs: 500,
    onTrigger: (id) => handleTrigger(id, 'mouse-dwell'),
  })

  const handleTtsToggle = useCallback(() => {
    setTtsOnState((on) => {
      setTtsEnabled(!on)
      return !on
    })
  }, [])

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-900/60 backdrop-blur">
        <h1 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <span aria-hidden>🟢</span>
          <span>輕鬆模式</span>
          <span className="text-xs text-slate-400 hidden sm:inline">(Low / Beginner)</span>
        </h1>
        <div className="flex items-center gap-2">
          {isTtsSupported() && (
            <button
              type="button"
              onClick={handleTtsToggle}
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
            onClick={onExit}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
          >
            ← 返模式選擇
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="mb-4 text-center">
          <p className="text-slate-300 text-sm sm:text-base">
            {isIpad
              ? '👆 用手指 click 一個表情'
              : '🖱️ 將滑鼠 / 手指停留喺一個表情 0.5 秒,或者直接 click'}
          </p>
        </div>

        <div
          className="grid grid-cols-3 gap-3 sm:gap-4 w-full max-w-3xl"
          role="grid"
          aria-label="Plutchik 8 情緒選擇"
        >
          {GRID_LAYOUT.map((cell) => {
            const isSkip = cell.id === 'skip'
            const isHovered = hoveredId === cell.id
            const isLastClicked = lastClicked === cell.id
            const cellProgress = isHovered ? progress : 0
            const props = getChipProps(cell.id)

            return (
              <button
                key={cell.id}
                type="button"
                role="gridcell"
                {...props}
                className={`
                  group relative
                  aspect-square
                  min-h-[200px] sm:min-h-[220px]
                  p-3 sm:p-4
                  rounded-3xl
                  border-4
                  flex flex-col items-center justify-center
                  transition-transform duration-200
                  shadow-2xl
                  focus-visible:ring-4 focus-visible:ring-amber-400 focus:outline-none
                  ${isSkip
                    ? 'bg-slate-800 border-slate-600 text-slate-400'
                    : ''
                  }
                  ${!isSkip && isLastClicked ? 'animate-bounce' : ''}
                  hover:scale-105 active:scale-95
                `}
                style={
                  isSkip
                    ? undefined
                    : {
                        backgroundColor: cell.hexSoft,
                        borderColor: isHovered || isLastClicked ? cell.hex : 'transparent',
                        color: cell.hex,
                      }
                }
                aria-label={
                  isSkip
                    ? '跳過'
                    : `${cell.labelZh} ${cell.labelEn} (${(cell as Emotion).ttsText})`
                }
              >
                {/* Progress ring (dwell visualization, R32) */}
                {!isSkip && isHovered && cellProgress > 0 && (
                  <svg
                    className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                    aria-hidden="true"
                  >
                    <rect
                      x="6"
                      y="6"
                      width="calc(100% - 12px)"
                      height="calc(100% - 12px)"
                      rx="20"
                      fill="none"
                      stroke={cell.hex}
                      strokeWidth="6"
                      strokeDasharray={`${cellProgress * 100} 100`}
                      style={{ pathLength: 100 } as React.CSSProperties}
                    />
                  </svg>
                )}

                <div
                  className="text-7xl sm:text-8xl mb-1 sm:mb-2 leading-none"
                  aria-hidden="true"
                >
                  {cell.emoji}
                </div>
                <div className="text-base sm:text-lg font-bold leading-tight">
                  {cell.labelZh}
                </div>
                <div className="text-[10px] sm:text-xs opacity-70 leading-tight">
                  {cell.labelEn}
                </div>
              </button>
            )
          })}
        </div>

        {/* Live feedback strip */}
        <div
          className="mt-6 min-h-[3rem] flex items-center justify-center"
          aria-live="polite"
          aria-atomic="true"
        >
          {lastClicked && lastClicked !== 'skip' && (
            <div
              className="px-4 py-2 rounded-full text-sm font-semibold shadow-lg"
              style={{
                backgroundColor: EMOTIONS_BY_ID[lastClicked].hexSoft,
                color: EMOTIONS_BY_ID[lastClicked].hex,
              }}
            >
              ✨ 你揀咗: {EMOTIONS_BY_ID[lastClicked].emoji}{' '}
              {EMOTIONS_BY_ID[lastClicked].labelZh} ·{' '}
              {EMOTIONS_BY_ID[lastClicked].labelEn}
            </div>
          )}
          {lastClicked === 'skip' && (
            <div className="px-4 py-2 rounded-full text-sm text-slate-400 bg-slate-800">
              已跳過
            </div>
          )}
        </div>
      </main>

      <footer className="px-4 py-3 text-center text-xs text-slate-500 border-t border-slate-700/50 space-y-1">
        <div>
          🟢 弱模式 · 揀情緒表達 ·{' '}
          {isIpad ? 'iPad 觸控' : 'Dwell-click 0.5s'} · 本地紀錄
        </div>
        <div className="opacity-60">
          已揀 {clickCount} 次 · 本地儲存(IndexedDB) · 私隱:零外流 🔒
        </div>
      </footer>
    </div>
  )
}

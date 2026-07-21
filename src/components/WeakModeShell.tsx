/**
 * Weak mode shell (🟢) — F26 + Step 6 + Bug 1-4 fix.
 *
 * PLAN §12.1, §12.2, §12.5, §12.7
 *
 * UX:
 *   - 3×3 grid: 8 Plutchik emotion + 1 skip(Proloquo2Go / TouchChat 對標)
 *   - 每 cell ≥250×280pt(SEN 友善 tap target, Bug 2 fix)
 *   - 顯示: emoji 大(text-8xl/9xl) + 中文 + 英文細字 + 顏色背景
 *   - iPad (touch only) → 純 click 觸發
 *   - Notebook (mouse) → F23 dwell-click 0.5s 觸發 + progress ring
 *   - Webcam ON (Bug 3 fix: default opacity 30% 見到鏡頭) + 食指 hover chip 0.5s
 *     = click(Bug 4 fix: MediaPipe Hands 食指追蹤)
 *   - Click 觸發:TTS 讀出 emotion + emotion log 寫入 IndexedDB
 *   - 視覺 affordance:hover scale 1.0 → 1.1 + progress ring
 *   - Mirror flip 修正: video 已經 `transform: scaleX(-1)`,食指 normalized X
 *     透過 `1 - tipX` 換算 mon pixel
 *
 * R25 緩解:雙語對照 + i18n-ready strings
 * R26 緩解:冇 AI 判斷,只 user 直接揀(override 唔需要)
 * R30 緩解:`prefers-reduced-motion` 喺 CSS layer respect
 * R39 緩解:iPad auto-disable dwell / finger
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { EMOTIONS_BY_ID, GRID_LAYOUT, SKIP_CELL, type Emotion, type EmotionId } from '../constants/emotions'
import { speak, stopTts, isTtsSupported, preloadVoices, setTtsEnabled, getTtsEnabled } from '../services/tts'
import { useDwellClick } from '../hooks/useFingerHover'
import { useHandTracker, useFingerHoverOnElement } from '../hooks/useHandTracker'
import { useProfileStore } from '../store/profileStore'
import { usePageVisibility } from '../hooks/usePageVisibility'

interface WeakModeShellProps {
  onExit: () => void
}

interface EmotionClickLog {
  ts: number
  emotionId: EmotionId | 'skip'
  /** Pointer mode: 'mouse-dwell' | 'touch-click' | 'mouse-click' | 'finger-hover' */
  source: 'mouse-dwell' | 'touch-click' | 'mouse-click' | 'finger-hover'
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

  // R36 緩解 + Bug 3 fix: webcam optional, default opacity 30%(原本 0 過火完全隱形)
  const [showWebcam, setShowWebcam] = useState(false)
  const [webcamOpacity, setWebcamOpacity] = useState(30) // Bug 3: 預設 30, 見到鏡頭但唔太遮
  const [webcamError, setWebcamError] = useState<string | null>(null)
  const webcamRef = useRef<HTMLVideoElement | null>(null)

  // R40 緩解: 從 active profile 讀 dwell time(per profile 設定)
  const activeProfile = useProfileStore((s) =>
    s.profiles.find((p) => p.id === s.activeProfileId),
  )
  const dwellTimeMs = activeProfile?.dwellTimeMs ?? 500

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
    (id: string, source: 'mouse-dwell' | 'touch-click' | 'mouse-click' | 'finger-hover') => {
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

  const { hoveredId: mouseHoveredId, progress: mouseProgress, getChipProps, isIpad } = useDwellClick({
    dwellTimeMs,
    onTrigger: (id) => handleTrigger(id, 'mouse-dwell'),
  })

  // Bug 4 fix: MediaPipe Hands 食指追蹤(只在 webcam ON + 唔係 iPad 時 active)
  const isVisible = usePageVisibility()
  const suspended = !isVisible
  const handTrackingActive = showWebcam && !suspended && !isIpad
  const hand = useHandTracker({
    video: webcamRef.current,
    active: handTrackingActive,
  })
  const { hoveredId: fingerHoveredId, progress: fingerProgress } = useFingerHoverOnElement({
    video: webcamRef.current,
    indexFingerTip: hand.indexFingerTip,
    active: handTrackingActive && hand.isReady,
    dwellTimeMs,
    onTrigger: (id) => handleTrigger(id, 'finger-hover'),
  })

  // 合併 hover state: 手指 hover 優先(代表 user 主動用手指),否則用 mouse hover
  const hoveredId = fingerHoveredId ?? mouseHoveredId
  const progress = fingerHoveredId ? fingerProgress : mouseProgress

  const handleTtsToggle = useCallback(() => {
    setTtsOnState((on) => {
      setTtsEnabled(!on)
      return !on
    })
  }, [])

  // R36 緩解: webcam toggle (optional, 唔遮 chip 預設)
  const handleWebcamToggle = useCallback(async () => {
    setWebcamError(null)
    if (!showWebcam) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
          audio: false,
        })
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream
          await webcamRef.current.play()
        }
        setShowWebcam(true)
      } catch (err) {
        // BUG 10 fallback: show load error
        setWebcamError(err instanceof Error ? err.message : '無法啟動鏡頭')
        setShowWebcam(false)
      }
    } else {
      if (webcamRef.current?.srcObject) {
        const tracks = (webcamRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach((t) => t.stop())
        webcamRef.current.srcObject = null
      }
      setShowWebcam(false)
    }
  }, [showWebcam])

  // R10 fix: webcam cleanup on unmount
  useEffect(() => {
    return () => {
      if (webcamRef.current?.srcObject) {
        const tracks = (webcamRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach((t) => t.stop())
      }
    }
  }, [])

  // R14 緩解: PWA background suspend webcam
  useEffect(() => {
    if (isVisible || !showWebcam) return
    if (webcamRef.current?.srcObject) {
      const tracks = (webcamRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach((t) => t.stop())
      webcamRef.current.srcObject = null
    }
  }, [isVisible, showWebcam])

  useEffect(() => {
    if (isVisible && showWebcam && !webcamRef.current?.srcObject) {
      void (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 640, height: 480 },
            audio: false,
          })
          if (webcamRef.current) {
            webcamRef.current.srcObject = stream
            await webcamRef.current.play()
          }
        } catch {
          setShowWebcam(false)
          setWebcamError('鏡頭重新啟動失敗')
        }
      })()
    }
  }, [isVisible, showWebcam])

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
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
            onClick={handleWebcamToggle}
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

      {/*
        Bug 1 fix: <main> 加 min-h-0(flex child 必要, 否則 flex-1 失效, content 縮埋底部)
        + 內部加 flex flex-col, chip grid 用 flex-1 + overflow-y-auto(細屏可滾)
      */}
      <main className="flex-1 min-h-0 flex flex-col items-center justify-center p-4 sm:p-6 gap-4">
        <div className="text-center shrink-0">
          <p className="text-slate-300 text-sm sm:text-base">
            {isIpad
              ? '👆 用手指 click 一個表情'
              : showWebcam && hand.isReady
                ? `👆 將手指 / 滑鼠停留喺一個表情 ${(dwellTimeMs / 1000).toFixed(1)} 秒, 或者直接 click`
                : `🖱️ 將滑鼠停留喺一個表情 ${(dwellTimeMs / 1000).toFixed(1)} 秒, 或者直接 click`}
          </p>
          {showWebcam && (
            <p className="text-xs text-slate-500 mt-1" aria-live="polite">
              {webcamError
                ? `⚠️ ${webcamError}`
                : hand.isReady
                  ? '🖐️ 手指偵測就緒 — 鏡頭前舉起食指'
                  : '⌛ 手指偵測啟動中…'}
            </p>
          )}
        </div>

        <div className="relative w-full max-w-4xl shrink-0">
          {/*
            Webcam image layer (Bug 3 fix: opacity 預設 30%, 見到鏡頭)
            永遠掛喺 DOM, 即使 OFF 都保留 element, 咁 useHandTracker video ref 穩定
            mirror flip (selfie-style) 喺 CSS
          */}
          <video
            ref={webcamRef}
            className="absolute inset-0 w-full h-full object-cover rounded-2xl pointer-events-none transition-opacity duration-300"
            style={{
              opacity: showWebcam ? webcamOpacity / 100 : 0,
              transform: 'scaleX(-1)',
            }}
            autoPlay
            playsInline
            muted
            aria-hidden="true"
          />

          <div
            className={`grid grid-cols-3 gap-3 sm:gap-4 relative ${showWebcam && webcamOpacity > 0 ? 'mix-blend-difference' : ''}`}
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
                // Bug 4 fix: data-finger-target 令 useFingerHoverOnElement 知道呢個 button 係 hover target
                data-finger-target={cell.id}
                className={`
                  group relative
                  aspect-square
                  min-h-[250px] sm:min-h-[280px]
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
                {/* Progress ring (dwell visualization, R32 + Bug 4 finger dwell) */}
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

                {/*
                  Bug 2 fix: emoji text-8xl / sm:text-9xl(原本 text-7xl/sm:text-8xl 太細)
                  320px (text-8xl) / 384px (text-9xl) emoji size, 視障/長者都見到
                */}
                <div
                  className="text-8xl sm:text-9xl mb-1 sm:mb-2 leading-none"
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

          {/* R36: webcam opacity slider (only when webcam on) */}
          {showWebcam && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
              <span>👤 鏡頭背景:</span>
              <input
                type="range"
                min={0}
                max={100}
                value={webcamOpacity}
                onChange={(e) => setWebcamOpacity(Number(e.target.value))}
                className="w-24 accent-amber-400"
                aria-label="鏡頭背景透明度"
              />
              <span className="font-mono">{webcamOpacity}%</span>
              {webcamOpacity > 70 && (
                <span className="text-amber-300 ml-1" role="status">
                  ⚠️ 過高可能遮 chip
                </span>
              )}
            </div>
          )}
        </div>

        {/* Live feedback strip */}
        <div
          className="min-h-[3rem] flex items-center justify-center shrink-0"
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

      <footer className="px-4 py-3 text-center text-xs text-slate-500 border-t border-slate-700/50 space-y-1 shrink-0">
        <div>
          🟢 弱模式 · 揀情緒表達 ·{' '}
          {isIpad
            ? 'iPad 觸控'
            : showWebcam && hand.isReady
              ? '手指 / Dwell-click'
              : `Dwell-click ${(dwellTimeMs / 1000).toFixed(1)}s`}{' '}
          · 本地紀錄
        </div>
        <div className="opacity-60">
          已揀 {clickCount} 次 · 本地儲存(IndexedDB) · 私隱:零外流 🔒
        </div>
      </footer>
    </div>
  )
}

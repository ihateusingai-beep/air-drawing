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
import { speak, stopTts, isTtsSupported, preloadVoices, setTtsEnabled, getTtsEnabled, isTtsSpeaking } from '../services/tts'
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

// v3.0.7.4: per-chip trigger cooldown 2 秒, 阻擋 finger / mouse 連續 re-trigger
// 原本 useDwellClick / useFingerHoverOnElement 內部都各自有 300ms cooldown
// 但 finger 個 raf 觸發 + 食指停留期間可 N 次 re-trigger 同一 chip
// 2 秒 > 0.5s dwell + 1.5s TTS 句子, 確保 TTS 完整讀完先可再揀
const TRIGGER_COOLDOWN_MS = 2000

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
  // v3.0.7.3: trigger celebration overlay state — 控制 affirmation modal 顯示時間
  const [celebration, setCelebration] = useState<{ emotion: Emotion; key: number } | null>(null)
  // v3.0.7.4: per-chip last trigger timestamp, handleTrigger 入面 check 防連續 re-trigger
  const lastTriggerTimeRef = useRef<Record<string, number>>({})

  // R36 緩解 + Bug 3 fix: webcam optional, default opacity 30%(原本 0 過火完全隱形)
  const [showWebcam, setShowWebcam] = useState(false)
  const [webcamOpacity, setWebcamOpacity] = useState(30) // Bug 3: 預設 30, 見到鏡頭但唔太遮
  const [webcamError, setWebcamError] = useState<string | null>(null)
  const webcamRef = useRef<HTMLVideoElement | null>(null)

  // R40 緩解: 從 active profile 讀 dwell time(per profile 設定)
  const activeProfile = useProfileStore((s) =>
    s.profiles.find((p) => p.id === s.activeProfileId),
  )
  // v3.0.7.4: default 500 → 1500 配合 TTS 中文句子完整讀完
  // 0.5s 太短, TTS 句未讀完 user 已 trigger 下一個
  const dwellTimeMs = activeProfile?.dwellTimeMs ?? 1500

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
      // v3.0.7.4: per-chip 2 秒 cooldown, 防 finger / mouse 連續 trigger 同一個
      // finger dwell trigger 完 setHoveredId(null) 後, 下 1 個 frame tip 仲喺 chip 會 re-trigger
      const now = Date.now()
      const last = lastTriggerTimeRef.current[id] ?? 0
      if (now - last < TRIGGER_COOLDOWN_MS) {
        return
      }
      // v3.0.7.4: TTS 仲讀緊 → skip, 等 TTS 讀完先接受新 trigger
      // 防止「揀 A → TTS 讀 A → user 揀 A 太快 → TTS cancel 再讀 A」無限循環
      if (ttsOn && isTtsSpeaking()) {
        return
      }
      lastTriggerTimeRef.current[id] = now

      if (id === SKIP_CELL.id) {
        // Skip cell — silent, just record
        appendLog({ ts: now, emotionId: 'skip', source })
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
      // v3.0.7.3: trigger celebration modal — 吸引學生更多互動
      // 用 setTimeout 0 確保 React 先 render trigger-flash 完, 然後 modal
      setTimeout(() => {
        setCelebration({ emotion, key: now })
        // 1.5s 後自動消失
        setTimeout(() => setCelebration(null), 1500)
      }, 200)
      // Log
      appendLog({ ts: now, emotionId: emotion.id, source })
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
        Bug 1 fix (v3.0.7): layout 完全重做
        - 將 chip grid 嘅 container 改 flex-1 + min-h-0 真正撐大
        - 加 Finger cursor overlay(絕對定位, 圓點跟食指 normalized coord, 清楚見 detection)
        - Webcam 變成 fullscreen background layer(同 chip 完全分開), 唔再疊喺 chip container 內
        - Chip 加 hover scale-110 + emoji animate-pulse, 食指 hover 時有明顯 visual feedback
        - Trigger 時全屏 emotion color flash
      */}
      <main className="flex-1 min-h-0 flex flex-col items-stretch justify-center p-3 sm:p-4 gap-3 relative">
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
                : hand.error
                  ? `⚠️ 手指偵測錯誤: ${hand.error}`
                  : hand.isReady
                    ? '🖐️ 手指偵測就緒 — 鏡頭前舉起食指, 見到 👆 跟住你'
                    : '⌛ 手指偵測啟動中…(首次需下載 MediaPipe model, 約 5-10 秒)'}
            </p>
          )}
        </div>

        {/*
          Stage: 固定 aspect-ratio 9:12(直向), chip 填滿內部
          Webcam 變成 stage 嘅 background(同 chip 唔再疊, 避免 z-index/positioning 衝突)
        */}
        <div className="relative w-full max-w-3xl mx-auto flex-1 min-h-0 flex flex-col">
          {/*
            Webcam image layer (full stage background, mirror flip)
            永遠掛喺 DOM, 即使 OFF 都保留 element, 咁 useHandTracker video ref 穩定
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

          {/*
            Chip grid layer: z-index 1, 永遠喺 webcam 之上
            唔再用 mix-blend-difference(之前令 chip 變怪色)
            用 auto-rows-fr 確保每 row 平分高度
          */}
          <div
            className="relative z-10 grid grid-cols-3 auto-rows-fr gap-2 sm:gap-3 h-full p-2"
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
                  min-h-[120px] sm:min-h-[160px]
                  p-2 sm:p-3
                  rounded-2xl sm:rounded-3xl
                  border-2 sm:border-4
                  flex flex-col items-center justify-center
                  transition-all duration-200 ease-out
                  shadow-xl
                  focus-visible:ring-4 focus-visible:ring-amber-400 focus:outline-none
                  ${isSkip
                    ? 'bg-slate-800/80 border-slate-600 text-slate-400'
                    : ''
                  }
                  ${!isSkip && isLastClicked ? 'animate-bounce' : ''}
                  ${isHovered && !isSkip ? 'scale-110 shadow-2xl z-20' : 'hover:scale-105'}
                  active:scale-95
                `}
                style={
                  isSkip
                    ? undefined
                    : {
                        backgroundColor: isHovered ? cell.hex : cell.hexSoft,
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
                      x="4"
                      y="4"
                      width="calc(100% - 8px)"
                      height="calc(100% - 8px)"
                      rx="16"
                      fill="none"
                      stroke="white"
                      strokeOpacity="0.95"
                      strokeWidth="6"
                      strokeDasharray={`${cellProgress * 100} 100`}
                      style={{ pathLength: 100 } as React.CSSProperties}
                    />
                  </svg>
                )}

                {/*
                  Bug 2 fix v3.0.7: emoji text-7xl / sm:text-8xl(原本 text-8xl/9xl 太大撞 chip 邊)
                  chip 用 flex-1 + auto-rows-fr 後, 高度由 row 控制, 唔再依賴 min-h
                  留返 text-7xl/8xl 比 emoji 視覺主導, 中英文下面
                */}
                <div
                  className={`
                    text-7xl sm:text-8xl leading-none
                    ${isHovered && !isSkip ? 'animate-pulse' : ''}
                    transition-transform duration-200
                  `}
                  aria-hidden="true"
                >
                  {cell.emoji}
                </div>
                <div className="text-sm sm:text-base font-bold leading-tight mt-1">
                  {cell.labelZh}
                </div>
                <div className="text-[9px] sm:text-[10px] opacity-70 leading-tight hidden sm:block">
                  {cell.labelEn}
                </div>
              </button>
            )
          })}
          </div>

          {/*
            Finger cursor overlay(v3.0.7 新加, v3.0.7.4 加強)
            - 加大粒 (w-10 h-10)
            - 3 層 ring: 內核 + ping 動畫 + 外圈 glow shadow
            - 食指 emoji 👆 喺圓點上面, 清楚表示「呢個就係你食指」
            - mirror flip 同 webcam 一致
            - pointer-events-none 唔阻擋 elementFromPoint (browser 仍命中下層 chip)
          */}
          {hand.isReady && hand.indexFingerTip && showWebcam && webcamRef.current && (() => {
            const v = webcamRef.current
            const rect = v.getBoundingClientRect()
            // Mirror flip 同 useFingerHoverOnElement 一致
            const screenX = (1 - hand.indexFingerTip!.x) * rect.width + rect.left
            const screenY = hand.indexFingerTip!.y * rect.height + rect.top
            return (
              <div
                className="fixed pointer-events-none z-50"
                style={{
                  left: `${screenX}px`,
                  top: `${screenY}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                aria-hidden="true"
              >
                <div className="relative w-12 h-12 flex items-center justify-center">
                  {/* Outer glow ring */}
                  <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-xl" />
                  {/* Ping animation ring (擴散效果) */}
                  <div className="absolute inset-0 rounded-full bg-amber-400/50 animate-ping" />
                  {/* Solid core (大粒) */}
                  <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 border-[3px] border-white shadow-2xl flex items-center justify-center">
                    <span className="text-lg leading-none">👆</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/*
            Trigger flash overlay(v3.0.7 新加, 用戶要求 emotion 表達動畫)
            Trigger 瞬間全屏 flash 該 emotion 嘅色, 1.2s 衰減
          */}
          {lastClicked && lastClicked !== 'skip' && (() => {
            const emotion = EMOTIONS_BY_ID[lastClicked]
            if (!emotion) return null
            return (
              <div
                key={lastClicked + clickCount}
                className="fixed inset-0 pointer-events-none z-40 animate-trigger-flash"
                style={{ backgroundColor: emotion.hex, mixBlendMode: 'screen' }}
                aria-hidden="true"
              />
            )
          })()}

          {/*
            v3.0.7.3: Trigger celebration modal — 吸引更多互動
            200ms 後出現(等 trigger-flash 跑先), 顯示 1.5s 自動消失
            - 中央大 emoji + 「你揀咗 XXX」+ emotion color 背景
            - 8 個 particle burst 從中央散出
            - pointer-events-none 唔阻擋下一個 click
          */}
          {celebration && (
            <div
              key={celebration.key}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none animate-celebration-pop"
              aria-hidden="true"
            >
              {/* Modal: emoji + label */}
              <div
                className="px-8 py-6 rounded-3xl shadow-2xl border-4 border-white/40 text-center animate-celebration-scale"
                style={{
                  backgroundColor: celebration.emotion.hexSoft,
                  color: celebration.emotion.hex,
                }}
              >
                <div className="text-9xl leading-none mb-2">{celebration.emotion.emoji}</div>
                <div className="text-2xl font-bold">{celebration.emotion.labelZh}</div>
                <div className="text-sm opacity-80 mt-1">{celebration.emotion.labelEn}</div>
              </div>
              {/* Particle burst: 8 個小圓點從中央散出 */}
              {Array.from({ length: 8 }).map((_, i) => {
                const angle = (i / 8) * Math.PI * 2
                const distance = 180 // px
                const tx = Math.cos(angle) * distance
                const ty = Math.sin(angle) * distance
                return (
                  <div
                    key={i}
                    className="absolute w-4 h-4 rounded-full animate-celebration-particle"
                    style={{
                      backgroundColor: celebration.emotion.hex,
                      '--tx': `${tx}px`,
                      '--ty': `${ty}px`,
                      boxShadow: `0 0 12px ${celebration.emotion.hex}`,
                    } as React.CSSProperties}
                  />
                )
              })}
            </div>
          )}

          {/* R36: webcam opacity slider (only when webcam on) */}
          {showWebcam && (
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-400 shrink-0">
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

        {/* Live feedback strip — v3.0.7.4: 隱藏有 celebration 期間, 避免 trigger-flash + modal + strip triple layer */}
        <div
          className="min-h-[3rem] flex items-center justify-center shrink-0"
          aria-live="polite"
          aria-atomic="true"
        >
          {!celebration && lastClicked && lastClicked !== 'skip' && (
            <div
              className="px-4 py-2 rounded-full text-sm font-semibold shadow-lg animate-feedback-fade-in"
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
          {!celebration && lastClicked === 'skip' && (
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

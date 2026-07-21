/**
 * Weak mode shell (🟢) — v3.0.8 refactored orchestrator
 *
 * PLAN §12.1, §12.2, §12.5, §12.7
 *
 * v3.0.8 refactor: WeakModeShell.tsx 由 717 行 → ~250 行 orchestrator
 *   - 拆 5 個 sub-component: Header / ChipGrid / Celebration / Status / Footer
 *   - 邏輯(hooks / state / handlers)留喺度, JSX 全部由 sub-component render
 *
 * v3.0.8 features:
 *   - E22 AAC mode toggle (UX-3, v3.0.7.6 提案)
 *   - 5s camera fallback auto-suggest AAC mode (UX-1, R-T1 緩解)
 *
 * UX:
 *   - 3×3 grid: 8 Plutchik emotion + 1 skip
 *   - Mouse dwell-click 0.5-2.5s
 *   - Webcam + MediaPipe Hands 食指 hover chip 0.5s = click
 *   - Click / dwell / finger hover 全部 trigger 同一個 handleTrigger
 *   - Per-chip 2s cooldown + TTS lock 防連續 re-trigger
 *
 * Privacy:
 *   - 0 user data 上傳 (R27)
 *   - MediaPipe WASM + model 由 jsdelivr / storage.googleapis.com 公開 CDN load
 *   - Emotion log 寫 IndexedDB (local-only)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { EMOTIONS_BY_ID, SKIP_CELL, type Emotion, type EmotionId } from '../constants/emotions'
import { speak, stopTts, preloadVoices, setTtsEnabled, getTtsEnabled, isTtsSpeaking } from '../services/tts'
import { useDwellClick } from '../hooks/useFingerHover'
import { useHandTracker, useFingerHoverOnElement } from '../hooks/useHandTracker'
import { useAACPreference } from '../hooks/useAACPreference'
import { useProfileStore } from '../store/profileStore'
import { usePageVisibility } from '../hooks/usePageVisibility'
import {
  WeakModeHeader,
  WeakModeChipGrid,
  WeakModeStatus,
  WeakModeFeedbackStrip,
  WeakModeSlider,
  WeakModeCelebration,
  WeakModeFooter,
} from './WeakMode'

interface WeakModeShellProps {
  onExit: () => void
}

interface EmotionClickLog {
  ts: number
  emotionId: EmotionId | 'skip'
  source: 'mouse-dwell' | 'touch-click' | 'mouse-click' | 'finger-hover'
}

const STORAGE_KEY = 'air-drawing:weak-mode-log'

// v3.0.7.4: per-chip trigger cooldown 2 秒
const TRIGGER_COOLDOWN_MS = 2000
// v3.0.7.6 (UX-1): 5 秒後 hand 仲未 ready → 自動 suggest AAC mode
const HAND_INIT_FALLBACK_MS = 5000

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

  // v3.0.7.3: trigger celebration overlay
  // v3.0.7.5: 加 chipRect 畀 emoji flying animation 用起點
  const [celebration, setCelebration] = useState<{
    emotion: Emotion
    key: number
    chipRect: { x: number; y: number } | null
  } | null>(null)

  // v3.0.7.4: per-chip last trigger timestamp
  const lastTriggerTimeRef = useRef<Record<string, number>>({})

  // v3.0.8 audit fix: nested setTimeout leak (setCelebration 200ms + 1800ms)
  // Unmount 期間 timer 仍 fire, setState on unmounted component
  // Fix: Set ref 收集所有 pending timer IDs, unmount cleanup 一次過 clear
  const celebrationTimersRef = useRef<Set<number>>(new Set())

  // R36 緩解 + Bug 3 fix: webcam optional, default opacity 30%
  const [showWebcam, setShowWebcam] = useState(false)
  const [webcamOpacity, setWebcamOpacity] = useState(30)
  const [webcamError, setWebcamError] = useState<string | null>(null)
  const webcamRef = useRef<HTMLVideoElement | null>(null)

  // v3.0.7.6 (UX-3): E22 AAC mode — 純 click, 隱藏鏡頭
  const { aacMode } = useAACPreference()
  // v3.0.7.6 (UX-1): 5s camera fallback — showWebcam && !aacMode 5s 仍 hand.isReady false → suggest
  const [showFallbackHint, setShowFallbackHint] = useState(false)
  const fallbackTimerRef = useRef<number | null>(null)

  // R40: per-profile dwell time, default 1500
  const activeProfile = useProfileStore((s) =>
    s.profiles.find((p) => p.id === s.activeProfileId),
  )
  const dwellTimeMs = activeProfile?.dwellTimeMs ?? 1500

  // Gate 1 F1 fix (commit 41a1fc5): 切 profile 清 state, 防 cross-profile leak
  useEffect(() => {
    lastTriggerTimeRef.current = {}
    setCelebration(null)
    setLastClicked(null)
  }, [activeProfile?.id])

  useEffect(() => {
    preloadVoices()
  }, [])

  useEffect(() => {
    return () => {
      stopTts()
      // v3.0.8 audit fix: clear 所有 pending celebration timer
      celebrationTimersRef.current.forEach((id) => window.clearTimeout(id))
      celebrationTimersRef.current.clear()
    }
  }, [])

  const handleTrigger = useCallback(
    (id: string, source: 'mouse-dwell' | 'touch-click' | 'mouse-click' | 'finger-hover') => {
      // Per-chip cooldown + TTS lock
      const now = Date.now()
      const last = lastTriggerTimeRef.current[id] ?? 0
      if (now - last < TRIGGER_COOLDOWN_MS) return
      if (ttsOn && isTtsSpeaking()) return
      lastTriggerTimeRef.current[id] = now

      if (id === SKIP_CELL.id) {
        appendLog({ ts: now, emotionId: 'skip', source })
        setLastClicked('skip')
        return
      }
      const emotion = EMOTIONS_BY_ID[id as EmotionId]
      if (!emotion) return
      if (ttsOn) speak(emotion.ttsText, { lang: 'zh-Hant' })
      setLastClicked(emotion.id)
      setClickCount((c) => c + 1)

      // 攞 trigger chip screen position
      let chipRect: { x: number; y: number } | null = null
      if (typeof document !== 'undefined') {
        const el = document.querySelector(`[data-finger-target="${CSS.escape(id)}"]`) as HTMLElement | null
        if (el) {
          const r = el.getBoundingClientRect()
          chipRect = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        }
      }

      // v3.0.8 audit fix: timer IDs 收集落 ref, unmount 時一次過 clear
      const showTimer = window.setTimeout(() => {
        setCelebration({ emotion, key: now, chipRect })
        celebrationTimersRef.current.delete(showTimer)
        const hideTimer = window.setTimeout(() => {
          setCelebration(null)
          celebrationTimersRef.current.delete(hideTimer)
        }, 1800)
        celebrationTimersRef.current.add(hideTimer)
      }, 200)
      celebrationTimersRef.current.add(showTimer)
      appendLog({ ts: now, emotionId: emotion.id, source })
    },
    [ttsOn],
  )

  const { hoveredId: mouseHoveredId, progress: mouseProgress, getChipProps, isIpad } = useDwellClick({
    dwellTimeMs,
    onTrigger: (id) => handleTrigger(id, 'mouse-dwell'),
  })

  // Bug 4: MediaPipe Hands 食指追蹤
  const isVisible = usePageVisibility()
  const suspended = !isVisible
  // v3.0.7.6: aacMode 強制停 finger detection
  const handTrackingActive = showWebcam && !suspended && !isIpad && !aacMode
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

  // 合併 hover: finger 優先
  const hoveredId = fingerHoveredId ?? mouseHoveredId
  const progress = fingerHoveredId ? fingerProgress : mouseProgress

  // v3.0.7.6 (UX-1): 5s camera fallback 邏輯
  // 條件: 鏡頭 ON + 唔係 iPad + 唔係 AAC mode + 5s 仲 hand.isReady false
  // v3.0.8 audit fix: hand.isReady 加落 deps, ready 時即停 fallback hint
  useEffect(() => {
    const isIpadLike = typeof navigator !== 'undefined' && /iPad/.test(navigator.userAgent)
    // 已 ready → 即刻清 fallback hint, 唔 schedule timer
    if (hand.isReady) {
      setShowFallbackHint(false)
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
      return
    }
    if (!showWebcam || isIpadLike || aacMode) {
      setShowFallbackHint(false)
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
      return
    }
    // Start 5s timer
    fallbackTimerRef.current = window.setTimeout(() => {
      setShowFallbackHint(true)
    }, HAND_INIT_FALLBACK_MS)
    return () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current)
        fallbackTimerRef.current = null
      }
    }
  }, [showWebcam, aacMode, hand.isReady])

  const handleTtsToggle = useCallback(() => {
    setTtsOnState((on) => {
      setTtsEnabled(!on)
      return !on
    })
  }, [])

  const handleWebcamToggle = useCallback(async () => {
    setWebcamError(null)
    setShowFallbackHint(false)
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

  // Webcam cleanup on unmount
  useEffect(() => {
    return () => {
      if (webcamRef.current?.srcObject) {
        const tracks = (webcamRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach((t) => t.stop())
      }
    }
  }, [])

  // PWA background suspend webcam
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

  // F2 reset-on-render: 鏡頭 ON 但 aacMode 時隱藏 webcam toggle UX
  // (鏡頭 ref 仍然掛喺 DOM 因為 finger 用, 純 click 唔用)
  const showWebcamUI = showWebcam && !aacMode

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <WeakModeHeader
        ttsOn={ttsOn}
        showWebcam={showWebcam}
        onTtsToggle={handleTtsToggle}
        onWebcamToggle={handleWebcamToggle}
        onExit={onExit}
      />

      <main className="flex-1 min-h-0 flex flex-col items-stretch justify-center p-3 sm:p-4 gap-3 relative">
        <WeakModeStatus
          isIpad={isIpad}
          showWebcam={showWebcamUI}
          hand={hand}
          webcamError={webcamError}
          dwellTimeMs={dwellTimeMs}
        />

        {/* v3.0.7.6 (UX-1): 5s camera fallback hint
            鏡頭 ON + 5s 仲未 ready + 唔係 iPad → 提示用戶切 AAC mode */}
        {showFallbackHint && !hand.isReady && (
          <div
            className="rounded-lg bg-amber-900/40 border border-amber-600/50 px-4 py-2 text-amber-200 text-sm text-center shrink-0"
            role="status"
          >
            ⌛ 手指偵測超過 5 秒仲未就緒。
            <a
              href="#aac-mode"
              className="underline ml-1"
              onClick={(e) => {
                e.preventDefault()
                localStorage.setItem('air-drawing:aac-mode', 'true')
                location.reload() // 簡單 reload trigger 重新 init with AAC mode
              }}
            >
              切去「純 click 模式」
            </a>
            ?
          </div>
        )}

        <WeakModeChipGrid
          webcamRef={webcamRef}
          showWebcam={showWebcamUI}
          webcamOpacity={webcamOpacity}
          hoveredId={hoveredId}
          lastClicked={lastClicked}
          progress={progress}
          getChipProps={getChipProps}
          hand={hand}
        />

        <WeakModeSlider
          showWebcam={showWebcamUI}
          webcamOpacity={webcamOpacity}
          onChange={setWebcamOpacity}
        />

        <WeakModeFeedbackStrip
          celebrationActive={celebration !== null}
          lastClicked={lastClicked}
        />
      </main>

      <WeakModeCelebration
        celebration={celebration}
        lastClicked={lastClicked}
        clickCount={clickCount}
      />

      <WeakModeFooter
        isIpad={isIpad}
        dwellTimeMs={dwellTimeMs}
        fingerDetectionActive={showWebcamUI && hand.isReady}
        clickCount={clickCount}
      />
    </div>
  )
}

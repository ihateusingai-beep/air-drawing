/**
 * MidModeShell — 🟡 中級模式完整實裝 (Phase 3 batch 3A).
 *
 * PLAN §12.3, §12.5, §12.7:
 *   - 鏡頭啟動(getUserMedia)
 *   - MediaPipe Pose 33 keypoints 偵測(usePoseTracker)
 *   - 8 個 rule-based 動作 classifier(classifyPose)
 *   - 用戶要做嘅動作 = 提示 prompt(emoji + 中文 + 英文)
 *   - 動作 match → chip 高亮 + TTS + 寫 IDB emotion log
 *   - dwell 0.5s 才 confirm(防誤觸, R24 緩解)
 *   - fallback: 動作做唔到, click chip 仍 work(R37 坐姿 friendly)
 *   - 鏡頭 background suspend(usePageVisibility, R14)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GRID_LAYOUT, EMOTIONS_BY_ID, type Emotion, type EmotionId } from '../constants/emotions'
import { speak, stopTts, preloadVoices } from '../services/tts'
import { usePoseTracker, useLandmarkHistory } from '../hooks/usePoseTracker'
import { usePageVisibility } from '../hooks/usePageVisibility'
import {
  classifyPose,
  POSE_LABELS,
  type PoseAction,
} from '../lib/poseClassifier'
import { appendEmotionLog } from '../services/idb'
import { useProfileStore } from '../store/profileStore'

interface MidModeShellProps {
  onExit: () => void
}

const DWELL_CONFIRM_MS = 500 // 動作 match 持續 0.5s 先 confirm (R24 緩解)

export function MidModeShell({ onExit }: MidModeShellProps): React.JSX.Element {
  // Webcam state
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [showWebcam, setShowWebcam] = useState(false)
  const [webcamError, setWebcamError] = useState<string | null>(null)

  // Profile
  const activeProfileId = useProfileStore((s) => s.activeProfileId)

  // Pose state
  const [currentPose, setCurrentPose] = useState<PoseAction>('none')
  const [currentEmotion, setCurrentEmotion] = useState<EmotionId | null>(null)
  const [confidence, setConfidence] = useState(0)
  const [matchProgress, setMatchProgress] = useState(0) // 0-1 dwell progress

  // iPad auto-detect
  const [isIpad, setIsIpad] = useState(false)

  // Preload voices on mount
  useEffect(() => {
    preloadVoices()
  }, [])

  // iPad detection
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const ua = navigator.userAgent
    setIsIpad(
      /iPad|iPhone|iPod/.test(ua) ||
        (/Mac/.test(ua) && navigator.maxTouchPoints > 1),
    )
  }, [])

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => stopTts()
  }, [])

  // R14 background suspend
  const isVisible = usePageVisibility()
  const [suspended, setSuspended] = useState(false)
  useEffect(() => {
    if (isVisible) {
      setSuspended(false)
      return
    }
    if (showWebcam) {
      // Background: 停 webcam
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach((t) => t.stop())
        videoRef.current.srcObject = null
      }
      setShowWebcam(false)
      setSuspended(true)
    }
  }, [isVisible, showWebcam])

  // Pose tracker
  const pose = usePoseTracker({
    video: videoRef.current,
    active: showWebcam && !suspended,
    modelComplexity: 0, // R23 iPad 性能
  })
  const history = useLandmarkHistory(pose.landmarks, 4)

  // 8 動作 classifier — 每次 landmarks 變化 trigger
  const classification = useMemo(() => {
    if (!pose.landmarks) {
      return null
    }
    const prevFrame = history[1] ?? null
    const prevFrames = [history[1] ?? null, history[2] ?? null, history[3] ?? null]
    return classifyPose(pose.landmarks, prevFrame, prevFrames)
  }, [pose.landmarks, history])

  // Update state from classification
  useEffect(() => {
    if (!classification) {
      setCurrentPose('none')
      setCurrentEmotion(null)
      setConfidence(0)
      return
    }
    setCurrentPose(classification.action)
    setCurrentEmotion(classification.emotionId)
    setConfidence(classification.confidence)
  }, [classification])

  // R24 緩解: 動作 match 後 0.5s dwell 才 confirm + 觸發
  const lastPoseRef = useRef<PoseAction>('none')
  const matchStartRef = useRef<number | null>(null)
  useEffect(() => {
    if (currentPose === 'none' || currentEmotion === null) {
      matchStartRef.current = null
      setMatchProgress(0)
      return
    }
    if (lastPoseRef.current !== currentPose) {
      lastPoseRef.current = currentPose
      matchStartRef.current = performance.now()
    }
    if (matchStartRef.current === null) {
      matchStartRef.current = performance.now()
    }
  }, [currentPose, currentEmotion])

  // 動畫 progress 跟 dwell
  useEffect(() => {
    if (matchStartRef.current === null) {
      setMatchProgress(0)
      return
    }
    let raf = 0
    const tick = (): void => {
      if (matchStartRef.current === null) return
      const elapsed = performance.now() - matchStartRef.current
      const p = Math.min(1, elapsed / DWELL_CONFIRM_MS)
      setMatchProgress(p)
      if (p < 1) {
        raf = requestAnimationFrame(tick)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [currentPose, currentEmotion])

  // Trigger emotion when matchProgress 達 1
  useEffect(() => {
    if (matchProgress < 1 || currentEmotion === null) return
    const emotion = EMOTIONS_BY_ID[currentEmotion]
    if (!emotion) return
    void handleEmotionTrigger(emotion, 'pose-classifier')
    // Reset
    matchStartRef.current = null
    setMatchProgress(0)
    lastPoseRef.current = 'none'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchProgress])

  const handleEmotionTrigger = useCallback(
    async (emotion: Emotion, source: 'mouse-dwell' | 'touch-click' | 'mouse-click' | 'pose-classifier') => {
      speak(emotion.ttsText, { lang: 'zh-Hant' })
      if (activeProfileId) {
        try {
          await appendEmotionLog({
            profileId: activeProfileId,
            emotionId: emotion.id,
            source,
            ts: Date.now(),
          })
        } catch {
          /* ignore */
        }
      }
    },
    [activeProfileId],
  )

  const handleWebcamToggle = useCallback(async () => {
    setWebcamError(null)
    if (!showWebcam) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } },
          audio: false,
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setShowWebcam(true)
      } catch (err) {
        setWebcamError(err instanceof Error ? err.message : '無法啟動鏡頭')
      }
    } else {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach((t) => t.stop())
        videoRef.current.srcObject = null
      }
      setShowWebcam(false)
    }
  }, [showWebcam])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach((t) => t.stop())
      }
    }
  }, [])

  return (
    <div className="min-h-dvh flex flex-col bg-slate-900 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/60">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <span aria-hidden>🟡</span>
          <span>中級模式</span>
          <span className="text-xs text-slate-400 hidden sm:inline">(Mid / Intermediate)</span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleWebcamToggle()}
            aria-pressed={showWebcam}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-semibold border transition active:scale-95
              ${showWebcam
                ? 'bg-green-500/20 border-green-500/50 text-green-300'
                : 'bg-slate-700 text-slate-300 border-transparent'
              }
            `}
          >
            {showWebcam ? '🟢 鏡頭 ON' : '🔴 鏡頭 OFF'}
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

      <main className="flex-1 flex flex-col lg:flex-row p-4 gap-4 max-w-6xl mx-auto w-full">
        {/* Left: 鏡頭 + pose prompt */}
        <div className="flex-1 flex flex-col">
          <div className="relative w-full max-w-[480px] aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-700/80 mx-auto">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }} // mirror selfie-style
              autoPlay
              playsInline
              muted
              aria-label="鏡頭 preview (mid mode AI 動作偵測)"
            />
            {/* Pose prompt overlay */}
            {showWebcam && (
              <div className="absolute top-2 left-2 right-2 bg-slate-900/85 backdrop-blur rounded-lg p-3 text-center">
                <div className="text-4xl mb-1" aria-hidden="true">
                  {POSE_LABELS[currentPose].emoji}
                </div>
                <div className="text-base font-bold text-amber-400">
                  {POSE_LABELS[currentPose].zh}
                </div>
                <div className="text-xs text-slate-400">
                  {POSE_LABELS[currentPose].en}
                </div>
                {currentPose !== 'none' && (
                  <>
                    <div className="text-xs text-slate-300 mt-1">
                      信心 {(confidence * 100).toFixed(0)}% · 保持 {DWELL_CONFIRM_MS / 1000}s
                    </div>
                    {/* Dwell progress bar */}
                    <div
                      className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuenow={Math.round(matchProgress * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full bg-amber-400 transition-all duration-100"
                        style={{ width: `${matchProgress * 100}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            {/* Webcam 提示(未開) */}
            {!showWebcam && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-slate-900">
                <div className="text-5xl mb-3" aria-hidden="true">📷</div>
                <p className="text-slate-300 text-sm mb-4 max-w-xs">
                  開啟鏡頭後,做指定動作,自動觸發情緒表達。
                  <br />
                  <span className="text-xs text-slate-500">唔使鏡頭,直接 click chip 仍 work</span>
                </p>
                <button
                  type="button"
                  onClick={() => void handleWebcamToggle()}
                  className="px-4 py-2 bg-amber-500 text-slate-900 text-sm font-bold rounded-lg active:scale-95"
                >
                  開啟鏡頭
                </button>
                {webcamError && (
                  <p className="text-xs text-rose-400 mt-2" role="alert">
                    {webcamError}
                  </p>
                )}
              </div>
            )}
            {/* Pose error */}
            {pose.error && (
              <div className="absolute bottom-2 left-2 right-2 bg-rose-900/80 rounded p-2 text-xs text-rose-200" role="alert">
                {pose.error}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 text-center mt-2 max-w-md mx-auto">
            {isIpad
              ? '🟡 中級模式 · 做動作 trigger · iPad 已偵測'
              : '🟡 中級模式 · 做動作 trigger · Mouse 用戶可 click chip 替代'}
          </p>
        </div>

        {/* Right: 8 emotion chip + skip — fallback click */}
        <div className="w-full lg:w-80 flex flex-col gap-3">
          <p className="text-xs text-slate-400 text-center">💡 動作做唔到? 直接 click chip</p>
          <div className="grid grid-cols-2 gap-2">
            {GRID_LAYOUT.map((cell) => {
              const isSkip = cell.id === 'skip'
              const isCurrentEmotion = currentEmotion === cell.id
              const cellEmo = !isSkip ? (cell as Emotion) : null
              return (
                <button
                  key={cell.id}
                  type="button"
                  onClick={() => {
                    if (cellEmo) void handleEmotionTrigger(cellEmo, 'touch-click')
                  }}
                  disabled={isSkip}
                  className={`
                    p-3 rounded-xl border-2 transition-all active:scale-95
                    ${isSkip ? 'bg-slate-800 border-slate-700 text-slate-500' : ''}
                    ${!isSkip && isCurrentEmotion ? 'ring-4 ring-amber-400 animate-bounce' : ''}
                  `}
                  style={
                    isSkip
                      ? undefined
                      : {
                          backgroundColor: cellEmo?.hexSoft,
                          borderColor: isCurrentEmotion ? cellEmo?.hex : 'transparent',
                          color: cellEmo?.hex,
                        }
                  }
                  aria-label={
                    isSkip ? '跳過' : `${cellEmo?.labelZh} ${cellEmo?.labelEn} (${cellEmo?.ttsText})`
                  }
                >
                  {!isSkip && cellEmo && (
                    <>
                      <div className="text-3xl mb-1" aria-hidden="true">{cellEmo.emoji}</div>
                      <div className="text-sm font-bold">{cellEmo.labelZh}</div>
                      <div className="text-[10px] opacity-70">{cellEmo.labelEn}</div>
                    </>
                  )}
                  {isSkip && (
                    <>
                      <div className="text-3xl mb-1" aria-hidden="true">⏭</div>
                      <div className="text-sm">跳過</div>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </main>

      <footer className="px-4 py-3 text-center text-xs text-slate-500 border-t border-slate-700/50">
        🟡 中級模式 · MediaPipe Pose · 8 動作 classifier · 本地 0 上傳 🔒
      </footer>
    </div>
  )
}

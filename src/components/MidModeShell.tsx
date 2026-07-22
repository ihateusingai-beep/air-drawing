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
import { useEmotionLog } from '../hooks/useEmotionLog'
import { EmotionJournal } from './EmotionJournal'
import {
  classifyPose,
  POSE_LABELS,
  type PoseAction,
} from '../lib/poseClassifier'
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
  const classifierTolerance = useProfileStore((s) => {
    const p = s.profiles.find((pp) => pp.id === s.activeProfileId)
    return p?.classifierTolerance ?? 1.0
  })

  // Sprint 76 F1-B4c: 情緒日記 — 統一 useEmotionLog hook (5s dedup)
  // 取代之前直接 call appendEmotionLog (冇 dedup, 易 spam)
  const emotionLog = useEmotionLog({ profileId: activeProfileId ?? undefined })

  // Sprint 76 F1-B4c: 情緒週報 modal toggle
  const [journalOpen, setJournalOpen] = useState(false)

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
    return classifyPose(pose.landmarks, prevFrame, prevFrames, classifierTolerance)
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
      // v3.0.8.7.4 (Sprint 76 F1-B4c): 統一 useEmotionLog hook
      // 之前 direct appendEmotionLog call 冇 5s dedup, pose-classifier 連續 match 會 spam log
      // 改用 hook 後 5s window per (profile, emotion, source) 自動 dedup
      await emotionLog.log(emotion.id, source)
    },
    [emotionLog],
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

  // Pose calibration state — per profile tolerance 校準 step
  const [calibrationStep, setCalibrationStep] = useState<number>(-1) // -1 = off
  const [calibrationScores, setCalibrationScores] = useState<Record<string, number[]>>({})
  const [showCalibration, setShowCalibration] = useState(false)

  // Pose 動作順序: 8 個 emotion 動作順序
  const POSE_CALIBRATION_ORDER: Array<{
    key: string
    label: { zh: string; emoji: string }
  }> = [
    { key: 'hands_up', label: { zh: '舉高雙手', emoji: '🙌' } },
    { key: 'hands_down', label: { zh: '放下雙手', emoji: '👇' } },
    { key: 'fist', label: { zh: '握拳', emoji: '✊' } },
    { key: 'cover_face', label: { zh: '掩面', emoji: '🙈' } },
    { key: 'hug', label: { zh: '擁抱姿勢', emoji: '🤗' } },
    { key: 'clap', label: { zh: '拍手', emoji: '👏' } },
    { key: 'step_back', label: { zh: '退後', emoji: '🙅' } },
    { key: 'pace', label: { zh: '來回踱步', emoji: '🚶' } },
  ]

  // 收集 calibration 數據
  useEffect(() => {
    if (calibrationStep < 0 || !classification) return
    const currentPose = POSE_CALIBRATION_ORDER[calibrationStep]?.key
    if (!currentPose) return
    const score = classification.scores[currentPose as keyof typeof classification.scores] ?? 0
    setCalibrationScores((prev) => {
      const arr = prev[currentPose] ?? []
      const next = [...arr, score].slice(-30) // last 30 frames ~ 1s at 30fps
      return { ...prev, [currentPose]: next }
    })
  }, [classification, calibrationStep])

  const handleStartCalibration = useCallback(() => {
    setShowCalibration(true)
    setCalibrationScores({})
    setCalibrationStep(0)
  }, [])

  const handleCalibrationNext = useCallback(() => {
    setCalibrationStep((s) => s + 1)
  }, [])

  const handleCalibrationFinish = useCallback(async () => {
    // 分析數據: 每個動作平均 score 計算建議 tolerance
    const avgScores: Record<string, number> = {}
    for (const [key, scores] of Object.entries(calibrationScores)) {
      if (scores.length > 0) {
        avgScores[key] = scores.reduce((a, b) => a + b, 0) / scores.length
      }
    }
    // 如果平均 score 全部 >= 0.5, 用戶動作清楚, 建議嚴格 tolerance
    // 如果低, 建議寬鬆
    const avgAll =
      Object.values(avgScores).reduce((a, b) => a + b, 0) /
      Math.max(1, Object.values(avgScores).length)
    let suggested: number
    if (avgAll >= 0.7) {
      suggested = 0.7 // 動作清楚, 嚴格
    } else if (avgAll >= 0.5) {
      suggested = 1.0 // 預設
    } else {
      suggested = 1.3 // 動作模糊, 寬鬆
    }
    // Save to profile
    if (activeProfileId) {
      await useProfileStore.getState().updateProfile(activeProfileId, {
        classifierTolerance: suggested,
      })
    }
    setShowCalibration(false)
    setCalibrationStep(-1)
  }, [calibrationScores, activeProfileId])

  return (
    <div className="min-h-dvh flex flex-col bg-slate-900 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/60">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <span aria-hidden>🟡</span>
          <span>中級模式</span>
          <span className="text-xs text-slate-400 hidden sm:inline">(Mid / Intermediate)</span>
        </h1>
        <div className="flex items-center gap-2">
          {/* Sprint 76 F1-B4c: 情緒週報 button (header 內, 對齊 Weak/High mode 統一位置) */}
          {activeProfileId && (
            <button
              type="button"
              onClick={() => setJournalOpen(true)}
              aria-label="開啟情緒週報"
              className="px-3 py-1.5 min-h-[36px] rounded-full bg-amber-500/90 hover:bg-amber-400 text-slate-900 text-xs font-bold border border-amber-300 transition active:scale-95"
            >
              📊 週報
            </button>
          )}
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

      {/* Calibration 啟動 button */}
      {!showCalibration && showWebcam && pose.isReady && (
        <div className="px-4 pb-3 text-center">
          <button
            type="button"
            onClick={handleStartCalibration}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 active:scale-95"
          >
            🎯 校準 Pose 動作 (建議 per profile)
          </button>
          <span className="text-xs text-slate-500 ml-2">
            目前 tolerance: {classifierTolerance.toFixed(1)}
          </span>
        </div>
      )}

      {/* Calibration modal */}
      {showCalibration && calibrationStep >= 0 && (
        <div
          className="fixed inset-0 bg-slate-950/95 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Pose 動作校準"
        >
          <div className="bg-slate-800 rounded-2xl border border-amber-500/50 shadow-2xl max-w-md w-full p-6">
            {calibrationStep < POSE_CALIBRATION_ORDER.length ? (
              <>
                <h2 className="text-lg font-bold text-amber-400 mb-2 text-center">
                  🎯 校準動作 {calibrationStep + 1} / {POSE_CALIBRATION_ORDER.length}
                </h2>
                <div className="text-center mb-4">
                  <div className="text-7xl mb-2" aria-hidden="true">
                    {POSE_CALIBRATION_ORDER[calibrationStep].label.emoji}
                  </div>
                  <div className="text-xl font-bold">
                    {POSE_CALIBRATION_ORDER[calibrationStep].label.zh}
                  </div>
                </div>
                {pose.landmarks && (
                  <div className="bg-slate-900 rounded-lg p-3 text-center mb-4">
                    <div className="text-xs text-slate-400">當前 score</div>
                    <div className="text-2xl font-mono text-amber-300">
                      {(
                        (classification?.scores[
                          POSE_CALIBRATION_ORDER[calibrationStep].key as 'hands_up'
                        ] ?? 0) * 100
                      ).toFixed(0)}
                      %
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-400 text-center mb-4">
                  慢慢做 3 秒動作,系統會收集數據建議 tolerance
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCalibrationNext}
                    className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-sm rounded-lg active:scale-95"
                  >
                    跳過
                  </button>
                  <button
                    type="button"
                    onClick={handleCalibrationNext}
                    className="flex-1 py-2 bg-amber-500 text-slate-900 text-sm font-bold rounded-lg active:scale-95"
                  >
                    {calibrationStep + 1 < POSE_CALIBRATION_ORDER.length
                      ? '下一個 →'
                      : '完成 ✓'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="text-5xl mb-3" aria-hidden="true">✅</div>
                <h2 className="text-lg font-bold text-amber-400 mb-2">校準完成</h2>
                <p className="text-sm text-slate-300 mb-4">建議 tolerance 已自動 save</p>
                <button
                  type="button"
                  onClick={handleCalibrationFinish}
                  className="w-full py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg active:scale-95"
                >
                  確認
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="px-4 py-3 text-center text-xs text-slate-500 border-t border-slate-700/50">
        🟡 中級模式 · MediaPipe Pose · 8 動作 classifier · tolerance {classifierTolerance.toFixed(1)} · 本地 0 上傳 🔒
      </footer>

      {/* Sprint 76 F1-B4c: 情緒週報 modal */}
      {journalOpen && activeProfileId && (
        <EmotionJournal profileId={activeProfileId} onClose={() => setJournalOpen(false)} />
      )}
    </div>
  )
}

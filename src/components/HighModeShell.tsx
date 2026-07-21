/**
 * HighModeShell — 進階模式 (🔴) 完整整合。
 *
 * Plan §12.4:跟 source 完整行為 + 擴 v1.0 emotion features。
 *
 * Phase 2 範圍:
 *  - DrawingCanvas 整合(4 層 canvas stack)
 *  - 4 個右欄 component(TemplatePicker / ColorPalette / BrushSize / SaveButton)
 *  - 鏡頭 optional(AAC 預設)
 *  - Mirror mode: Phase 1 設計唔用 CSS scaleX(-1), 改喺 event coord level
 *  - MediaPipe AI input: Phase 3 接入
 *  - 鏡頭 opacity slider + clear button
 *
 * Phase 2 範圍簡化:
 *  - 鏡頭 opacity slider 留 Phase 2 完整版
 *  - 「全部擦除」button 用 imperative ref
 *  - Rainbow mode 暫時省略 hue cycling(Phase 3 加)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { DrawingCanvas, DEFAULT_BRUSH, ERASER_BRUSH, type DrawingMode, type DrawingCanvasHandle } from './DrawingCanvas'
import { usePageVisibility } from '../hooks/usePageVisibility'
import { useHandTracker } from '../hooks/useHandTracker'
import { TemplatePicker } from './TemplatePicker'
import { ColorPalette } from './ColorPalette'
import { BrushSize } from './BrushSize'
import { SaveButton } from './SaveButton'
import { playClickSound, playClearSound, ensureAudioContext } from '../services/audio'
import { renderTemplate } from '../services/export'
import type { TemplateId } from '../services/templates'
import { useProfileStore } from '../store/profileStore'

interface HighModeShellProps {
  onExit: () => void
}

export function HighModeShell({ onExit }: HighModeShellProps): React.JSX.Element {
  // Refs for 4 layers
  const webcamRef = useRef<HTMLVideoElement | null>(null)
  const templateCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const virtualCursorRef = useRef<HTMLDivElement | null>(null)
  const drawingCanvasHandleRef = useRef<DrawingCanvasHandle | null>(null)

  // State
  const [template, setTemplate] = useState<TemplateId>('none')
  const [color, setColor] = useState<string>(DEFAULT_BRUSH.color)
  const [size, setSize] = useState<number>(DEFAULT_BRUSH.size)
  const [isRainbow, setIsRainbow] = useState(false)
  const [isEraser, setIsEraser] = useState(false)
  const [showWebcam, setShowWebcam] = useState(false) // AAC default off
  const [webcamOpacity, setWebcamOpacity] = useState(40)
  // v3.0.8.7: 空中魔法筆 toggle — 開鏡頭 + finger detection 基礎上
  // 用戶主動切換 finger-cam mode, 食指 hover 自動 draw
  const [fingerCamMode, setFingerCamMode] = useState(false)

  // v3.0.8.4: Bug 1 - High mode 從未 wire up useHandTracker
  // Plan §12.4 spec 寫 high mode 支援 finger-cam mode, 但 ship 時冇實裝
  // 最低 fix: 引入 useHandTracker + show finger cursor overlay (無自動 draw)
  // 自動 draw (externalPointer → DrawingCanvas) 留 S1 Batch 3
  const isVisible = usePageVisibility()
  const suspended = !isVisible
  const handTrackingActive = showWebcam && !suspended
  const hand = useHandTracker({
    video: webcamRef.current,
    active: handTrackingActive,
  })

  // Profile
  const profile = useProfileStore((s) =>
    s.profiles.find((p) => p.id === s.activeProfileId),
  )

  // Compute current brush
  const brush = isEraser
    ? { ...ERASER_BRUSH, size }
    : isRainbow
      ? { color: `hsl(${Date.now() % 360}, 90%, 60%)`, size, composite: 'source-over' as const }
      : { color, size, composite: 'source-over' as const }

  // v3.0.8.7: fingerCamMode 優先 — 開空中畫筆時, mode 變 'finger-cam' (覆蓋其他 mode)
  const mode: DrawingMode = fingerCamMode
    ? 'finger-cam'
    : isEraser
      ? 'eraser'
      : isRainbow
        ? 'rainbow'
        : 'pen'

  // v3.0.8.7: externalPointer 從 webcam 食指 normalized coord (0-1) 換算落 canvas 座標
  // fingerCamMode 開 + webcam 啟動 + hand.isReady → pass finger tip (Point 0-1)
  // DrawingCanvas 內 mode === 'finger-cam' 觸發 handleDrawMove
  // mirror flag 已由 webcam video element 嘅 scaleX(-1) handle (視覺 = canvas 一致)
  // 直接 normalized * canvas 640x480 即可
  const externalPointer = (fingerCamMode && hand.isReady && hand.indexFingerTip)
    ? { x: hand.indexFingerTip.x * 640, y: hand.indexFingerTip.y * 480 }
    : null

  // v3.0.8.7: 自動關閉 finger-cam 當 webcam 關
  // 用戶關鏡頭 → fingerCamMode 自動 false (避免 stale mode)
  useEffect(() => {
    if (!showWebcam && fingerCamMode) {
      setFingerCamMode(false)
    }
  }, [showWebcam, fingerCamMode])

  // Render template when changed
  useEffect(() => {
    if (templateCanvasRef.current) {
      renderTemplate(templateCanvasRef.current, template)
    }
  }, [template])

  // Render initial template
  useEffect(() => {
    if (templateCanvasRef.current) {
      renderTemplate(templateCanvasRef.current, template)
    }
  }, [template]) // initial run

  // Handlers
  const handleTemplate = useCallback(
    (id: TemplateId) => {
      playClickSound()
      setTemplate(id)
    },
    [],
  )

  const handleColor = useCallback((c: string) => {
    playClickSound()
    setColor(c)
    setIsRainbow(false)
    setIsEraser(false)
  }, [])

  const handleRainbow = useCallback(() => {
    playClickSound()
    setIsRainbow(true)
    setIsEraser(false)
  }, [])

  const handleEraser = useCallback(() => {
    playClickSound()
    setIsRainbow(false)
    setIsEraser(true)
  }, [])

  const handleBrushSize = useCallback((s: number) => {
    playClickSound()
    setSize(s)
  }, [])

  const handleClear = useCallback(() => {
    playClearSound()
    drawingCanvasHandleRef.current?.clear()
  }, [])

  // v3.0.8.7.1: fingerCamMode toggle callback — 連 click sound + log 助 debug
  const handleFingerCamToggle = useCallback(() => {
    setFingerCamMode((v) => {
      const next = !v
      // eslint-disable-next-line no-console
      console.log('[HighMode] finger-cam toggle', { from: v, to: next, handReady: hand.isReady })
      if (next) playClickSound()
      return next
    })
  }, [hand.isReady])

  // v3.0.8.5: webcamError state (之前 silently 失敗, user 唔知點解)
  const [webcamError, setWebcamError] = useState<string | null>(null)

  // v3.0.8.6 fix: 將 ensureAudioContext 個 await 移出 click handler
  // 之前 await 喺 callback 入口 hang React 19 event delegation (CDP probe 確認)
  // 改用 sync outer + async IIFE — click handler 即時 resolve, getUserMedia 立即 fire
  // audio init 改 fire-and-forget (不阻擋鏡頭 flow)
  const handleWebcamToggle = useCallback(() => {
    // Fire-and-forget audio init, 唔 block 同步 path
    setTimeout(() => {
      ensureAudioContext().catch(() => { /* ignore */ })
    }, 0)
    if (!showWebcam) {
      void (async () => {
        try {
          setWebcamError(null)
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
      })()
    } else {
      if (webcamRef.current?.srcObject) {
        const tracks = (webcamRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach((t) => t.stop())
        webcamRef.current.srcObject = null
      }
      setShowWebcam(false)
    }
  }, [showWebcam])

  // Cleanup webcam on unmount (BUG 1 fix)
  useEffect(() => {
    return () => {
      if (webcamRef.current?.srcObject) {
        const tracks = (webcamRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach((t) => t.stop())
      }
    }
  }, [])

  // R14 緩解: PWA background 時 suspend webcam,resume re-init
  // isVisible / suspended 已喺 line 58-59 定義 (配合 useHandTracker)
  useEffect(() => {
    if (isVisible || !showWebcam) return
    // Background: 停 webcam 釋放 hardware
    if (webcamRef.current?.srcObject) {
      const tracks = (webcamRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach((t) => t.stop())
      webcamRef.current.srcObject = null
    }
  }, [isVisible, showWebcam])

  useEffect(() => {
    // Resume: 如果 webcam 之前開住, 自動 re-init
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
          // BUG 10: 失敗關閉
          setShowWebcam(false)
        }
      })()
    }
  }, [isVisible, showWebcam])

  return (
    <div className="min-h-dvh flex flex-col bg-slate-900 text-white">
      <header className="bg-slate-800 border-b border-slate-700 p-3 shadow-lg flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔴</span>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-wide text-rose-400">
              進階模式
            </h1>
            <p className="text-xs text-slate-400">
              {profile ? `👤 ${profile.name}` : '👤 未選擇學生'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleWebcamToggle}
            aria-pressed={showWebcam}
            className={`
              px-3 py-1.5 rounded-full text-xs font-semibold border transition active:scale-95
              ${showWebcam
                ? 'bg-green-500/20 border-green-500/50 text-green-300'
                : 'bg-slate-900/60 border-slate-700/50 text-slate-300'
              }
            `}
          >
            {showWebcam ? '🟢 鏡頭 ON' : '🔴 鏡頭 OFF'}
          </button>
          {webcamError && (
            <span className="text-xs text-rose-400" role="alert">
              ⚠️ {webcamError}
            </span>
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

      <main className="flex-1 flex flex-col lg:flex-row p-3 sm:p-4 gap-3 sm:gap-4 max-w-7xl mx-auto w-full">
        {/* Left: canvas stack */}
        <div className="flex-1 flex flex-col items-center">
          <DrawingCanvas
            webcamRef={webcamRef}
            templateCanvasRef={templateCanvasRef}
            drawingCanvasRef={drawingCanvasRef}
            virtualCursorRef={virtualCursorRef}
            brush={brush}
            mode={mode}
            externalPointer={externalPointer}
            showWebcam={showWebcam}
            webcamOpacity={webcamOpacity}
            // v3.0.8.2: 對齊 source v1.0 mirror=true
            // 鏡頭顯示 + 學生用手指喺鏡頭前面畫, 必須 mirror 否則 user 見倒置
            mirror={true}
            imperativeRef={drawingCanvasHandleRef}
          />

          {/* v3.0.8.4: Hand detection status + finger cursor overlay
              喺 DrawingCanvas 之下, stage 之外。
              顯示 finger cursor 喺 mon position (fixed, 全 screen),
              mirror flip 同 useFingerHoverOnElement 一致 (1 - tipX).
              pointer-events-none 唔阻擋下層 click / pointer event
              v3.0.8.7.1: 加 finger-cam toggle UX hint — finger ready 但未開 toggle
              顯示 affordance「按 ✏️ 開啟空中魔法筆」,否則 user 有 detection 但唔知點 draw */}
          {showWebcam && (
            <div className="mt-2 text-xs text-slate-500 flex flex-col gap-1" aria-live="polite">
              <p>
                {hand.error
                  ? `⚠️ 手指偵測錯誤: ${hand.error}`
                  : hand.isReady
                    ? '🖐️ 手指偵測就緒 — 鏡頭前舉起食指, 見到 👆 跟住你'
                    : '⌛ 手指偵測啟動中…(首次需下載 MediaPipe model, 約 5-10 秒)'}
              </p>
              {hand.isReady && !fingerCamMode && (
                <p className="text-amber-300 font-semibold">
                  👉 按右側「✏️ 開啟空中魔法筆」即可用食指空中畫畫
                </p>
              )}
              {fingerCamMode && (
                <p className="text-amber-300 font-semibold">
                  ✨ 空中魔法筆啟動中 — 食指移動自動畫畫, 再按 ✋ 關閉即可用滑鼠
                </p>
              )}
            </div>
          )}
          {hand.isReady && hand.indexFingerTip && showWebcam && webcamRef.current && (() => {
            const v = webcamRef.current
            const rect = v.getBoundingClientRect()
            const screenX = (1 - hand.indexFingerTip.x) * rect.width + rect.left
            const screenY = hand.indexFingerTip.y * rect.height + rect.top
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
                  <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-xl" />
                  <div className="absolute inset-0 rounded-full bg-amber-400/50 animate-ping" />
                  <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 border-[3px] border-white shadow-2xl flex items-center justify-center">
                    <span className="text-lg leading-none">👆</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Webcam opacity + clear controls */}
          <div className="w-full max-w-[640px] mt-3 flex justify-between items-center bg-slate-800/80 p-3 rounded-xl border border-slate-700/50 text-sm">
            <div className="flex items-center gap-2">
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
              <span className="text-xs font-mono text-slate-300">{webcamOpacity}%</span>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-1.5 bg-rose-600/90 hover:bg-rose-500 text-white font-bold rounded-lg transition-colors active:scale-95 shadow-md"
            >
              🗑️ 全部擦除
            </button>
          </div>
        </div>

        {/* Right: control panel */}
        <div className="w-full lg:w-80 flex flex-col gap-3 sm:gap-4">
          {/* v3.0.8.7 + v3.0.8.7.1: 空中魔法筆 toggle (finger-cam mode)
              開鏡頭後, 此按鈕才 work. 開啟後, 食指 hover 自動 draw
              v3.0.8.7.1: 用 handleFingerCamToggle callback 連 click sound + log */}
          <button
            type="button"
            onClick={handleFingerCamToggle}
            disabled={!showWebcam || !hand.isReady}
            aria-pressed={fingerCamMode}
            title={!showWebcam
              ? '請先開鏡頭'
              : !hand.isReady
                ? '手指偵測未就緒'
                : fingerCamMode
                  ? '關閉空中魔法筆, 改用滑鼠'
                  : '開啟空中魔法筆, 食指自動畫圖'}
            className={`
              w-full px-4 py-3 rounded-xl text-sm font-bold transition active:scale-95 shadow-md
              ${fingerCamMode
                ? 'bg-amber-500 text-slate-900 ring-2 ring-amber-300 animate-pulse'
                : 'bg-slate-800/80 text-slate-300 border border-slate-700/50 hover:bg-slate-700/80'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {fingerCamMode ? '✋ 關閉空中魔法筆' : '✏️ 開啟空中魔法筆'}
          </button>
          <TemplatePicker current={template} onPick={handleTemplate} />
          <ColorPalette
            current={color}
            isRainbow={isRainbow}
            isEraser={isEraser}
            onColor={handleColor}
            onRainbow={handleRainbow}
            onEraser={handleEraser}
          />
          <BrushSize current={size} onPick={handleBrushSize} />
          <SaveButton
            templateCanvas={templateCanvasRef.current}
            drawingCanvas={drawingCanvasRef.current}
            profileName={profile?.name}
          />
        </div>
      </main>

      <footer className="bg-slate-950 p-3 text-center text-xs text-slate-500 border-t border-slate-900 mt-auto">
        本應用程式完全在本機端運行, 不儲存 / 不傳輸任何視訊影像, 確保學生私隱安全 🔒
      </footer>
    </div>
  )
}

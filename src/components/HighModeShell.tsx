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
import { DrawingCanvas, DEFAULT_BRUSH, ERASER_BRUSH, type DrawingMode } from './DrawingCanvas'
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

  // State
  const [template, setTemplate] = useState<TemplateId>('none')
  const [color, setColor] = useState<string>(DEFAULT_BRUSH.color)
  const [size, setSize] = useState<number>(DEFAULT_BRUSH.size)
  const [isRainbow, setIsRainbow] = useState(false)
  const [isEraser, setIsEraser] = useState(false)
  const [showWebcam, setShowWebcam] = useState(false) // AAC default off
  const [webcamOpacity, setWebcamOpacity] = useState(40)

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

  const mode: DrawingMode = isEraser ? 'eraser' : isRainbow ? 'rainbow' : 'pen'

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
    const w = window as Window & { __drawingCanvasClear?: () => void }
    w.__drawingCanvasClear?.()
  }, [])

  const handleWebcamToggle = useCallback(async () => {
    await ensureAudioContext()
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
      } catch {
        // BUG 10:showLoadError pattern
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

  // Cleanup webcam on unmount (BUG 1 fix)
  useEffect(() => {
    return () => {
      if (webcamRef.current?.srcObject) {
        const tracks = (webcamRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach((t) => t.stop())
      }
    }
  }, [])

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
            externalPointer={null}
            showWebcam={showWebcam}
            webcamOpacity={webcamOpacity}
            mirror={false}
          />

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

/**
 * DrawingCanvas — 4 層 canvas stack + virtual cursor。
 *
 * 對應 source §7-§8(原本 single canvas + 4 個 ref 變數)。
 * Refactor 重點:
 *   - 4 層(canvas 結構)分開:webcam / template / drawing / virtual cursor
 *   - imperative canvas 邏輯喺 useEffect 入面
 *   - 3 種 input source 統一(mouse / touch / cam-MediaPipe)
 *   - 鏡像處理喺 event coord level(Phase 1 design: 唔用 CSS scaleX(-1))
 *
 * 對應 plan §3 store 邊界:zustand 管 UI state,canvas 維持 imperative + ref。
 */

import { useEffect, useRef, useCallback } from 'react'
import type { Point } from '../services/canvas'
import {
  DEFAULT_BRUSH,
  ERASER_BRUSH,
  clearCanvas,
  drawSegment,
  initCanvasContext,
  smoothPoint,
  toCanvasCoords,
  type BrushState,
} from '../services/canvas'

export type DrawingMode = 'pen' | 'rainbow' | 'eraser' | 'finger-cam' | 'pose-cam'

interface DrawingCanvasProps {
  /** webcam element ref(由 parent 提供) */
  webcamRef: React.RefObject<HTMLVideoElement | null>
  /** template canvas ref(由 parent 提供) */
  templateCanvasRef: React.RefObject<HTMLCanvasElement | null>
  /** drawing canvas ref(由 parent 提供) */
  drawingCanvasRef: React.RefObject<HTMLCanvasElement | null>
  /** virtual cursor div ref(由 parent 提供) */
  virtualCursorRef: React.RefObject<HTMLDivElement | null>
  /** active brush */
  brush: BrushState
  /** current mode */
  mode: DrawingMode
  /** external pointer position(e.g. MediaPipe AI finger) — null = 唔用 */
  externalPointer: Point | null
  /** 顯示 webcam 與否 */
  showWebcam: boolean
  /** webcam opacity 0-100 */
  webcamOpacity: number
  /** 鏡像 x 軸(refactor 唔用 CSS mirror,改喺 event coord level) */
  mirror: boolean
  /** onError callback(for BUG 10 showLoadError pattern) */
  onError?: (msg: string) => void
}

const CANVAS_W = 640
const CANVAS_H = 480

export function DrawingCanvas({
  webcamRef,
  templateCanvasRef,
  drawingCanvasRef,
  virtualCursorRef,
  brush,
  mode,
  externalPointer,
  showWebcam,
  webcamOpacity,
  mirror,
  onError: _onError,
}: DrawingCanvasProps): React.JSX.Element {
  // Internal state for last point
  const lastPointRef = useRef<Point | null>(null)
  const isDrawingRef = useRef(false)

  // Get drawing context on mount
  useEffect(() => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    initCanvasContext(ctx, brush)
  }, [drawingCanvasRef, brush])

  // Update context when brush changes
  useEffect(() => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = brush.color
    ctx.lineWidth = brush.size
    ctx.globalCompositeOperation = brush.composite
  }, [brush])

  // Core draw move
  const handleDrawMove = useCallback(
    (p: Point) => {
      const canvas = drawingCanvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      if (!isDrawingRef.current) {
        // First point — start stroke
        lastPointRef.current = p
        isDrawingRef.current = true
        return
      }
      const prev = lastPointRef.current!
      const smoothed = smoothPoint(prev, p, 0.6)
      drawSegment(ctx, prev, smoothed, brush)
      lastPointRef.current = smoothed
    },
    [drawingCanvasRef, brush],
  )

  // External pointer (MediaPipe AI finger / Pose) — handle in effect
  useEffect(() => {
    if (!externalPointer) return
    // For AI input, only draw when mode is finger-cam or pose-cam
    if (mode !== 'finger-cam' && mode !== 'pose-cam') return
    handleDrawMove(externalPointer)
  }, [externalPointer, mode, handleDrawMove])

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = drawingCanvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const p = toCanvasCoords(e.clientX, e.clientY, rect, CANVAS_W, CANVAS_H, mirror)
      lastPointRef.current = p
      isDrawingRef.current = true
    },
    [drawingCanvasRef, mirror],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return
      const canvas = drawingCanvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const p = toCanvasCoords(e.clientX, e.clientY, rect, CANVAS_W, CANVAS_H, mirror)
      handleDrawMove(p)
    },
    [drawingCanvasRef, mirror, handleDrawMove],
  )

  const handleMouseUp = useCallback(() => {
    isDrawingRef.current = false
    lastPointRef.current = null
  }, [])

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const canvas = drawingCanvasRef.current
      if (!canvas || e.touches.length === 0) return
      const rect = canvas.getBoundingClientRect()
      const p = toCanvasCoords(e.touches[0].clientX, e.touches[0].clientY, rect, CANVAS_W, CANVAS_H, mirror)
      lastPointRef.current = p
      isDrawingRef.current = true
    },
    [drawingCanvasRef, mirror],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      if (!isDrawingRef.current) return
      const canvas = drawingCanvasRef.current
      if (!canvas || e.touches.length === 0) return
      const rect = canvas.getBoundingClientRect()
      const p = toCanvasCoords(e.touches[0].clientX, e.touches[0].clientY, rect, CANVAS_W, CANVAS_H, mirror)
      handleDrawMove(p)
    },
    [drawingCanvasRef, mirror, handleDrawMove],
  )

  const handleTouchEnd = useCallback(() => {
    isDrawingRef.current = false
    lastPointRef.current = null
  }, [])

  // Clear canvas
  const handleClear = useCallback(() => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    clearCanvas(ctx, CANVAS_W, CANVAS_H)
  }, [drawingCanvasRef])

  // Expose clear via window for external button (Phase 3 refactor → imperative ref)
  useEffect(() => {
    const w = window as Window & { __drawingCanvasClear?: () => void }
    w.__drawingCanvasClear = handleClear
    return () => {
      delete w.__drawingCanvasClear
    }
  }, [handleClear])

  return (
    <div className="relative w-full max-w-[640px] aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-700/80">
      {/* 1. Webcam (bottom layer) */}
      <video
        ref={webcamRef}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
        style={{ opacity: showWebcam ? webcamOpacity / 100 : 0 }}
        autoPlay
        playsInline
        muted
      />

      {/* 2. Template layer (middle) */}
      <canvas
        ref={templateCanvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        width={CANVAS_W}
        height={CANVAS_H}
      />

      {/* 3. Drawing canvas (top) */}
      <canvas
        ref={drawingCanvasRef}
        className="absolute inset-0 w-full h-full object-cover cursor-crosshair touch-none"
        width={CANVAS_W}
        height={CANVAS_H}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* 4. Virtual cursor (for AI mode, controlled externally) */}
      <div
        ref={virtualCursorRef}
        className="absolute w-6 h-6 border-2 border-white bg-amber-400/80 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-lg hidden"
      />
    </div>
  )
}

/** Default brush for rainbow mode (cycles hue) */
export const RAINBOW_BRUSH_FACTORY = (initialHue: number = 0): BrushState => ({
  color: `hsl(${initialHue}, 90%, 60%)`,
  size: 10,
  composite: 'source-over',
})

export { DEFAULT_BRUSH, ERASER_BRUSH }

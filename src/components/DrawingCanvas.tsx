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

import { useEffect, useRef, useCallback, useImperativeHandle } from 'react'
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

/**
 * Imperative handle exposed via forwardRef / useImperativeHandle.
 * Parent can call `clear()` without polluting window globals.
 */
export interface DrawingCanvasHandle {
  clear: () => void
}

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
  imperativeRef,
}: DrawingCanvasProps & { imperativeRef?: React.Ref<DrawingCanvasHandle> }): React.JSX.Element {
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
  // v3.0.8.7 + v3.0.8.7.1: AI pointer 走自己邏輯 (唔通過 handleDrawMove)
  // 對 AI 嚟講, 每個 frame 都係 stroke continuation:
  //   1. 第一次 frame: draw 起點 dot (避免 first-point silent return) + set lastPointRef = p
  //   2. 後續 frame: draw segment (用 smoothed point)
  //
  // v3.0.8.7.1 fix: 第一個 frame 唔可以 silent return, 否則 user 見 cursor 但畫唔到
  //   (Mirror flip 唔需要: webcam video element 已經 scaleX(-1), AI finger tip normalized
  //    已經喺 mirror 後嘅 coord system, 0-1 直接 * 640/480 即可)
  useEffect(() => {
    if (mode !== 'finger-cam' && mode !== 'pose-cam') return
    if (!externalPointer) {
      // v3.0.8.7.1: 當 external pointer 走甩 (mode off / hand lost), reset state
      // 避免 stale lastPointRef 喺 mouse draw 時突然連過去
      lastPointRef.current = null
      isDrawingRef.current = false
      return
    }
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const prev = lastPointRef.current
    if (!prev) {
      // 第一次 frame: 起始 stroke + 落起點 dot
      // 起點 dot 半徑 = brush.size/2 (lineCap round 已自動 round, 但 drawSegment
      // 只 draw line segment, 起點用 lineCap round 都會 round 末端但唔會有 dot 起點)
      // 解決: explicit 落 circle 喺起點
      ctx.save()
      ctx.fillStyle = brush.color
      ctx.beginPath()
      ctx.arc(externalPointer.x, externalPointer.y, brush.size / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      lastPointRef.current = externalPointer
      isDrawingRef.current = true
      return
    }
    // 後續 frame: draw segment
    const smoothed = smoothPoint(prev, externalPointer, 0.6)
    drawSegment(ctx, prev, smoothed, brush)
    lastPointRef.current = smoothed
  }, [externalPointer, mode, brush])

  // v3.0.8.2: PointerEvent 統一 handler (iPad + Mac + touch screen 全部)
  // React 19 對 PointerEvent 完整支援, 取代舊 mouse + touch 兩套 handler
  // 避免 desktop Chrome + iPad 雙重 fire 同一個 event
  // v3.0.8.7.1 fix: finger-cam / pose-cam mode 期間, pointer event 唔可以 fire
  // 避免 mouse click + finger 同時 drive 同一個 isDrawingRef/lastPointRef
  // 導致 stale state cross-pollute (line 跳到 mouse 位置)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // pointerType = 'pen' | 'touch' | 'mouse' — 全部統一處理
      // 不 preventDefault mouse 行為, 保留 scroll/zoom
      if (e.pointerType === 'mouse' && e.button !== 0) return
      // v3.0.8.7.1: AI 模式期間 block pointer event (mouse 唔可以同時 draw)
      if (mode === 'finger-cam' || mode === 'pose-cam') {
        // eslint-disable-next-line no-console
        console.log('[DrawingCanvas] pointerDown blocked (AI mode active)', { mode })
        return
      }
      const canvas = drawingCanvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const p = toCanvasCoords(e.clientX, e.clientY, rect, CANVAS_W, CANVAS_H, mirror)
      lastPointRef.current = p
      isDrawingRef.current = true
      // eslint-disable-next-line no-console
      console.log('[DrawingCanvas] pointerDown', { type: e.pointerType, button: e.button, p })
    },
    [drawingCanvasRef, mirror, mode],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return
      // v3.0.8.7.1: AI 模式期間 block pointer move
      if (mode === 'finger-cam' || mode === 'pose-cam') return
      const canvas = drawingCanvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const p = toCanvasCoords(e.clientX, e.clientY, rect, CANVAS_W, CANVAS_H, mirror)
      handleDrawMove(p)
    },
    [drawingCanvasRef, mirror, handleDrawMove, mode],
  )

  const handlePointerUp = useCallback(() => {
    if (isDrawingRef.current) {
      // eslint-disable-next-line no-console
      console.log('[DrawingCanvas] pointerUp (stroke ended)')
    }
    isDrawingRef.current = false
    lastPointRef.current = null
  }, [])

  // v3.0.8.2 fix: 防止 touch event 同 pointer event 重複 fire
  // 預設 browser 同時 fire touch + pointer, 我哋 disable touch-to-pointer 轉譯避免 double draw
  // touchAction: 'none' (CSS) 設喺 canvas 已經 disable browser scroll/zoom
  // touchAction 已設喺 'touch-none' 喺 className, 等於 none, browser 唔 fire mouse
  // 但仍 fire pointer + touch, 我哋揀 pointer event 統一處理

  // Clear canvas
  const handleClear = useCallback(() => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    clearCanvas(ctx, CANVAS_W, CANVAS_H)
  }, [drawingCanvasRef])

  // Expose imperative handle for parent (Phase 2 batch 2 fix: remove window pollution)
  useImperativeHandle(
    imperativeRef,
    () => ({
      clear: handleClear,
    }),
    [handleClear],
  )

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

      {/* 3. Drawing canvas (top)
          v3.0.8.2: PointerEvent 統一 mouse + touch + pen input
          移除 mouse / touch handler, 避免 desktop Chrome + iPad double-fire
          React 19 PointerEvent 兼容所有 device
      */}
      <canvas
        ref={drawingCanvasRef}
        className="absolute inset-0 w-full h-full object-cover cursor-crosshair touch-none"
        width={CANVAS_W}
        height={CANVAS_H}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
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

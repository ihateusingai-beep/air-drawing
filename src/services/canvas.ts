/**
 * Canvas 2D 畫圖核心邏輯 — 純函數。
 *
 * 拆自 source §7+§8 (smoothed pointer tracking + MediaPipe AI 觸發)。
 * 抽到 pure function,測試時 mock Canvas 2D context 即可。
 *
 * 注意:Source 入面個 `getRelativeCoords` 處理 mirror CSS scaleX(-1) 嘅 X 反轉,
 * 喺 React 化後我哋直接由 event coord 計算,不再 wrap canvas API.
 *
 * Smoothing: 0.4 / 0.6 加權 (source 原本設計)
 */

export interface Point {
  x: number
  y: number
}

export interface BrushState {
  color: string
  size: number
  /** 'source-over' | 'destination-out'(eraser) */
  composite: GlobalCompositeOperation
}

export const DEFAULT_BRUSH: BrushState = {
  color: '#EF4444',
  size: 10,
  composite: 'source-over',
}

export const ERASER_BRUSH: BrushState = {
  color: '#000000',
  size: 20,
  composite: 'destination-out',
}

/**
 * 平滑兩個 point。Source 原本用 0.4 + 0.6 加權。
 */
export function smoothPoint(prev: Point, next: Point, alpha: number = 0.6): Point {
  return {
    x: prev.x * (1 - alpha) + next.x * alpha,
    y: prev.y * (1 - alpha) + next.y * alpha,
  }
}

/**
 * 在 canvas 上畫一段 line(由 prev 到 next)。
 * 用 lineCap = 'round' + lineJoin = 'round' 確保接駁位順。
 */
export function drawSegment(
  ctx: CanvasRenderingContext2D,
  prev: Point,
  next: Point,
  brush: BrushState,
): void {
  ctx.save()
  ctx.globalCompositeOperation = brush.composite
  ctx.strokeStyle = brush.color
  ctx.lineWidth = brush.size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(prev.x, prev.y)
  ctx.lineTo(next.x, next.y)
  ctx.stroke()
  ctx.restore()
}

/**
 * 計算相對於 canvas 內部座標 (0..width, 0..height)。
 * 接受 client 座標 (event.clientX/Y) + canvas getBoundingClientRect。
 *
 * 如果 canvas 喺 CSS 入面有 scaleX(-1) (mirror mode),需要傳 mirror=true
 * 自動反轉 X 軸,模擬 source 嘅 `getRelativeCoords` 邏輯。
 */
export function toCanvasCoords(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  canvasWidth: number,
  canvasHeight: number,
  mirror: boolean = false,
): Point {
  const xRatio = (clientX - rect.left) / rect.width
  const yRatio = (clientY - rect.top) / rect.height
  const x = mirror ? canvasWidth * (1 - xRatio) : canvasWidth * xRatio
  const y = canvasHeight * yRatio
  return { x, y }
}

/**
 * 清空 canvas。
 */
export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height)
}

/**
 * 設定 canvas default state。
 */
export function initCanvasContext(ctx: CanvasRenderingContext2D, brush: BrushState): void {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = brush.color
  ctx.lineWidth = brush.size
}

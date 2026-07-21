/**
 * Export artwork — 合併 template + user drawing,鏡像 flip,toDataURL 觸發下載。
 *
 * 對應 source §6 `saveArtwork` refactor。
 *
 * R2 緩解:export 時 user drawing 鏡像反轉(因為 source CSS scaleX(-1) 令 user 睇到 mirror,
 * 但實際 canvas 內部 coord 已經係 mirror 過)。Refactor 後鏡像處理喺 event coord level
 * (canvas.ts `toCanvasCoords` 用 mirror flag),所以 export 唔需要再 flip — canvas 內部
 * 已經係 user 期望方向。Phase 1 嘅 mirror design 唔再用,改為 disable CSS mirror。
 *
 * 對應 plan R2 fix: 唔再需要 export flip 邏輯,統一 mirror flag 控制。
 *
 * Phase 2 簡化版:直接合併 user drawing + template,冇 flip。
 * Phase 3 可加 emotion metadata (R8 metadata persist)。
 */

import type { TemplateId } from './templates'
import { TEMPLATES_BY_ID } from './templates'

export interface ExportOptions {
  /** template canvas(template layer 渲染結果) */
  templateCanvas: HTMLCanvasElement
  /** user drawing canvas */
  drawingCanvas: HTMLCanvasElement
  /** background color hex, default slate-900 */
  backgroundColor?: string
  /** emotion label (Phase 3 metadata) */
  emotionLabel?: string
  /** emotion color hex (Phase 3 metadata) */
  emotionColor?: string
}

const DEFAULT_BG = '#0f172a' // slate-900

/**
 * 合併 canvases 並 return dataURL。
 */
export function exportArtworkToDataURL(options: ExportOptions): string {
  const {
    templateCanvas,
    drawingCanvas,
    backgroundColor = DEFAULT_BG,
  } = options

  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = drawingCanvas.width
  exportCanvas.height = drawingCanvas.height
  const ctx = exportCanvas.getContext('2d')
  if (!ctx) {
    throw new Error('exportArtwork: cannot get 2d context')
  }

  // 1. Background
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)

  // 2. Template layer
  ctx.drawImage(templateCanvas, 0, 0)

  // 3. User drawing layer
  // Phase 1 refactor: 因為 user drawing 已經喺 event coord 層處理 mirror,
  // canvas 內部 user drawing = user 視覺上期望嘅方向(唔需要再 flip)。
  ctx.drawImage(drawingCanvas, 0, 0)

  return exportCanvas.toDataURL('image/png')
}

/**
 * 觸發瀏覽器下載 dataURL 為 file。
 */
export function downloadDataURL(dataURL: string, filename: string): void {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataURL
  link.click()
}

/**
 * High-level: export + download。
 * Returns filename used(方便 caller log)。
 */
export function saveArtwork(options: ExportOptions, profileName?: string): string {
  const dataURL = exportArtworkToDataURL(options)
  const ts = new Date().toISOString().slice(0, 10)
  const prefix = profileName ? `artwork-${profileName}` : 'artwork'
  const filename = `${prefix}-${ts}.png`
  downloadDataURL(dataURL, filename)
  return filename
}

/**
 * Render template 到 hidden canvas(供 template layer 用)。
 */
export function renderTemplate(canvas: HTMLCanvasElement, templateId: TemplateId): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const def = TEMPLATES_BY_ID[templateId]
  if (!def) return
  def.render(ctx)
}

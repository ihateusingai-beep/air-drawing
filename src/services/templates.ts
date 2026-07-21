/**
 * 描紅模板數據 — source §5 抽出。
 *
 * 4 種 template: 'none' / 'circle' / 'triangle' / 'square' / 'num1'(123)
 * v1.0 pivot 後可擴:中文(對標華文教育 niche,PLAN §11 E4)
 * Phase 3 加: 'apple' / 'flower' / 'star' / 表達卡
 *
 * 設計 assumptions:
 *   - canvas 640×480(對齊 source 原始尺寸)
 *   - 模板以 stroke + fill text 渲染到 hidden canvas
 *   - 虛線風格(setLineDash)模仿描紅效果
 */

export type TemplateId = 'none' | 'circle' | 'triangle' | 'square' | 'num1'

export interface TemplateDef {
  id: TemplateId
  labelZh: string
  labelEn: string
  emoji: string
  /** Render function — 喺 hidden canvas 畫模板 */
  render: (ctx: CanvasRenderingContext2D) => void
}

const CANVAS_W = 640
const CANVAS_H = 480
const CX = CANVAS_W / 2
const CY = CANVAS_H / 2

function setLineStyle(ctx: CanvasRenderingContext2D): void {
  ctx.lineWidth = 6
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
  ctx.setLineDash([10, 10])
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.font = 'bold 36px sans-serif'
  ctx.textAlign = 'center'
}

const noopRender = (_ctx: CanvasRenderingContext2D): void => {
  /* no-op */
}

export const TEMPLATES: ReadonlyArray<TemplateDef> = [
  {
    id: 'none',
    labelZh: '自由畫畫',
    labelEn: 'Free draw',
    emoji: '✏️',
    render: noopRender,
  },
  {
    id: 'circle',
    labelZh: '圓形',
    labelEn: 'Circle',
    emoji: '🔵',
    render: (ctx) => {
      setLineStyle(ctx)
      ctx.beginPath()
      ctx.arc(CX, CY - 20, 140, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillText('🔴 圓形 Circle', CX, 60)
    },
  },
  {
    id: 'triangle',
    labelZh: '三角形',
    labelEn: 'Triangle',
    emoji: '🔺',
    render: (ctx) => {
      setLineStyle(ctx)
      ctx.beginPath()
      ctx.moveTo(CX, 80)
      ctx.lineTo(CX - 170, 360)
      ctx.lineTo(CX + 170, 360)
      ctx.closePath()
      ctx.stroke()
      ctx.fillText('🔺 三角形 Triangle', CX, 60)
    },
  },
  {
    id: 'square',
    labelZh: '正方形',
    labelEn: 'Square',
    emoji: '🟩',
    render: (ctx) => {
      setLineStyle(ctx)
      ctx.strokeRect(170, 80, 300, 300)
      ctx.fillText('🟩 正方形 Square', CX, 60)
    },
  },
  {
    id: 'num1',
    labelZh: '數字 1/2/3',
    labelEn: 'Numbers 1, 2, 3',
    emoji: '🔢',
    render: (ctx) => {
      ctx.font = 'bold 120px sans-serif'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
      ctx.textAlign = 'center'
      ctx.fillText('1', CX - 160, 240)
      ctx.fillText('2', CX, 240)
      ctx.fillText('3', CX + 160, 240)
      ctx.font = 'bold 24px sans-serif'
      ctx.fillText('練習寫寫看:數字 1、2、3', CX, 360)
    },
  },
]

export const TEMPLATES_BY_ID: Readonly<Record<TemplateId, TemplateDef>> = TEMPLATES.reduce(
  (acc, t) => {
    acc[t.id] = t
    return acc
  },
  {} as Record<TemplateId, TemplateDef>,
)

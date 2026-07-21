/**
 * canvas service — mirror flip + drawSegment (plan §11.3 + R2 fix)
 * Critical for High mode 嘅 stroke 同 export
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  drawSegment,
  toCanvasCoords,
  smoothPoint,
  clearCanvas,
  initCanvasContext,
  DEFAULT_BRUSH,
  ERASER_BRUSH,
} from '../services/canvas'

describe('canvas service', () => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D

  beforeEach(() => {
    canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  })

  describe('toCanvasCoords', () => {
    it('normal mode: client coord 直接 map 落 canvas', () => {
      // clientX=100, rect.left=0, rect.width=800 → xRatio=0.125
      // → canvas x = 800 * 0.125 = 100
      const result = toCanvasCoords(100, 200, { left: 0, top: 0, width: 800, height: 600 } as DOMRect, 800, 600, false)
      expect(result.x).toBe(100)
      expect(result.y).toBe(200)
    })

    it('mirror mode (R2 fix): client coord flip 落 canvas', () => {
      // clientX=100, canvas width=800 → xRatio=0.125
      // mirror → x = 800 * (1 - 0.125) = 700
      const result = toCanvasCoords(100, 200, { left: 0, top: 0, width: 800, height: 600 } as DOMRect, 800, 600, true)
      expect(result.x).toBe(700)
      expect(result.y).toBe(200)
    })

    it('rect.left offset 都 handle', () => {
      const result = toCanvasCoords(
        150,
        250,
        { left: 50, top: 50, width: 800, height: 600 } as DOMRect,
        800,
        600,
        false,
      )
      // (150 - 50) / 800 = 0.125 → x = 100
      expect(result.x).toBe(100)
      expect(result.y).toBe(200)
    })

    it('default mirror false', () => {
      const result = toCanvasCoords(100, 100, { left: 0, top: 0, width: 800, height: 600 } as DOMRect, 800, 600)
      expect(result.x).toBe(100)
    })
  })

  describe('drawSegment', () => {
    it('正常 stroke 唔 throw', () => {
      expect(() => drawSegment(ctx, { x: 100, y: 100 }, { x: 200, y: 200 }, DEFAULT_BRUSH)).not.toThrow()
    })

    it('eraser brush 設定 lineWidth = size', () => {
      drawSegment(ctx, { x: 0, y: 0 }, { x: 10, y: 10 }, ERASER_BRUSH)
      expect(ctx.lineWidth).toBe(ERASER_BRUSH.size)
    })

    it('stroke style 由 brush.color 設定', () => {
      const brush = { ...DEFAULT_BRUSH, color: '#ff00ff' }
      drawSegment(ctx, { x: 0, y: 0 }, { x: 10, y: 10 }, brush)
      expect(ctx.strokeStyle).toBe('#ff00ff')
    })

    it('eraser composite = destination-out', () => {
      drawSegment(ctx, { x: 0, y: 0 }, { x: 10, y: 10 }, ERASER_BRUSH)
      expect(ctx.globalCompositeOperation).toBe('destination-out')
    })
  })

  describe('smoothPoint', () => {
    it('alpha=0 唔 smooth (完全用 prev)', () => {
      const result = smoothPoint({ x: 0, y: 0 }, { x: 100, y: 100 }, 0)
      expect(result).toEqual({ x: 0, y: 0 })
    })

    it('alpha=1 完全用 next', () => {
      const result = smoothPoint({ x: 0, y: 0 }, { x: 100, y: 100 }, 1)
      expect(result).toEqual({ x: 100, y: 100 })
    })

    it('alpha=0.6 EMA 平滑: prev*(1-0.6) + next*0.6', () => {
      // 0.4 * 0 + 0.6 * 100 = 60
      const result = smoothPoint({ x: 0, y: 0 }, { x: 100, y: 100 }, 0.6)
      expect(result.x).toBe(60)
      expect(result.y).toBe(60)
    })

    it('default alpha = 0.6', () => {
      const result = smoothPoint({ x: 0, y: 0 }, { x: 100, y: 100 })
      expect(result.x).toBe(60)
    })
  })

  describe('clearCanvas + initCanvasContext', () => {
    it('clearCanvas 唔 throw', () => {
      expect(() => clearCanvas(ctx, 800, 600)).not.toThrow()
    })

    it('initCanvasContext 設定 default stroke style', () => {
      initCanvasContext(ctx, DEFAULT_BRUSH)
      expect(ctx.strokeStyle).toBe(DEFAULT_BRUSH.color)
      expect(ctx.lineWidth).toBe(DEFAULT_BRUSH.size)
    })
  })
})

/**
 * Vitest setup — jsdom 環境預備
 *
 * - jest-dom matchers (toBeInTheDocument 等)
 * - Web API mock (matchMedia, getUserMedia, SpeechSynthesis)
 * - R30 預設關 reduce-motion (大部分 test 唔 trigger animation)
 */

import '@testing-library/jest-dom/vitest'

// jsdom 冇 matchMedia
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// jsdom 冇 getUserMedia
if (typeof navigator !== 'undefined' && !navigator.mediaDevices) {
  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: () => Promise.reject(new Error('mocked: no camera in test')),
    },
  })
}

// jsdom/happy-dom 冇 SpeechSynthesis
if (typeof window !== 'undefined' && !window.speechSynthesis) {
  Object.defineProperty(window, 'speechSynthesis', {
    writable: true,
    value: {
      speaking: false,
      pending: false,
      cancel: () => {},
      speak: () => {},
      getVoices: () => [],
    },
  })
}

// happy-dom 冇 full Canvas 2D context — mock 一個夠用嘅 stub
// (我哋 test 主要 verify function call 唔 throw, 唔 verify pixel-level rendering)
const originalGetContext = HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextType: string): any {
  if (contextType === '2d') {
    const noop = (): void => {}
    return {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillRect: noop,
      clearRect: noop,
      strokeRect: noop,
      beginPath: noop,
      closePath: noop,
      moveTo: noop,
      lineTo: noop,
      bezierCurveTo: noop,
      quadraticCurveTo: noop,
      arc: noop,
      rect: noop,
      fill: noop,
      stroke: noop,
      clip: noop,
      save: noop,
      restore: noop,
      translate: noop,
      scale: noop,
      rotate: noop,
      setTransform: noop,
      transform: noop,
      resetTransform: noop,
      drawImage: noop,
      getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1, colorSpace: 'srgb' } as ImageData),
      putImageData: noop,
      createImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1, colorSpace: 'srgb' } as ImageData),
      measureText: () => ({ width: 0 } as TextMetrics),
      fillText: noop,
      strokeText: noop,
    }
  }
  return originalGetContext?.call(this, contextType) ?? null
} as typeof HTMLCanvasElement.prototype.getContext

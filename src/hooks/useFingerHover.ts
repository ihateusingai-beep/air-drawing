/**
 * F23: Finger dwell-click hook (PLAN §12.2).
 *
 * Phase 2 stub 升做完整實裝(Phase 2 Step 6.3)。
 *
 * 行為:
 *   - 接受 children render prop 或 chip array
 *   - MediaPipe Hands 偵測食指(landmark 8)位置
 *   - 每 frame 檢查指尖 vs DOM element 範圍(`getBoundingClientRect`)
 *   - 停留 dwellTimeMs = 500ms 觸發 onClick callback
 *   - iPad 自動 disable dwell(原生 touch click 已足)— R39 緩解
 *   - 視覺 affordance:progress ring 由 0% 填到 100% dwell 時間
 *   - 飄走(pointerleave / 飄出範圍)→ cancel + reset
 *   - Click 完成後 0.3s cooldown 防重複 trigger
 *
 * **Phase 2 範圍**: 純 client-side mouse + iPad 自動 disable
 * **Phase 3 範圍**: 接 MediaPipe Hands 食指 + cam 模式
 *
 * 用法:
 *   const { hoveredId, progress, getChipProps } = useDwellClick({
 *     dwellTimeMs: 500,
 *     onTrigger: (id) => speakEmotion(id),
 *   })
 *   <button {...getChipProps('joy')}>😊 開心</button>
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseDwellClickOptions {
  /** 觸發 click 所需停留時間(ms) — 預設 500,可調 0.3-1.0s */
  dwellTimeMs?: number
  /** Click 觸發時 callback */
  onTrigger?: (id: string) => void
  /** 完成 click 後 cooldown(ms)— 預設 300 */
  cooldownMs?: number
}

export interface ChipProps {
  onMouseEnter: () => void
  onMouseLeave: () => void
  onMouseDown: () => void
  onMouseUp: () => void
  onTouchStart: () => void
  onTouchEnd: () => void
  onClick: (e: React.MouseEvent | React.TouchEvent) => void
  'data-dwell-id'?: string
  'aria-pressed'?: boolean
}

export interface UseDwellClickResult {
  hoveredId: string | null
  /** 0-1 progress(填 ring 用) */
  progress: number
  /** 取得一個 chip 嘅 props(自動 bind 事件 + dwell logic) */
  getChipProps: (id: string) => ChipProps
  /** iPad 自動判斷,純 touch click 工作 */
  isIpad: boolean
}

function detectIpadTouchOnly(): boolean {
  if (typeof window === 'undefined') return false
  return (
    // iPad 喺 iPadOS 13+ 報 MacIntel + touch,user agent 仍寫 iPad
    /iPad/.test(navigator.userAgent) ||
    // iPadOS 13+ 報 Mac
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function useDwellClick(options: UseDwellClickOptions = {}): UseDwellClickResult {
  // v3.0.7.4: default dwell 由 500 → 1500ms, 配合 TTS 中文句子 1.5-2.5s 完整讀完
  // 原本 500ms 太快, TTS 句未讀完 mouse 移走又移返會再 trigger
  // User 仍然可經 profile.dwellTimeMs override
  const dwellTimeMs = options.dwellTimeMs ?? 1500
  const cooldownMs = options.cooldownMs ?? 1000
  const onTrigger = options.onTrigger

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [isIpad, setIsIpad] = useState(false)

  // Refs for animation loop + lastTrigger time
  const rafRef = useRef<number | null>(null)
  const startTsRef = useRef<number | null>(null)
  const lastTriggerRef = useRef<Record<string, number>>({})
  const hoveredIdRef = useRef<string | null>(null)

  // Detect iPad on mount
  useEffect(() => {
    setIsIpad(detectIpadTouchOnly())
  }, [])

  // Sync ref with state
  useEffect(() => {
    hoveredIdRef.current = hoveredId
  }, [hoveredId])

  // Dwell progress animation loop
  useEffect(() => {
    function tick(): void {
      if (hoveredIdRef.current && startTsRef.current !== null) {
        const elapsed = performance.now() - startTsRef.current
        const p = Math.min(1, elapsed / dwellTimeMs)
        setProgress(p)
        if (p >= 1) {
          // Trigger!
          const id = hoveredIdRef.current
          const now = performance.now()
          const last = lastTriggerRef.current[id] ?? 0
          if (now - last >= cooldownMs) {
            lastTriggerRef.current[id] = now
            onTrigger?.(id)
          }
          // Reset
          startTsRef.current = null
          setHoveredId(null)
          hoveredIdRef.current = null
          setProgress(0)
        } else {
          rafRef.current = requestAnimationFrame(tick)
        }
      } else {
        setProgress(0)
      }
    }
    if (hoveredId !== null && startTsRef.current !== null) {
      rafRef.current = requestAnimationFrame(tick)
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [hoveredId, dwellTimeMs, cooldownMs, onTrigger])

  const startHover = useCallback((id: string): void => {
    // iPad auto-disable dwell(R39): touch click 直接 trigger,唔做 hover dwell
    if (detectIpadTouchOnly()) return
    setHoveredId(id)
    startTsRef.current = performance.now()
  }, [])

  const endHover = useCallback((): void => {
    setHoveredId(null)
    startTsRef.current = null
    setProgress(0)
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const triggerImmediate = useCallback(
    (id: string, e: React.MouseEvent | React.TouchEvent): void => {
      e.preventDefault()
      const now = performance.now()
      const last = lastTriggerRef.current[id] ?? 0
      if (now - last < cooldownMs) return
      lastTriggerRef.current[id] = now
      onTrigger?.(id)
    },
    [cooldownMs, onTrigger],
  )

  const getChipProps = useCallback(
    (id: string): ChipProps => ({
      onMouseEnter: () => startHover(id),
      onMouseLeave: endHover,
      onMouseDown: () => startHover(id),
      onMouseUp: endHover,
      onTouchStart: () => {
        /* touch click handled by onClick */
      },
      onTouchEnd: () => {
        /* touch click handled by onClick */
      },
      onClick: (e) => triggerImmediate(id, e),
      'data-dwell-id': id,
      'aria-pressed': hoveredId === id,
    }),
    [startHover, endHover, triggerImmediate, hoveredId],
  )

  return {
    hoveredId,
    progress,
    getChipProps,
    isIpad,
  }
}

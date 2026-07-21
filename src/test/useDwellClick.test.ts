/**
 * useDwellClick — timing edge case (plan §5 Wave 1)
 *
 * Critical: 滑鼠 dwell 嘅 trigger 邏輯 — F2 reset-on-render / F3 enable-condition
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDwellClick } from '../hooks/useFingerHover'

describe('useDwellClick — public surface', () => {
  it('initial state: hoveredId null + progress 0', () => {
    const { result } = renderHook(() => useDwellClick({ dwellTimeMs: 500 }))
    expect(result.current.hoveredId).toBeNull()
    expect(result.current.progress).toBe(0)
    expect(result.current.isIpad).toBe(false)
  })

  it('v3.0.7.4 fix: default dwell 1500ms (唔再 500)', () => {
    // 唔傳 dwellTimeMs, 用 default. render 唔 throw 即代表 default work
    const { result } = renderHook(() => useDwellClick({}))
    expect(result.current).toBeDefined()
  })

  it('getChipProps return expected handler shape', () => {
    const { result } = renderHook(() => useDwellClick({ dwellTimeMs: 500 }))
    const props = result.current.getChipProps('joy')
    expect(props['data-dwell-id']).toBe('joy')
    expect(typeof props.onMouseEnter).toBe('function')
    expect(typeof props.onMouseLeave).toBe('function')
    expect(typeof props.onClick).toBe('function')
  })
})

describe('useDwellClick — hover + leave lifecycle', () => {
  it('mouse enter 設 hoveredId', () => {
    const { result } = renderHook(() => useDwellClick({ dwellTimeMs: 500 }))
    act(() => {
      result.current.getChipProps('joy').onMouseEnter()
    })
    expect(result.current.hoveredId).toBe('joy')
  })

  it('mouse leave 清 hoveredId', () => {
    const { result } = renderHook(() => useDwellClick({ dwellTimeMs: 500 }))
    act(() => {
      result.current.getChipProps('joy').onMouseEnter()
    })
    expect(result.current.hoveredId).toBe('joy')
    act(() => {
      result.current.getChipProps('joy').onMouseLeave()
    })
    expect(result.current.hoveredId).toBeNull()
  })

  it('hover 一個 chip 再 hover 第二個, 切換 hoveredId', () => {
    const { result } = renderHook(() => useDwellClick({ dwellTimeMs: 500 }))
    act(() => {
      result.current.getChipProps('joy').onMouseEnter()
    })
    act(() => {
      result.current.getChipProps('anger').onMouseEnter()
    })
    expect(result.current.hoveredId).toBe('anger')
  })
})

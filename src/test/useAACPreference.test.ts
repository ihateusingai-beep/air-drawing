/**
 * useAACPreference — localStorage 持久化 + 預設值
 *
 * v3.0.8 audit 期間加 (UX-3, E22 ship 缺口)
 * 冇 localStorage 預設 → false
 * 寫入錯誤 (e.g. quota) silent fallback
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAACPreference } from '../hooks/useAACPreference'

describe('useAACPreference', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('預設 false (冇 storage entry)', () => {
    const { result } = renderHook(() => useAACPreference())
    expect(result.current.aacMode).toBe(false)
  })

  it('從 localStorage 讀返 true', () => {
    localStorage.setItem('air-drawing:aac-mode', 'true')
    const { result } = renderHook(() => useAACPreference())
    expect(result.current.aacMode).toBe(true)
  })

  it('setAacMode(true) → 寫入 localStorage', () => {
    const { result } = renderHook(() => useAACPreference())
    act(() => {
      result.current.setAacMode(true)
    })
    expect(result.current.aacMode).toBe(true)
    expect(localStorage.getItem('air-drawing:aac-mode')).toBe('true')
  })

  it('setAacMode(false) → 寫 "false" 落 localStorage', () => {
    localStorage.setItem('air-drawing:aac-mode', 'true')
    const { result } = renderHook(() => useAACPreference())
    act(() => {
      result.current.setAacMode(false)
    })
    expect(localStorage.getItem('air-drawing:aac-mode')).toBe('false')
  })

  it('toggleAacMode flip 兩次 = 返 original', () => {
    const { result } = renderHook(() => useAACPreference())
    const initial = result.current.aacMode
    act(() => result.current.toggleAacMode())
    expect(result.current.aacMode).toBe(!initial)
    act(() => result.current.toggleAacMode())
    expect(result.current.aacMode).toBe(initial)
  })

  it('localStorage 損壞(非 boolean 字串)→ fallback false', () => {
    localStorage.setItem('air-drawing:aac-mode', 'not-a-boolean')
    const { result } = renderHook(() => useAACPreference())
    expect(result.current.aacMode).toBe(false)
  })
})

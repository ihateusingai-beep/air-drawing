/**
 * useEmotionLog hook tests (Sprint 76 F1 Batch 3)
 *
 * Memory rule 10: session-scoped idempotency guard
 * - 5s window per (profileId, emotionId, source) 防止 double-click spam
 * - 1 日可多次記錄唔同 emotion (F4 fix)
 * - profileId undefined → silent no-op
 *
 * Memory rule 14: coverage gate 必過 floor 15.10%
 *
 * Note: happy-dom 冇 indexedDB mock, 我哋用 vi.mock 整個 idb service
 * 改用 in-memory store, 純 verify hook 行為 (dedup + multi-emotion + source)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// In-memory IDB store for test
const inMemoryStore: Array<{ id: number; profileId: string; emotionId: string; source: string; ts: number }> = []
let nextId = 1

vi.mock('../services/idb', () => ({
  appendEmotionLog: vi.fn(async (record: { profileId: string; emotionId: string; source: string; ts: number }) => {
    inMemoryStore.push({ id: nextId++, ...record })
  }),
  getEmotionLogs: vi.fn(async (profileId: string, _limit: number) => {
    return inMemoryStore.filter((r) => r.profileId === profileId)
  }),
}))

// Import after mock setup
import { useEmotionLog } from '../hooks/useEmotionLog'

beforeEach(() => {
  inMemoryStore.length = 0
  nextId = 1
  // Reset loggedRecently Map 經 vi.resetModules
  vi.resetModules()
})

describe('useEmotionLog', () => {
  it('logs emotion on call', async () => {
    const { result } = renderHook(() => useEmotionLog({ profileId: 'test-1' }))
    await act(async () => {
      await result.current.log('joy', 'mouse-click')
    })
    expect(inMemoryStore.length).toBe(1)
    expect(inMemoryStore[0].emotionId).toBe('joy')
    expect(inMemoryStore[0].source).toBe('mouse-click')
  })

  it('silent no-op when profileId is undefined', async () => {
    const { result } = renderHook(() => useEmotionLog({ profileId: undefined }))
    await act(async () => {
      await result.current.log('joy', 'mouse-click')
    })
    expect(inMemoryStore.length).toBe(0) // 冇 profileId 唔寫
  })

  it('5s dedup: same emotion+source 連續 call 只 log 1 次', async () => {
    const { result } = renderHook(() => useEmotionLog({ profileId: 'test-dedup' }))
    await act(async () => {
      await result.current.log('joy', 'mouse-click')
      await result.current.log('joy', 'mouse-click') // 5s 內 dedup
      await result.current.log('joy', 'mouse-click') // 5s 內 dedup
    })
    expect(inMemoryStore.length).toBe(1)
  })

  it('different emotion 同時間可 log 多次 (1 日多 emotion)', async () => {
    const { result } = renderHook(() => useEmotionLog({ profileId: 'test-multi' }))
    await act(async () => {
      await result.current.log('joy', 'mouse-click')
      await result.current.log('sadness', 'mouse-click')
      await result.current.log('anger', 'mouse-click')
    })
    expect(inMemoryStore.length).toBe(3)
    const emotionSet = new Set(inMemoryStore.map((l) => l.emotionId))
    expect(emotionSet.has('joy')).toBe(true)
    expect(emotionSet.has('sadness')).toBe(true)
    expect(emotionSet.has('anger')).toBe(true)
  })

  it('different source 唔衝突 (mouse-dwell vs mouse-click)', async () => {
    const { result } = renderHook(() => useEmotionLog({ profileId: 'test-source' }))
    await act(async () => {
      await result.current.log('joy', 'mouse-dwell')
      await result.current.log('joy', 'mouse-click') // 唔同 source → 唔 dedup
    })
    expect(inMemoryStore.length).toBe(2)
  })
})

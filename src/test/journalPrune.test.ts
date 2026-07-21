/**
 * journalPrune service tests (Sprint 76 F1 Batch 3)
 *
 * Memory rule 14: 補 coverage 避免跌穿 floor 15.10%
 *
 * Note: happy-dom 冇 indexedDB mock, 我哋用 vi.mock 整個 idb service
 * 改用 in-memory store, 純 verify journalPrune 邏輯 (cutoff / boundary / dedup)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// In-memory IDB store for test
const inMemoryStore: Array<{ id: number; profileId: string; emotionId: string; source: string; ts: number }> = []
let nextId = 1

vi.mock('../services/idb', () => ({
  getEmotionLogs: vi.fn(async (profileId: string, _limit: number) => {
    return inMemoryStore.filter((r) => r.profileId === profileId)
  }),
  appendEmotionLog: vi.fn(async (record: { profileId: string; emotionId: string; source: string; ts: number }) => {
    inMemoryStore.push({ id: nextId++, ...record })
  }),
}))

import {
  previewPrune,
  pruneOldLogs,
  _resetPruneStateForTest,
  PRUNE_AGE_DAYS,
} from '../services/journalPrune'

const MS_PER_DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  inMemoryStore.length = 0
  nextId = 1
  _resetPruneStateForTest()
})

describe('journalPrune.previewPrune', () => {
  it('returns 0 pruned for empty journal', async () => {
    const result = await previewPrune('empty-profile')
    expect(result.prunedCount).toBe(0)
    expect(result.remainingCount).toBe(0)
    expect(result.oldestTs).toBe(null)
  })

  it('counts entries older than 30 days as prunable', async () => {
    const now = Date.now()
    inMemoryStore.push(
      { id: 1, profileId: 'p1', emotionId: 'joy', source: 'mouse-click', ts: now - 35 * MS_PER_DAY },
      { id: 2, profileId: 'p1', emotionId: 'sadness', source: 'mouse-click', ts: now - 20 * MS_PER_DAY },
      { id: 3, profileId: 'p1', emotionId: 'anger', source: 'mouse-click', ts: now - 5 * MS_PER_DAY },
    )
    const result = await previewPrune('p1', PRUNE_AGE_DAYS, now)
    expect(result.prunedCount).toBe(1) // 35 日前
    expect(result.remainingCount).toBe(2)
    expect(result.oldestTs).not.toBe(null)
  })

  it('boundary: exactly 30 days is kept, 31 days is pruned', async () => {
    const now = Date.now()
    inMemoryStore.push(
      { id: 1, profileId: 'p2', emotionId: 'joy', source: 'mouse-click', ts: now - 30 * MS_PER_DAY },
      { id: 2, profileId: 'p2', emotionId: 'sadness', source: 'mouse-click', ts: now - 31 * MS_PER_DAY },
    )
    const result = await previewPrune('p2', PRUNE_AGE_DAYS, now)
    expect(result.prunedCount).toBe(1)
    expect(result.remainingCount).toBe(1)
  })

  it('custom days param', async () => {
    const now = Date.now()
    inMemoryStore.push({ id: 1, profileId: 'p3', emotionId: 'joy', source: 'mouse-click', ts: now - 10 * MS_PER_DAY })
    const result = await previewPrune('p3', 7, now)
    expect(result.prunedCount).toBe(1)
    expect(result.remainingCount).toBe(0)
  })

  it('filters by profileId', async () => {
    const now = Date.now()
    inMemoryStore.push(
      { id: 1, profileId: 'p4', emotionId: 'joy', source: 'mouse-click', ts: now - 50 * MS_PER_DAY },
      { id: 2, profileId: 'p4-other', emotionId: 'joy', source: 'mouse-click', ts: now - 50 * MS_PER_DAY },
    )
    const result = await previewPrune('p4', PRUNE_AGE_DAYS, now)
    expect(result.prunedCount).toBe(1) // 只計 p4
    expect(result.remainingCount).toBe(0)
  })
})

describe('journalPrune.pruneOldLogs idempotency', () => {
  it('returns preview without mutating', async () => {
    inMemoryStore.push({ id: 1, profileId: 'p5', emotionId: 'joy', source: 'mouse-click', ts: Date.now() - 40 * MS_PER_DAY })
    const r1 = await pruneOldLogs('p5')
    expect(r1.prunedCount).toBe(1)
    // 第二次 call (same day) 應 skip 但 return preview
    const r2 = await pruneOldLogs('p5')
    expect(r2.prunedCount).toBe(1)
    // 冇 delete (preview-only)
    expect(inMemoryStore.length).toBe(1)
  })

  it('1 日 1 次 dedup — 強制 reset 後第二次 call 仍 preview', async () => {
    inMemoryStore.push({ id: 1, profileId: 'p6', emotionId: 'joy', source: 'mouse-click', ts: Date.now() - 40 * MS_PER_DAY })
    await pruneOldLogs('p6')
    _resetPruneStateForTest()
    await pruneOldLogs('p6')
    expect(inMemoryStore.length).toBe(1) // 冇實際 mutation
  })
})

/**
 * journalPrune — 30-day auto-prune for emotion_logs (Sprint 76 F1 Batch 2)
 *
 * Per R1 (technical risk): iOS Safari PWA storage quota ~50MB
 * - 30 days emotion log × N profile × per-day 多 entry = growth 風險
 * - 自動 prune > 30 days 嘅 entry
 * - 留 metadata: count + lastPruneTs (meta store)
 *
 * Memory rule 10 idempotency:
 * - module-level Set keyed by `${profileId}::${dayBucket}` 防止
 *   concurrent re-mount double-prune 同一天
 * - Day bucket YYYY-MM-DD (1 日 1 次)
 *
 * Memory rule 13 family 4 silent data loss:
 * - 唔可以 silently 刪 user 30 days emotion data 唔通知
 * - 必先 call getEmotionLogs 計算 affected count, 然後 batch delete
 * - Failed 必 propagate error
 */

import { getEmotionLogs, type EmotionLogRecord } from './idb'

export const PRUNE_AGE_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface PruneResult {
  profileId: string
  prunedCount: number
  remainingCount: number
  /** Epoch ms of oldest remaining entry, or null if empty */
  oldestTs: number | null
}

/** 計算 cutoff timestamp (now - N days) */
function pruneCutoff(days: number = PRUNE_AGE_DAYS, now: number = Date.now()): number {
  return now - days * MS_PER_DAY
}

/** 今日 YYYY-MM-DD bucket */
function dayBucket(ts: number = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10)
}

const prunedToday = new Set<string>()

/**
 * 計算 prune impact without mutating. 用嚟 UI 預覽 / log telemetry。
 */
export async function previewPrune(
  profileId: string,
  days: number = PRUNE_AGE_DAYS,
  now: number = Date.now(),
): Promise<PruneResult> {
  const cutoff = pruneCutoff(days, now)
  const all = await getEmotionLogs(profileId, Number.MAX_SAFE_INTEGER)
  const old = all.filter((r: EmotionLogRecord) => r.ts < cutoff)
  const remaining = all.length - old.length
  const oldestTs = all.length > 0 ? Math.min(...all.map((r) => r.ts)) : null
  return {
    profileId,
    prunedCount: old.length,
    remainingCount: remaining,
    oldestTs: oldestTs !== null && oldestTs >= cutoff ? oldestTs : null,
  }
}

/**
 * 真正執行 prune. 1 profile 1 日 1 次 (idempotency guard).
 *
 * 暫時只 return preview 唔做 delete — idb.ts 冇 bulk delete API
 * 必先 extend idb.ts 加 `deleteEmotionLogsOlderThan`, 然後呢度接
 * 真實 delete. 留 batch 3 處理。
 */
export async function pruneOldLogs(
  profileId: string,
  days: number = PRUNE_AGE_DAYS,
): Promise<PruneResult> {
  const bucket = dayBucket()
  const guardKey = `${profileId}::${bucket}`
  if (prunedToday.has(guardKey)) {
    // 1 日 1 次, return preview only
    return previewPrune(profileId, days)
  }
  prunedToday.add(guardKey)
  // Lazy GC after 24h
  setTimeout(
    () => {
      prunedToday.delete(guardKey)
    },
    MS_PER_DAY + 60_000,
  )

  return previewPrune(profileId, days)
}

/** test helper: clear module-level state */
export function _resetPruneStateForTest(): void {
  prunedToday.clear()
}

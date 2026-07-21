/**
 * useEmotionLog — 情緒日記 write hook (Sprint 76 F1 Batch 1)
 *
 * 自動 append emotion log 入 IndexedDB 當用戶 trigger 情緒。
 * 3 個 mode 統一使用:
 *   - Weak: mouse-dwell / touch-click chip
 *   - Mid: pose-classifier matched
 *   - High: mouse-dwell / touch-click + save with emotion label
 *
 * Memory rule 10: session-scoped idempotency guard
 *   - module-level Map<key, ts> keyed by `${profileId}::${emotionId}::${source}`
 *   - 防止 re-mount + 1 秒內 double-click spam, 但 1 日內可多次多 emotion
 *   - 解決 v3 嘅 1 日 1 entry 問題 (F4 silent data loss risk)
 *
 * Memory rule 13 family 4 fix: 之前 dedup 1 日 1 entry 會 overwrite multi-emotion
 *   (joy 10:00 寫入, anger 14:00 click 會 skip 因為同日)
 *   改 per-source 5 秒 dedup window, 1 日可多次記錄唔同 emotion
 *
 * 唔做 (留 Phase 2):
 *   - 30-day auto-prune (Sprint 76 batch 2 處理)
 *   - ML pattern detect (per user decision, 唔做 ML, simple heuristic)
 *   - PDF export (留後續 batch)
 */

import { useCallback } from 'react'
import { appendEmotionLog, type EmotionLogRecord } from '../services/idb'
import type { EmotionId } from '../constants/emotions'

export type EmotionLogSource = EmotionLogRecord['source']

/** Idempotency window: 5 秒內同一 source 同一 emotion 唔重複 log */
const DEDUP_WINDOW_MS = 5000

interface UseEmotionLogOptions {
  profileId: string | undefined
}

export function useEmotionLog({ profileId }: UseEmotionLogOptions): {
  log: (emotionId: EmotionId, source: EmotionLogSource) => Promise<void>
} {
  const log = useCallback(
    async (emotionId: EmotionId, source: EmotionLogSource): Promise<void> => {
      if (!profileId) {
        // 冇 active profile 唔 log (避免空 log 污染 journal)
        return
      }
      // Memory rule 10: session-scoped idempotency guard (5s window per source+emotion)
      // 唔用 1 日 1 entry (會 silently overwrite 多 emotion, F4 silent data loss)
      // 唔用 0 dedup (會 double-click spam, F1 default state desync)
      // sweet spot: 5s per (profile, emotion, source) — 1 日可多次唔同 emotion
      const now = Date.now()
      const guardKey = `${profileId}::${emotionId}::${source}`
      const lastTs = loggedRecently.get(guardKey)
      if (lastTs !== undefined && now - lastTs < DEDUP_WINDOW_MS) {
        return
      }
      loggedRecently.set(guardKey, now)
      // Lazy GC: 過 60s 自動 clear (避免 memory leak)
      setTimeout(() => {
        const stored = loggedRecently.get(guardKey)
        if (stored !== undefined && Date.now() - stored >= DEDUP_WINDOW_MS) {
          loggedRecently.delete(guardKey)
        }
      }, DEDUP_WINDOW_MS + 1000)

      try {
        await appendEmotionLog({
          profileId,
          emotionId,
          source,
          ts: now,
        })
      } catch (err) {
        // IndexDDB fail 唔可以 block UX, 用 fire-and-forget
        // eslint-disable-next-line no-console
        console.warn('[useEmotionLog] append failed', err)
        // Rollback guard, 等 user retry 下次 click (5s 後)
        loggedRecently.delete(guardKey)
      }
    },
    [profileId],
  )

  return { log }
}

// Module-level Map — 跨 component instance share
// memory rule 10: set() 喺 await 之前, race window ~0ms
// (F4 fix v2: 唔用 Set 因為需要 timestamp, 改 Map<key, ts>)
const loggedRecently = new Map<string, number>()

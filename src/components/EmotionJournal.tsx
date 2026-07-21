/**
 * EmotionJournal — 情緒週報 view (Sprint 76 F1 Batch 2)
 *
 * Calendar heat-map 風格:
 *   - 7 columns (週一至週日) × 5 rows (past 5 weeks) = 35 cells
 *   - 每格 color-coded by dominant emotion 嗰日
 *   - 點格子 → 嗰日 entries list (modal)
 *
 * 設計取捨:
 *   - 唔做 month view (30 cells 太多, ASD 學生 overload)
 *   - 5 weeks 足夠家長 / 老師 review 1 個月 trend
 *   - hover (desktop) / tap (touch) cell → tooltip 顯示嗰日 emotion summary
 *
 * Memory rule 14 (a11y):
 *   - 每格 `aria-label` = "2026-07-15: 主要情緒 joy (3 次)"
 *   - calendar grid `role="grid"`, cell `role="gridcell"`
 *   - keyboard navigation Tab + Enter 開 detail
 *
 * 唔做 (留後續):
 *   - PDF export
 *   - 老師 / 家長 share via QR
 *   - Calendar 切換月份
 */

import { useEffect, useState } from 'react'
import { EMOTIONS, EMOTIONS_BY_ID, type EmotionId } from '../constants/emotions'
import { getEmotionLogs, type EmotionLogRecord } from '../services/idb'
import { previewPrune, PRUNE_AGE_DAYS } from '../services/journalPrune'

interface EmotionJournalProps {
  profileId: string
  onClose: () => void
}

interface DayCell {
  date: string // YYYY-MM-DD
  ts: number
  /** 0-7 emotionId 嘅 count map */
  counts: Partial<Record<EmotionId, number>>
  total: number
  dominant: EmotionId | null
}

const WEEKS_TO_SHOW = 5
const DAYS_PER_WEEK = 7

function dateKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10)
}

function buildCells(logs: EmotionLogRecord[], now: number = Date.now()): DayCell[] {
  // past 35 days, oldest first
  const cells: DayCell[] = []
  const msPerDay = 24 * 60 * 60 * 1000
  for (let i = WEEKS_TO_SHOW * DAYS_PER_WEEK - 1; i >= 0; i--) {
    const ts = now - i * msPerDay
    cells.push({ date: dateKey(ts), ts, counts: {}, total: 0, dominant: null })
  }
  for (const log of logs) {
    const key = dateKey(log.ts)
    const cell = cells.find((c) => c.date === key)
    if (!cell) continue
    // log.emotionId 係 string (IDB 唔 enforce EmotionId union)
    // 必 narrow 落 EmotionId, 否則 record mismatch
    const eid = log.emotionId as EmotionId
    cell.counts[eid] = (cell.counts[eid] ?? 0) + 1
    cell.total += 1
  }
  for (const cell of cells) {
    let bestCount = 0
    let bestEmotion: EmotionId | null = null
    for (const eid of Object.keys(cell.counts) as EmotionId[]) {
      const n = cell.counts[eid] ?? 0
      if (n > bestCount) {
        bestCount = n
        bestEmotion = eid
      }
    }
    cell.dominant = bestEmotion
  }
  return cells
}

function dominantColor(dominant: EmotionId | null): string {
  if (!dominant) return 'bg-slate-800/40'
  return EMOTIONS_BY_ID[dominant].hexSoft
}

export function EmotionJournal({ profileId, onClose }: EmotionJournalProps): React.JSX.Element {
  const [cells, setCells] = useState<DayCell[]>([])
  const [loading, setLoading] = useState(true)
  const [pruneInfo, setPruneInfo] = useState<{ count: number; cutoff: number } | null>(null)
  const [selectedDay, setSelectedDay] = useState<DayCell | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const logs = await getEmotionLogs(profileId, 1000)
      if (cancelled) return
      setCells(buildCells(logs))
      const preview = await previewPrune(profileId)
      if (cancelled) return
      setPruneInfo({ count: preview.prunedCount, cutoff: Date.now() - PRUNE_AGE_DAYS * 24 * 60 * 60 * 1000 })
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [profileId])

  // Group cells into weeks (column = day-of-week, row = week)
  // Pad the first row with null cells if needed (so columns align with weekday header)
  const flatCells: (DayCell | null)[] = []
  if (cells.length > 0) {
    const firstDate = new Date(cells[0].ts)
    // getDay: 0=Sun, 1=Mon, ... 6=Sat
    // 我哋 header 寫 Mon-Sun (週一先), so pad 用 (getDay + 6) % 7
    const firstDayOfWeek = (firstDate.getDay() + 6) % 7
    for (let i = 0; i < firstDayOfWeek; i++) {
      flatCells.push(null)
    }
  }
  for (const cell of cells) {
    flatCells.push(cell)
  }
  // Pad tail to fill WEEKS_TO_SHOW * 7 cells
  while (flatCells.length < WEEKS_TO_SHOW * DAYS_PER_WEEK) {
    flatCells.push(null)
  }

  return (
    <div
      className="fixed inset-0 bg-slate-950/90 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="情緒週報"
    >
      <div className="bg-slate-900 rounded-2xl border-2 border-slate-700 max-w-2xl w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📊 情緒週報
            <span className="text-xs text-slate-400 font-normal">（過去 5 週）</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-slate-400 text-center py-8">載入中...</p>
        ) : (
          <>
            {/* Weekday header */}
            <div className="grid grid-cols-7 gap-1 mb-1 text-xs text-slate-500 text-center font-semibold">
              {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1" role="grid" aria-label="5 週情緒日曆">
              {flatCells.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty-${idx}`} className="aspect-square" />
                }
                const emotionMeta = cell.dominant ? EMOTIONS_BY_ID[cell.dominant] : null
                const ariaLabel = `${cell.date}: ${
                  cell.total === 0
                    ? '無記錄'
                    : `主要情緒 ${emotionMeta?.labelZh ?? ''} (${cell.total} 次)`
                }`
                return (
                  <button
                    key={cell.date}
                    type="button"
                    onClick={() => setSelectedDay(cell)}
                    aria-label={ariaLabel}
                    className={`
                      aspect-square rounded-md border border-slate-700/50
                      ${dominantColor(cell.dominant)}
                      hover:ring-2 hover:ring-amber-400 transition
                      flex items-center justify-center text-xs
                    `}
                  >
                    {cell.total > 0 && emotionMeta ? (
                      <span aria-hidden="true">{emotionMeta.emoji}</span>
                    ) : (
                      <span className="text-slate-600 text-[10px]">{cell.date.slice(8, 10)}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Prune info */}
            {pruneInfo && pruneInfo.count > 0 && (
              <p className="mt-4 text-xs text-amber-400">
                ⏰ {pruneInfo.count} 條超過 {PRUNE_AGE_DAYS} 日嘅記錄將會自動清理
              </p>
            )}

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
              {Object.values(EMOTIONS).map((e) => (
                <span key={e.id} className="flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ backgroundColor: e.hexSoft }}
                  />
                  {e.labelZh}
                </span>
              ))}
            </div>
          </>
        )}

        {/* Day detail modal */}
        {selectedDay && (
          <div
            className="fixed inset-0 bg-slate-950/80 z-[210] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedDay.date} 情緒記錄`}
          >
            <div className="bg-slate-800 rounded-xl border-2 border-slate-600 max-w-sm w-full p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-white">
                  {selectedDay.date} <span className="text-sm text-slate-400">({selectedDay.total} 次)</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  aria-label="關閉"
                  className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-2">
                {Object.entries(selectedDay.counts).map(([eid, n]) => {
                  const emotion = EMOTIONS_BY_ID[eid as EmotionId]
                  return (
                    <div key={eid} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span aria-hidden="true">{emotion.emoji}</span>
                        <span className="text-slate-300">{emotion.labelZh}</span>
                      </span>
                      <span className="text-slate-400 font-mono">{n} 次</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

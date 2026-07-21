/**
 * DailyMoodPrompt — 「今日感覺」prompt modal.
 *
 * 對應 E4 每日感覺 prompt (R31 緩解: 隨機化 + 可 skip)。
 *
 * UX:
 *   - 開 app 第一次顯示
 *   - 隨機次序呈現 8 個 Plutchik emotion
 *   - User 揀 1 個 / 跳過
 *   - 寫入 IndexedDB emotion log
 *   - 當日只顯示 1 次(用 localStorage 記錄 lastShownDate)
 */

import { useEffect, useState } from 'react'
import { EMOTIONS, type EmotionId } from '../constants/emotions'
import { speak, isTtsSupported } from '../services/tts'
import { appendEmotionLog } from '../services/idb'
import { useProfileStore } from '../store/profileStore'

const STORAGE_DATE_KEY = 'air-drawing:dailyMoodShownDate'

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function wasShownToday(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_DATE_KEY) === todayIsoDate()
  } catch {
    return false
  }
}

function markShownToday(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_DATE_KEY, todayIsoDate())
  } catch {
    /* ignore */
  }
}

interface DailyMoodPromptProps {
  /** 由 parent 控制顯示 */
  open: boolean
  onClose: () => void
}

export function DailyMoodPrompt({ open, onClose }: DailyMoodPromptProps): React.JSX.Element | null {
  const activeProfileId = useProfileStore((s) => s.activeProfileId)
  const [shuffled] = useState<EmotionId[]>(() => {
    // R31 緩解: 隨機化次序
    const ids = EMOTIONS.map((e) => e.id)
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }
    return ids
  })
  const [selected, setSelected] = useState<EmotionId | null>(null)

  // Once on close, persist that today was shown
  useEffect(() => {
    if (!open) {
      markShownToday()
    }
  }, [open])

  if (!open) return null

  const handlePick = async (id: EmotionId) => {
    if (selected) return
    setSelected(id)
    const emo = EMOTIONS.find((e) => e.id === id)
    if (emo && isTtsSupported()) speak(emo.ttsText, { lang: 'zh-Hant' })
    if (activeProfileId) {
      try {
        await appendEmotionLog({
          profileId: activeProfileId,
          emotionId: id,
          source: 'mouse-click',
          ts: Date.now(),
        })
      } catch {
        /* ignore */
      }
    }
    setTimeout(() => onClose(), 800)
  }

  const handleSkip = () => {
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-slate-950/90 z-40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="今日感覺"
    >
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-amber-400 mb-2 text-center">
          🌅 你今日感覺點呀?
        </h2>
        <p className="text-sm text-slate-400 text-center mb-6">
          揀一個最貼近你今日嘅感覺
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {shuffled.map((id) => {
            const emo = EMOTIONS.find((e) => e.id === id)!
            const isSelected = selected === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => handlePick(id)}
                disabled={selected != null}
                className={`
                  p-3 rounded-xl border-2 transition-all active:scale-95
                  ${isSelected
                    ? 'ring-4 ring-amber-400'
                    : 'hover:scale-105'
                  }
                `}
                style={{
                  backgroundColor: emo.hexSoft,
                  borderColor: isSelected ? emo.hex : 'transparent',
                  color: emo.hex,
                }}
                aria-label={`${emo.labelZh} ${emo.labelEn}`}
              >
                <div className="text-4xl mb-1" aria-hidden="true">{emo.emoji}</div>
                <div className="text-sm font-bold">{emo.labelZh}</div>
                <div className="text-[10px] opacity-70">{emo.labelEn}</div>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={handleSkip}
          className="w-full py-2 text-sm text-slate-400 hover:text-slate-300"
        >
          跳過
        </button>
      </div>
    </div>
  )
}

/** Check whether today's prompt was already shown(由 App 喺 mount 嗰陣 call) */
export function shouldShowDailyPrompt(): boolean {
  return !wasShownToday()
}

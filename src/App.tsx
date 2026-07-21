/**
 * Air Drawing — Phase 1 scaffold
 *
 * Plan: PLAN.md §12 (v2.0 — 3-tier accessibility)
 * Roadmap: ROADMAP.md Phase 1
 *
 * This file provides:
 *  - F24 Mode entry router (3 chips: 弱/中/強)
 *  - F26 Per-mode UI shell stubs (Weak / Mid / High)
 *  - F23 Finger dwell-click hook stub
 *  - AAC default (camera optional)
 *  - Cross-device baseline: viewport, 100dvh, matchMedia pointer detection
 *
 * Phase 2 將加: Plutchik 8 emotion constants, 多 profile, PIN 鎖, TTS,
 *                完整 finger dwell-click algorithm, MediaPipe Hands + Pose.
 *
 * 完整 source body (MediaPipe AI 追蹤、Canvas 畫圖、Audio engine) 延到 Phase 2
 * 拆 `<DrawingCanvas>` step。
 */

import { useEffect, useState, useCallback } from 'react'

// ────────────────────────────────────────────────────────────────────
// F24: Mode enum
// ────────────────────────────────────────────────────────────────────
type Mode = 'low' | 'mid' | 'high' | null

const MODES: Array<{
  id: Exclude<Mode, null>
  emoji: string
  labelZh: string
  labelEn: string
  shortDesc: string
  bg: string
  border: string
  text: string
}> = [
  {
    id: 'low',
    emoji: '🟢',
    labelZh: '輕鬆模式',
    labelEn: 'Low (Beginner)',
    shortDesc: '揀表情 · 手指 click',
    bg: 'bg-emerald-50',
    border: 'border-emerald-400',
    text: 'text-emerald-900',
  },
  {
    id: 'mid',
    emoji: '🟡',
    labelZh: '中級模式',
    labelEn: 'Mid (Intermediate)',
    shortDesc: '做動作 · trigger 情緒',
    bg: 'bg-amber-50',
    border: 'border-amber-400',
    text: 'text-amber-900',
  },
  {
    id: 'high',
    emoji: '🔴',
    labelZh: '進階模式',
    labelEn: 'High (Advanced)',
    shortDesc: '自由畫 · 全部功能',
    bg: 'bg-rose-50',
    border: 'border-rose-400',
    text: 'text-rose-900',
  },
]

// ────────────────────────────────────────────────────────────────────
// F23: Finger dwell-click hook stub
// Phase 2 將完整實裝 (MediaPipe Hands 食指追蹤 + 0.5s dwell trigger)
// ────────────────────────────────────────────────────────────────────
interface UseDwellClickStub {
  /** 當前 hover 緊嘅 element id (stub: 永遠 null) */
  hoveredId: string | null
  /** Dwell progress 0-1 (stub: 永遠 0) */
  progress: number
  /** Trigger click programmatically (stub: 唔做嘢) */
  triggerClick: (id: string) => void
}

function useDwellClickStub(_dwellTimeMs: number = 500): UseDwellClickStub {
  return {
    hoveredId: null,
    progress: 0,
    triggerClick: () => {
      /* Phase 2 實裝 */
    },
  }
}

// ────────────────────────────────────────────────────────────────────
// F26: Weak mode shell (🟢)
// Phase 2 將加 8 個 Plutchik chip + TTS + emotion log
// ────────────────────────────────────────────────────────────────────
function WeakModeShell({ onExit }: { onExit: () => void }) {
  return (
    <div className="min-h-dvh flex flex-col bg-slate-900 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h1 className="text-lg font-semibold">🟢 輕鬆模式 (Low / Beginner)</h1>
        <button
          type="button"
          onClick={onExit}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
        >
          ← 返模式選擇
        </button>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-slate-300 text-sm">Phase 1 stub — Phase 2 將加:</p>
        <ul className="text-slate-400 text-sm list-disc list-inside space-y-1 max-w-md">
          <li>Plutchik 8 情緒 chip (3×3 grid, 200×200pt)</li>
          <li>Finger dwell-click (MediaPipe Hands 食指追蹤)</li>
          <li>TTS 語音 (Web Speech API)</li>
          <li>Emotion log (IndexedDB)</li>
        </ul>
      </main>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// F26: Mid mode shell (🟡)
// Phase 2 將加 MediaPipe Pose + 8 動作 classifier
// ────────────────────────────────────────────────────────────────────
function MidModeShell({ onExit }: { onExit: () => void }) {
  return (
    <div className="min-h-dvh flex flex-col bg-slate-900 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h1 className="text-lg font-semibold">🟡 中級模式 (Mid / Intermediate)</h1>
        <button
          type="button"
          onClick={onExit}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
        >
          ← 返模式選擇
        </button>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-slate-300 text-sm">Phase 1 stub — Phase 2 將加:</p>
        <ul className="text-slate-400 text-sm list-disc list-inside space-y-1 max-w-md">
          <li>MediaPipe Pose (33 keypoints)</li>
          <li>8 個 rule-based 動作 classifier (坐姿 friendly)</li>
          <li>Pose-prompt overlay (「請舉高雙手」)</li>
          <li>TTS 觸發語音 + 動作 log</li>
        </ul>
      </main>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// F26: High mode shell (🔴) — Phase 1 stub,完整 source 1:1 行為延到 Phase 2
// ────────────────────────────────────────────────────────────────────
function HighModeShell({ onExit }: { onExit: () => void }) {
  return (
    <div className="min-h-dvh flex flex-col bg-slate-900 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h1 className="text-lg font-semibold">🔴 進階模式 (High / Advanced)</h1>
        <button
          type="button"
          onClick={onExit}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
        >
          ← 返模式選擇
        </button>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-slate-300 text-sm">Phase 1 stub — Phase 2-3 將加:</p>
        <ul className="text-slate-400 text-sm list-disc list-inside space-y-1 max-w-md">
          <li>鏡頭 + MediaPipe Hands 食指 AI 畫畫</li>
          <li>Canvas 畫圖 (smoothing + mirror)</li>
          <li>顏色 / Rainbow / Eraser / 粗細</li>
          <li>描紅模板 (4 種 + 中文字 + 表達卡)</li>
          <li>Undo/Redo + 情緒日記 + 鍵盤 hotkey</li>
          <li>存檔下載 PNG</li>
        </ul>
      </main>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// F24: Mode entry — 3 個大 chip
// ────────────────────────────────────────────────────────────────────
function ModeEntry({
  lastMode,
  onPick,
}: {
  lastMode: Exclude<Mode, null> | null
  onPick: (m: Exclude<Mode, null>) => void
}) {
  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <header className="px-4 py-6 text-center border-b border-slate-700/50">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-wide">
          🌟 你想用邊個模式?
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Choose your mode · 為智障 / ASD / non-verbal 學生設計
        </p>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full max-w-4xl">
          {MODES.map((m) => {
            const isLast = lastMode === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onPick(m.id)}
                data-testid={`mode-entry-${m.id}`}
                className={`
                  group relative
                  min-h-[200px] sm:min-h-[280px]
                  p-6
                  rounded-3xl
                  border-4
                  ${m.bg} ${m.border} ${m.text}
                  hover:scale-105 active:scale-95
                  transition-transform duration-200
                  shadow-2xl
                  focus-visible:ring-4 focus-visible:ring-amber-400
                  focus:outline-none
                `}
                style={{ minWidth: '200px', minHeight: '200px' }}
                aria-label={`${m.labelZh} — ${m.labelEn}: ${m.shortDesc}`}
              >
                {isLast && (
                  <span className="absolute -top-3 -right-3 px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-400 text-slate-900 shadow">
                    📌 上次用
                  </span>
                )}
                <div className="text-6xl mb-3" aria-hidden="true">
                  {m.emoji}
                </div>
                <div className="text-xl font-bold mb-1">{m.labelZh}</div>
                <div className="text-xs opacity-70 mb-2">{m.labelEn}</div>
                <div className="text-sm opacity-80">{m.shortDesc}</div>
              </button>
            )
          })}
        </div>
      </main>

      <footer className="px-4 py-4 text-center text-xs text-slate-500 border-t border-slate-700/50 space-y-1">
        <div>
          🟢 輕鬆 = 揀表情 · 🟡 中級 = 做動作 · 🔴 進階 = 自由畫
        </div>
        <div className="opacity-60">
          本應用程式完全在本機端運行 · 不儲存 / 不傳輸任何視訊影像 🔒
        </div>
      </footer>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// 主 App
// ────────────────────────────────────────────────────────────────────
function App() {
  const [mode, setMode] = useState<Mode>(null)
  const [lastMode, setLastMode] = useState<Exclude<Mode, null> | null>(null)
  // F23 stub (Phase 2 將用真正 dwell-click)
  useDwellClickStub(500)

  // Persist last mode to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('air-drawing:lastMode') as
        | Exclude<Mode, null>
        | null
      if (saved && (saved === 'low' || saved === 'mid' || saved === 'high')) {
        setLastMode(saved)
      }
    } catch {
      /* localStorage 鎖咗都 OK,fallback 唔 highlight */
    }
  }, [])

  const pickMode = useCallback(
    (m: Exclude<Mode, null>) => {
      setMode(m)
      setLastMode(m)
      try {
        localStorage.setItem('air-drawing:lastMode', m)
      } catch {
        /* ignore */
      }
    },
    [],
  )

  const exitToEntry = useCallback(() => setMode(null), [])

  // Render by mode
  if (mode === 'low') return <WeakModeShell onExit={exitToEntry} />
  if (mode === 'mid') return <MidModeShell onExit={exitToEntry} />
  if (mode === 'high') return <HighModeShell onExit={exitToEntry} />

  return <ModeEntry lastMode={lastMode} onPick={pickMode} />
}

export default App

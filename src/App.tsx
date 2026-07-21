/**
 * Air Drawing — Phase 2 batch 2 (Step 1-5 完整整合).
 *
 * Plan: PLAN.md §12 (v2.0 — 3-tier accessibility)
 * Roadmap: ROADMAP.md Phase 2
 *
 * Step ships:
 *  - F24 Mode entry router (3 chips)
 *  - F26 WeakModeShell (Step 6 — 完整 Plutchik 8 + TTS + dwell-click)
 *  - F26 HighModeShell (Step 1-2 — 完整 source 1:1 行為 refactor)
 *  - F26 MidModeShell (Phase 3 stub)
 *  - E6 多 profile (Zustand + IndexedDB)
 *  - E7 PIN 鎖 (PinLock)
 *  - E4 「今日感覺」prompt
 *  - ProfileSwitcher
 *  - E18 TTS (already shipped Step 6)
 *  - F23 dwell-click (already shipped Step 6)
 *  - AAC default (camera optional)
 *  - Cross-device baseline
 *
 * Phase 3 將加:
 *  - C2 MediaPipe Pose + 8 動作 classifier (mid mode)
 *  - E9 Undo/Redo + 情緒日記 (high mode 完整)
 *  - E11 情緒顏色記憶遊戲
 *  - E20 印章 / 情緒符號
 *  - Universal PWA (Phase 4b)
 */

import { useEffect, useState, useCallback } from 'react'
import { WeakModeShell } from './components/WeakModeShell'
import { MidModeShell } from './components/MidModeShell'
import { HighModeShell } from './components/HighModeShell'
import { ProfileSwitcher } from './components/ProfileSwitcher'
import { InstallBanner } from './components/InstallBanner'
import { PinLock } from './components/PinLock'
import { DailyMoodPrompt, shouldShowDailyPrompt } from './components/DailyMoodPrompt'
import { useProfileStore, type Mode } from './store/profileStore'

const MODES: Array<{
  id: Mode
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

function ModeEntry({
  lastMode,
  onPick,
  onOpenProfiles,
  profileName,
}: {
  lastMode: Mode | null
  onPick: (m: Mode) => void
  onOpenProfiles: () => void
  profileName: string | null
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
        {profileName && (
          <p className="text-xs text-amber-400 mt-1">👤 當前學生: {profileName}</p>
        )}
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

      <footer className="px-4 py-4 text-center text-xs text-slate-500 border-t border-slate-700/50 space-y-2">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenProfiles}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
          >
            👤 揾學生 / 設定
          </button>
        </div>
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

// Inline MidModeShell stub 已由 src/components/MidModeShell.tsx 取代
// (Phase 3 batch 3A — R23/R24 fix: MediaPipe Pose + 8 動作 classifier + pose-prompt)

function App() {
  const [mode, setMode] = useState<Mode | null>(null)
  const [showProfiles, setShowProfiles] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [showDailyMood, setShowDailyMood] = useState(false)

  const profiles = useProfileStore((s) => s.profiles)
  const activeProfileId = useProfileStore((s) => s.activeProfileId)
  const lastMode = useProfileStore((s) => s.lastMode)
  const pinLockEnabled = useProfileStore((s) => s.pinLockEnabled)
  const pinUnlocked = useProfileStore((s) => s.pinUnlocked)
  const loadProfiles = useProfileStore((s) => s.loadProfiles)
  const setLastMode = useProfileStore((s) => s.setLastMode)

  // Initial load
  useEffect(() => {
    void loadProfiles()
  }, [loadProfiles])

  // Show daily mood prompt after profiles loaded (only if profile exists)
  useEffect(() => {
    if (profiles.length > 0 && activeProfileId && shouldShowDailyPrompt()) {
      setShowDailyMood(true)
    }
  }, [profiles.length, activeProfileId])

  // PIN lock when active profile has PIN + not unlocked
  useEffect(() => {
    if (pinLockEnabled && !pinUnlocked) {
      setShowPin(true)
    } else {
      setShowPin(false)
    }
  }, [pinLockEnabled, pinUnlocked])

  const pickMode = useCallback(
    async (m: Mode) => {
      setMode(m)
      await setLastMode(m)
    },
    [setLastMode],
  )

  const exitToEntry = useCallback(() => setMode(null), [])

  const activeProfile = profiles.find((p) => p.id === activeProfileId)

  return (
    <>
      {mode === 'low' && <WeakModeShell onExit={exitToEntry} />}
      {mode === 'mid' && <MidModeShell onExit={exitToEntry} />}
      {mode === 'high' && <HighModeShell onExit={exitToEntry} />}
      {!mode && (
        <ModeEntry
          lastMode={lastMode}
          onPick={pickMode}
          onOpenProfiles={() => setShowProfiles(true)}
          profileName={activeProfile?.name ?? null}
        />
      )}

      <ProfileSwitcher open={showProfiles} onClose={() => setShowProfiles(false)} />
      <PinLock
        open={showPin}
        autoCloseOnUnlock
      />
      <DailyMoodPrompt open={showDailyMood} onClose={() => setShowDailyMood(false)} />
      <InstallBanner />
    </>
  )
}

export default App

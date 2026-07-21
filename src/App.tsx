/**
 * Air Drawing — 中度學生優先入口
 *
 * 預設：直入 ModerateModeShell（2×2 基本情緒）
 * 老師撳「老師」→ Mode entry（輕鬆 8 格 / 中級 / 進階）
 */

import { useEffect, useState, useCallback } from 'react'
import { WeakModeShell } from './components/WeakModeShell'
import { MidModeShell } from './components/MidModeShell'
import { HighModeShell } from './components/HighModeShell'
import { ModerateModeShell } from './components/ModerateModeShell'
import { ProfileSwitcher } from './components/ProfileSwitcher'
import { InstallBanner } from './components/InstallBanner'
import { PinLock } from './components/PinLock'
import { DailyMoodPrompt, shouldShowDailyPrompt } from './components/DailyMoodPrompt'
import { useProfileStore, type Mode } from './store/profileStore'

/** 學生主畫面 + 老師進階 */
type Screen = 'moderate' | 'teacher-hub' | Mode

const MODES: Array<{
  id: Mode
  emoji: string
  labelZh: string
  shortDesc: string
  bg: string
  border: string
  text: string
}> = [
  {
    id: 'low',
    emoji: '🟢',
    labelZh: '輕鬆模式',
    shortDesc: '8 個表情 · 適合練習',
    bg: 'bg-emerald-50',
    border: 'border-emerald-400',
    text: 'text-emerald-900',
  },
  {
    id: 'mid',
    emoji: '🟡',
    labelZh: '中級模式',
    shortDesc: '做動作 · 觸發情緒',
    bg: 'bg-amber-50',
    border: 'border-amber-400',
    text: 'text-amber-900',
  },
  {
    id: 'high',
    emoji: '🔴',
    labelZh: '進階模式',
    shortDesc: '自由畫 · 全部功能',
    bg: 'bg-rose-50',
    border: 'border-rose-400',
    text: 'text-rose-900',
  },
]

function TeacherHub({
  lastMode,
  onPick,
  onBackStudent,
  onOpenProfiles,
  profileName,
}: {
  lastMode: Mode | null
  onPick: (m: Mode) => void
  onBackStudent: () => void
  onOpenProfiles: () => void
  profileName: string | null
}) {
  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <header className="px-4 py-6 text-center border-b border-slate-700/50">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-wide">老師設定</h1>
        <p className="text-sm text-slate-400 mt-2">揀進階功能 · 學生主畫面已簡化</p>
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
                  min-h-[180px] sm:min-h-[240px]
                  p-6 rounded-3xl border-4
                  ${m.bg} ${m.border} ${m.text}
                  hover:scale-105 active:scale-95
                  transition-transform duration-200
                  shadow-2xl
                  focus-visible:ring-4 focus-visible:ring-amber-400
                  focus:outline-none
                `}
                aria-label={`${m.labelZh}: ${m.shortDesc}`}
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
                <div className="text-sm opacity-80">{m.shortDesc}</div>
              </button>
            )
          })}
        </div>
      </main>

      <footer className="px-4 py-4 text-center text-xs text-slate-500 border-t border-slate-700/50 space-y-2">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onBackStudent}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-900 font-bold text-sm hover:bg-amber-400"
          >
            ← 返學生主畫面
          </button>
          <button
            type="button"
            onClick={onOpenProfiles}
            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
          >
            👤 學生 / 設定
          </button>
        </div>
        <div className="opacity-60">完全本機運行 · 不上傳影像 🔒</div>
      </footer>
    </div>
  )
}

function App() {
  // 中度優先：預設直入學生主畫面
  const [screen, setScreen] = useState<Screen>('moderate')
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

  useEffect(() => {
    void loadProfiles()
  }, [loadProfiles])

  useEffect(() => {
    if (profiles.length > 0 && activeProfileId && shouldShowDailyPrompt()) {
      setShowDailyMood(true)
    }
  }, [profiles.length, activeProfileId])

  useEffect(() => {
    if (pinLockEnabled && !pinUnlocked) {
      setShowPin(true)
    } else {
      setShowPin(false)
    }
  }, [pinLockEnabled, pinUnlocked])

  const pickMode = useCallback(
    async (m: Mode) => {
      setScreen(m)
      await setLastMode(m)
    },
    [setLastMode],
  )

  const backToStudent = useCallback(() => setScreen('moderate'), [])
  const openTeacher = useCallback(() => setScreen('teacher-hub'), [])

  const activeProfile = profiles.find((p) => p.id === activeProfileId)

  return (
    <>
      {screen === 'moderate' && (
        <ModerateModeShell onTeacherOpen={openTeacher} />
      )}
      {screen === 'teacher-hub' && (
        <TeacherHub
          lastMode={lastMode}
          onPick={pickMode}
          onBackStudent={backToStudent}
          onOpenProfiles={() => setShowProfiles(true)}
          profileName={activeProfile?.name ?? null}
        />
      )}
      {screen === 'low' && <WeakModeShell onExit={openTeacher} />}
      {screen === 'mid' && <MidModeShell onExit={openTeacher} />}
      {screen === 'high' && <HighModeShell onExit={openTeacher} />}

      <ProfileSwitcher open={showProfiles} onClose={() => setShowProfiles(false)} />
      <PinLock open={showPin} autoCloseOnUnlock />
      <DailyMoodPrompt open={showDailyMood} onClose={() => setShowDailyMood(false)} />
      <InstallBanner />
    </>
  )
}

export default App

/**
 * ModerateModeShell — 中度學生主畫面 + v3.0.9 大慶祝
 *
 * 慶祝升級:
 *  - 每格專屬視覺（joy煙花 / sadness藍雨 / anger紅震 / fear紫閃）
 *  - Emoji jelly 彈 3 下 + 全屏 pulse 邊框
 *  - 分情緒音效
 *  - 慶祝 3.2s + 底部「你揀咗：XX」鞏固 5s
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MODERATE_EMOTIONS,
  type Emotion,
  type ModerateEmotionId,
} from '../constants/emotions'
import { speak, stopTts, preloadVoices, setTtsEnabled } from '../services/tts'
import {
  playEmotionCelebrate,
  ensureAudioContext,
  type EmotionSfxId,
} from '../services/audio'
import { useEmotionLog } from '../hooks/useEmotionLog'
import { EmotionJournal } from './EmotionJournal'
import { useProfileStore } from '../store/profileStore'

const COOLDOWN_MS = 2200
const CELE_MS = 3200
const STICKY_MS = 5000

interface ModerateModeShellProps {
  onTeacherOpen: () => void
}

function ParticleField({
  emotionId,
  color,
}: {
  emotionId: ModerateEmotionId
  color: string
}): React.JSX.Element {
  if (emotionId === 'joy') {
    // 金色煙花 + confetti + sparkle
    return (
      <>
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i / 16) * Math.PI * 2
          const dist = 120 + (i % 4) * 50
          return (
            <div
              key={`fw-${i}`}
              className="absolute left-1/2 top-1/2 w-3 h-3 rounded-full animate-mod-firework"
              style={
                {
                  backgroundColor: i % 2 === 0 ? color : '#FDE68A',
                  boxShadow: `0 0 12px ${color}`,
                  animationDelay: `${(i % 5) * 0.04}s`,
                  '--tx': `${Math.cos(angle) * dist}px`,
                  '--ty': `${Math.sin(angle) * dist}px`,
                } as React.CSSProperties
              }
            />
          )
        })}
        {Array.from({ length: 28 }).map((_, i) => (
          <div
            key={`cf-${i}`}
            className="absolute rounded-sm animate-confetti-fall"
            style={
              {
                width: `${8 + (i % 4) * 5}px`,
                height: `${12 + (i % 3) * 5}px`,
                left: `${(i * 3.6) % 100}%`,
                top: '-24px',
                backgroundColor: i % 3 === 0 ? '#FBBF24' : i % 3 === 1 ? color : '#FDE68A',
                animationDelay: `${(i % 8) * 0.06}s`,
                animationDuration: `${1.4 + (i % 4) * 0.2}s`,
                '--drift': `${(i % 2 === 0 ? 1 : -1) * (20 + (i % 5) * 10)}px`,
                '--spin': `${(i % 2 === 0 ? 1 : -1) * (200 + (i % 4) * 50)}deg`,
              } as React.CSSProperties
            }
          />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`sp-${i}`}
            className="absolute text-4xl animate-mod-sparkle"
            style={{
              left: `${12 + (i * 11) % 80}%`,
              top: `${18 + (i % 4) * 16}%`,
              animationDelay: `${0.1 + i * 0.08}s`,
            }}
            aria-hidden
          >
            ✨
          </div>
        ))}
      </>
    )
  }

  if (emotionId === 'sadness') {
    return (
      <>
        {Array.from({ length: 22 }).map((_, i) => (
          <div
            key={`rain-${i}`}
            className="absolute rounded-full animate-mod-rain"
            style={
              {
                width: `${6 + (i % 3) * 3}px`,
                height: `${18 + (i % 4) * 6}px`,
                left: `${(i * 4.5) % 100}%`,
                top: 0,
                background: `linear-gradient(to bottom, transparent, ${color})`,
                animationDelay: `${(i % 10) * 0.08}s`,
                animationDuration: `${1.8 + (i % 5) * 0.15}s`,
                '--drift': `${(i % 2 === 0 ? 1 : -1) * (8 + (i % 4) * 6)}px`,
              } as React.CSSProperties
            }
          />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`heart-${i}`}
            className="absolute text-4xl animate-mod-sparkle"
            style={{
              left: `${15 + i * 14}%`,
              top: `${30 + (i % 3) * 12}%`,
              animationDelay: `${0.2 + i * 0.12}s`,
              opacity: 0.85,
            }}
            aria-hidden
          >
            💙
          </div>
        ))}
      </>
    )
  }

  if (emotionId === 'anger') {
    return (
      <>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={`sw-${i}`}
            className="absolute left-1/2 top-1/2 rounded-full border-solid animate-mod-shockwave"
            style={{
              width: 120,
              height: 120,
              borderColor: color,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
        {Array.from({ length: 14 }).map((_, i) => {
          const angle = (i / 14) * Math.PI * 2
          const dist = 100 + (i % 3) * 40
          return (
            <div
              key={`p-${i}`}
              className="absolute left-1/2 top-1/2 w-4 h-4 rounded-full animate-mod-firework"
              style={
                {
                  backgroundColor: i % 2 === 0 ? color : '#FCA5A5',
                  animationDelay: `${i * 0.03}s`,
                  '--tx': `${Math.cos(angle) * dist}px`,
                  '--ty': `${Math.sin(angle) * dist}px`,
                } as React.CSSProperties
              }
            />
          )
        })}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={`bolt-${i}`}
            className="absolute text-5xl animate-mod-star-pop"
            style={{
              left: `${20 + i * 15}%`,
              top: `${25 + (i % 2) * 20}%`,
              animationDelay: `${i * 0.1}s`,
            }}
            aria-hidden
          >
            💢
          </div>
        ))}
      </>
    )
  }

  // fear
  return (
    <>
      <div
        className="absolute inset-0 animate-mod-fear-flash"
        style={{ backgroundColor: color, mixBlendMode: 'screen' }}
        aria-hidden
      />
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={`star-${i}`}
          className="absolute text-5xl animate-mod-star-pop"
          style={{
            left: `${8 + (i * 7.5) % 85}%`,
            top: `${12 + (i % 5) * 14}%`,
            animationDelay: `${(i % 6) * 0.09}s`,
          }}
          aria-hidden
        >
          {i % 2 === 0 ? '⭐' : '💫'}
        </div>
      ))}
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2
        return (
          <div
            key={`r-${i}`}
            className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full animate-mod-ring"
            style={{
              backgroundColor: '#C4B5FD',
              boxShadow: `0 0 16px ${color}`,
              animationDelay: `${i * 0.05}s`,
              marginLeft: Math.cos(angle) * 8,
              marginTop: Math.sin(angle) * 8,
            }}
          />
        )
      })}
    </>
  )
}

export function ModerateModeShell({
  onTeacherOpen,
}: ModerateModeShellProps): React.JSX.Element {
  const [lastId, setLastId] = useState<ModerateEmotionId | null>(null)
  const [clickCount, setClickCount] = useState(0)
  const [pressedId, setPressedId] = useState<ModerateEmotionId | null>(null)
  const [celebration, setCelebration] = useState<{
    emotion: Emotion
    key: number
  } | null>(null)
  const [sticky, setSticky] = useState<Emotion | null>(null)
  const lastTriggerRef = useRef(0)
  const timersRef = useRef<Set<number>>(new Set())

  // Sprint 76 F1-B4c: 情緒日記 — Moderate mode 接入
  // 2x2 chip click → emotion log 入 IDB
  // 5s dedup 自動防 double-click spam
  // profileId undefined → silent no-op (跟 Weak/High/Mid 模式一致)
  const activeProfileId = useProfileStore((s) => s.activeProfileId)
  const emotionLog = useEmotionLog({ profileId: activeProfileId ?? undefined })

  // Sprint 76 F1-B4c: 情緒週報 modal toggle
  const [journalOpen, setJournalOpen] = useState(false)

  const addTimer = useCallback((id: number) => {
    timersRef.current.add(id)
  }, [])

  useEffect(() => {
    setTtsEnabled(true)
    preloadVoices()
    return () => {
      stopTts()
      timersRef.current.forEach((id) => window.clearTimeout(id))
      timersRef.current.clear()
    }
  }, [])

  const handlePick = useCallback(
    async (emotion: Emotion) => {
      const now = Date.now()
      if (now - lastTriggerRef.current < COOLDOWN_MS) return
      lastTriggerRef.current = now

      const id = emotion.id as ModerateEmotionId

      // v3.0.8.7.4 (Sprint 76 F1-B4c): 自動 log emotion 入 journal
      // 5s dedup 自動防 double-click spam (memory rule 10)
      // Moderate 嘅 COOLDOWN_MS = 2200 (button cooldown) 同 useEmotionLog 5s dedup 互補:
      // - COOLDOWN_MS 防 celebration re-trigger 太密
      // - dedup 防 IDB 寫入太密
      // 兩者都設, 防止連續 click 同一個 emotion 寫 5 條 entry
      void emotionLog.log(emotion.id, 'mouse-click')

      setPressedId(id)
      const clearPress = window.setTimeout(() => {
        setPressedId(null)
        timersRef.current.delete(clearPress)
      }, 800)
      addTimer(clearPress)

      await ensureAudioContext()
      playEmotionCelebrate(id as EmotionSfxId)
      speak(emotion.ttsText, { lang: 'zh-HK', rate: 0.88, volume: 1 })

      setLastId(id)
      setClickCount((c) => c + 1)
      setSticky(emotion)

      const showTimer = window.setTimeout(() => {
        setCelebration({ emotion, key: now })
        timersRef.current.delete(showTimer)
        const hideTimer = window.setTimeout(() => {
          setCelebration(null)
          timersRef.current.delete(hideTimer)
        }, CELE_MS)
        addTimer(hideTimer)
      }, 40)
      addTimer(showTimer)

      // sticky 5s from click
      const stickyTimer = window.setTimeout(() => {
        setSticky((cur) => (cur?.id === emotion.id ? null : cur))
        timersRef.current.delete(stickyTimer)
      }, STICKY_MS)
      addTimer(stickyTimer)
    },
    [addTimer],
  )

  return (
    <div
      className={`min-h-dvh flex flex-col bg-slate-950 text-white select-none ${
        celebration && (celebration.emotion.id as ModerateEmotionId) === 'anger'
          ? 'animate-mod-shake'
          : ''
      }`}
    >
      <header className="shrink-0 px-4 pt-4 pb-2 text-center">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-wide">
          而家覺得點？
        </h1>
        <p className="text-base sm:text-lg text-amber-300 mt-1 font-semibold">
          撳一下大圖
        </p>
      </header>

      <main className="flex-1 min-h-0 p-3 sm:p-4 md:p-6 pb-24">
        <div
          className="h-full grid grid-cols-2 grid-rows-2 gap-3 sm:gap-4 md:gap-5 max-w-5xl mx-auto"
          role="group"
          aria-label="揀心情"
        >
          {MODERATE_EMOTIONS.map((emotion) => {
            const isLast = lastId === emotion.id
            const isPressed = pressedId === emotion.id
            return (
              <button
                key={emotion.id}
                type="button"
                data-testid={`moderate-emotion-${emotion.id}`}
                onClick={() => void handlePick(emotion)}
                aria-label={emotion.labelZh}
                className={`
                  relative overflow-hidden
                  rounded-[2rem] sm:rounded-[2.5rem]
                  border-4 sm:border-8
                  flex flex-col items-center justify-center gap-2 sm:gap-3
                  shadow-2xl
                  transition-transform duration-150
                  active:scale-95
                  focus-visible:ring-8 focus-visible:ring-white focus:outline-none
                  touch-manipulation
                  ${isLast ? 'ring-4 ring-white/90' : ''}
                  ${isPressed ? 'animate-mod-btn-jello' : ''}
                `}
                style={{
                  backgroundColor: emotion.hexSoft,
                  borderColor: emotion.hex,
                  color: emotion.hex,
                  minHeight: '38vw',
                }}
              >
                <span
                  className="leading-none drop-shadow-sm"
                  style={{ fontSize: 'clamp(4.5rem, 18vw, 9rem)' }}
                  aria-hidden="true"
                >
                  {emotion.emoji}
                </span>
                <span
                  className="font-black tracking-wider"
                  style={{ fontSize: 'clamp(1.75rem, 6vw, 3.5rem)' }}
                >
                  {emotion.labelZh}
                </span>
              </button>
            )
          })}
        </div>
      </main>

      {/* 底部鞏固條 — 慶祝後仍留 5s */}
      {sticky && (
        <div
          key={`sticky-${sticky.id}-${clickCount}`}
          className="fixed bottom-0 inset-x-0 z-30 px-3 pb-3 pt-2 pointer-events-none animate-mod-sticky-in"
          role="status"
          aria-live="polite"
        >
          <div
            className="mx-auto max-w-xl rounded-2xl border-4 px-4 py-3 flex items-center justify-center gap-3 shadow-2xl"
            style={{
              backgroundColor: sticky.hexSoft,
              borderColor: sticky.hex,
              color: sticky.hex,
            }}
          >
            <span className="text-4xl sm:text-5xl" aria-hidden>
              {sticky.emoji}
            </span>
            <span className="text-xl sm:text-2xl font-black">
              你揀咗：{sticky.labelZh}
            </span>
          </div>
        </div>
      )}

      <footer className="shrink-0 px-3 pb-3 flex justify-end gap-2">
        {/* Sprint 76 F1-B4c: 情緒週報 button (footer 內, 對齊 Weak/High/Mid) */}
        {activeProfileId && (
          <button
            type="button"
            onClick={() => setJournalOpen(true)}
            aria-label="開啟情緒週報"
            data-testid="journal-entry"
            className="px-3 py-2 min-h-[36px] text-xs sm:text-sm rounded-xl bg-amber-500/90 hover:bg-amber-400 text-slate-900 font-bold border border-amber-300 active:scale-95"
          >
            📊 週報
          </button>
        )}
        <button
          type="button"
          onClick={onTeacherOpen}
          data-testid="teacher-entry"
          className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-800/80 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200"
          aria-label="老師設定"
        >
          老師
        </button>
      </footer>

      {/* 全屏慶祝層 */}
      {celebration && (
        <div
          key={celebration.key}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none animate-mod-cele-hold"
          role="status"
          aria-live="assertive"
        >
          {/* 邊框 pulse */}
          <div
            className="absolute inset-0 animate-mod-border-pulse"
            style={
              {
                '--mod-color': celebration.emotion.hex,
              } as React.CSSProperties
            }
            aria-hidden
          />

          {/* 底色 flash */}
          <div
            className="absolute inset-0 animate-trigger-flash"
            style={{
              backgroundColor: celebration.emotion.hex,
              mixBlendMode: 'screen',
            }}
            aria-hidden
          />

          <ParticleField
            emotionId={celebration.emotion.id as ModerateEmotionId}
            color={celebration.emotion.hex}
          />

          {/* 中央大 emoji + 字 */}
          <div
            className="relative z-10"
          >
            {(celebration.emotion.id as ModerateEmotionId) === 'sadness' && (
              <div
                className="absolute inset-0 rounded-[2rem] animate-mod-hug-glow"
                aria-hidden
              />
            )}
            <div
              className="relative px-10 py-8 rounded-[2rem] shadow-2xl border-8 border-white text-center animate-mod-modal-in"
              style={{
                backgroundColor: celebration.emotion.hexSoft,
                color: celebration.emotion.hex,
              }}
            >
              <div
                className="leading-none mb-3 animate-mod-emoji-jello"
                style={{ fontSize: 'clamp(6rem, 28vw, 12rem)' }}
                aria-hidden
              >
                {celebration.emotion.emoji}
              </div>
              <div
                className="font-black"
                style={{ fontSize: 'clamp(2.5rem, 10vw, 5rem)' }}
              >
                {celebration.emotion.labelZh}
              </div>
              <div className="mt-2 text-lg sm:text-xl font-bold opacity-80">
                做得好！
              </div>
            </div>
          </div>

          {/* rings */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={`ring-${i}`}
              className="absolute left-1/2 top-1/2 rounded-full border-4 animate-mod-ring"
              style={{
                width: 160,
                height: 160,
                borderColor: celebration.emotion.hex,
                animationDelay: `${0.15 + i * 0.2}s`,
              }}
              aria-hidden
            />
          ))}
        </div>
      )}

      {/* Sprint 76 F1-B4c: 情緒週報 modal */}
      {journalOpen && activeProfileId && (
        <EmotionJournal
          profileId={activeProfileId}
          onClose={() => setJournalOpen(false)}
        />
      )}
    </div>
  )
}

export default ModerateModeShell

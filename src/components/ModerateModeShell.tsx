/**
 * ModerateModeShell — 中度學生主畫面
 *
 * 設計原則（減認知負荷）:
 *  - 直入 2×2 四格：開心 / 傷心 / 嬲 / 驚
 *  - 超大 touch target、淨中文、大 emoji
 *  - 預設 AAC：淨手指撳，無鏡頭 / 無空中筆
 *  - 短 TTS + 成功音 + 全屏慶祝
 *  - 學生面無設定堆；老師入口細角落
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MODERATE_EMOTIONS,
  type Emotion,
  type ModerateEmotionId,
} from '../constants/emotions'
import { speak, stopTts, preloadVoices, setTtsEnabled } from '../services/tts'
import { playSuccessSound, ensureAudioContext } from '../services/audio'

const COOLDOWN_MS = 1800

interface ModerateModeShellProps {
  /** 老師入口：開進階模式選單 */
  onTeacherOpen: () => void
}

export function ModerateModeShell({
  onTeacherOpen,
}: ModerateModeShellProps): React.JSX.Element {
  const [lastId, setLastId] = useState<ModerateEmotionId | null>(null)
  const [clickCount, setClickCount] = useState(0)
  const [celebration, setCelebration] = useState<{
    emotion: Emotion
    key: number
  } | null>(null)
  const lastTriggerRef = useRef(0)
  const timersRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    // 中度：TTS 永遠開
    setTtsEnabled(true)
    preloadVoices()
    return () => {
      stopTts()
      timersRef.current.forEach((id) => window.clearTimeout(id))
      timersRef.current.clear()
    }
  }, [])

  const handlePick = useCallback(async (emotion: Emotion) => {
    const now = Date.now()
    if (now - lastTriggerRef.current < COOLDOWN_MS) return
    lastTriggerRef.current = now

    await ensureAudioContext()
    playSuccessSound()
    speak(emotion.ttsText, { lang: 'zh-HK', rate: 0.9, volume: 1 })

    setLastId(emotion.id as ModerateEmotionId)
    setClickCount((c) => c + 1)

    const showTimer = window.setTimeout(() => {
      setCelebration({ emotion, key: now })
      timersRef.current.delete(showTimer)
      const hideTimer = window.setTimeout(() => {
        setCelebration(null)
        timersRef.current.delete(hideTimer)
      }, 2000)
      timersRef.current.add(hideTimer)
    }, 80)
    timersRef.current.add(showTimer)
  }, [])

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-white select-none">
      {/* 極簡提示 — 一句話 */}
      <header className="shrink-0 px-4 pt-4 pb-2 text-center">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-wide">
          而家覺得點？
        </h1>
        <p className="text-base sm:text-lg text-amber-300 mt-1 font-semibold">
          撳一下大圖
        </p>
      </header>

      {/* 2×2 超大情緒格 */}
      <main className="flex-1 min-h-0 p-3 sm:p-4 md:p-6">
        <div
          className="h-full grid grid-cols-2 grid-rows-2 gap-3 sm:gap-4 md:gap-5 max-w-5xl mx-auto"
          role="group"
          aria-label="揀心情"
        >
          {MODERATE_EMOTIONS.map((emotion) => {
            const isLast = lastId === emotion.id
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
                  ${isLast ? 'scale-[1.02] ring-4 ring-white/80' : ''}
                `}
                style={{
                  backgroundColor: emotion.hexSoft,
                  borderColor: emotion.hex,
                  color: emotion.hex,
                  minHeight: '42vw',
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

      {/* 老師入口 — 細、角落、唔搶學生注意 */}
      <footer className="shrink-0 px-3 pb-3 flex justify-end safe-pb">
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

      {/* 全屏慶祝 */}
      {lastId && (
        <div
          key={`flash-${lastId}-${clickCount}`}
          className="fixed inset-0 pointer-events-none z-40 animate-trigger-flash"
          style={{
            backgroundColor: MODERATE_EMOTIONS.find((e) => e.id === lastId)?.hex,
            mixBlendMode: 'screen',
          }}
          aria-hidden="true"
        />
      )}

      {celebration && (
        <div
          key={celebration.key}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none animate-celebration-pop"
          role="status"
          aria-live="polite"
        >
          <div
            className="px-10 py-8 rounded-[2rem] shadow-2xl border-8 border-white text-center animate-celebration-scale"
            style={{
              backgroundColor: celebration.emotion.hexSoft,
              color: celebration.emotion.hex,
            }}
          >
            <div
              className="leading-none mb-3"
              style={{ fontSize: 'clamp(6rem, 28vw, 12rem)' }}
            >
              {celebration.emotion.emoji}
            </div>
            <div
              className="font-black"
              style={{ fontSize: 'clamp(2.5rem, 10vw, 5rem)' }}
            >
              {celebration.emotion.labelZh}
            </div>
          </div>

          {/* confetti bits */}
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={`c-${i}`}
              className="absolute rounded-sm animate-confetti-fall"
              style={
                {
                  width: `${10 + (i % 3) * 4}px`,
                  height: `${14 + (i % 3) * 4}px`,
                  left: `${(i * 5.5) % 100}%`,
                  top: '-20px',
                  backgroundColor: celebration.emotion.hex,
                  animationDelay: `${(i % 6) * 0.07}s`,
                  '--drift': `${(i % 2 === 0 ? 1 : -1) * (16 + (i % 4) * 8)}px`,
                  '--spin': `${(i % 2 === 0 ? 1 : -1) * (160 + (i % 3) * 40)}deg`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default ModerateModeShell

/**
 * WeakModeCelebration — Trigger 5-layer feedback animation (v3.0.7.3-7.5)
 *
 * Layer 1: trigger-flash 全屏 emotion color (1.2s)
 * Layer 2: emoji flying 從 chip 飛到中央 (0.9s)
 * Layer 3: 中央 affirmation modal bounce (0.7s)
 * Layer 4: 6 條 radial star burst lines (0.6s)
 * Layer 5: 24 個 confetti paper bits 從天而降 (1.6s)
 * Layer 6: 8 個 particle burst 從中央散出 (1.2s)
 *
 * R30: prefers-reduced-motion media query 已經 override 全部 animation 0.01ms
 */

import { EMOTIONS_BY_ID, type Emotion, type EmotionId } from '../../constants/emotions'

export interface WeakModeCelebrationProps {
  celebration: { emotion: Emotion; key: number; chipRect: { x: number; y: number } | null } | null
  lastClicked: EmotionId | 'skip' | null
  clickCount: number
}

export function WeakModeCelebration({
  celebration,
  lastClicked,
  clickCount,
}: WeakModeCelebrationProps): React.JSX.Element {
  return (
    <>
      {/*
        Layer 1: Trigger flash overlay — 全屏 emotion color, 1.2s
      */}
      {lastClicked && lastClicked !== 'skip' && (() => {
        const emotion = EMOTIONS_BY_ID[lastClicked]
        if (!emotion) return null
        return (
          <div
            key={lastClicked + clickCount}
            className="fixed inset-0 pointer-events-none z-40 animate-trigger-flash"
            style={{ backgroundColor: emotion.hex, mixBlendMode: 'screen' }}
            aria-hidden="true"
          />
        )
      })()}

      {/*
        Layer 2-6: Celebration modal (200ms 延遲, 1.8s 自動消失)
      */}
      {celebration && (
        <div
          key={celebration.key}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none animate-celebration-pop"
          aria-hidden="true"
        >
          {/* Layer 3: Modal emoji + label */}
          <div
            className="px-8 py-6 rounded-3xl shadow-2xl border-4 border-white/40 text-center animate-celebration-scale relative z-10"
            style={{
              backgroundColor: celebration.emotion.hexSoft,
              color: celebration.emotion.hex,
            }}
          >
            <div className="text-9xl leading-none mb-2">{celebration.emotion.emoji}</div>
            <div className="text-2xl font-bold">{celebration.emotion.labelZh}</div>
            <div className="text-sm opacity-80 mt-1">{celebration.emotion.labelEn}</div>
          </div>

          {/* Layer 2: Emoji flying 從 chip 飛到中央 */}
          {celebration.chipRect && (
            <div
              className="absolute text-8xl animate-emoji-fly"
              style={{
                left: `${celebration.chipRect.x}px`,
                top: `${celebration.chipRect.y}px`,
                '--start-x': `${celebration.chipRect.x}px`,
                '--start-y': `${celebration.chipRect.y}px`,
              } as React.CSSProperties}
              aria-hidden="true"
            >
              {celebration.emotion.emoji}
            </div>
          )}

          {/* Layer 4: Star burst — 6 條 radial lines 由中央射出 */}
          {Array.from({ length: 6 }).map((_, i) => {
            const angle = (i / 6) * Math.PI * 2
            const length = 220
            const tx = Math.cos(angle) * length
            const ty = Math.sin(angle) * length
            return (
              <div
                key={`star-${i}`}
                className="absolute w-1.5 h-12 rounded-full animate-celebration-star"
                style={{
                  background: `linear-gradient(to bottom, transparent, ${celebration.emotion.hex}, white)`,
                  '--tx': `${tx}px`,
                  '--ty': `${ty}px`,
                  boxShadow: `0 0 8px ${celebration.emotion.hex}`,
                } as React.CSSProperties}
              />
            )
          })}

          {/* Layer 5: Confetti rain — 24 paper bits */}
          {Array.from({ length: 24 }).map((_, i) => {
            const shapes = ['rounded-sm', 'rounded-full', 'rounded-none']
            const shape = shapes[i % 3]
            const size = 8 + (i % 3) * 4
            const left = (i * 4.17) % 100
            const delay = (i % 8) * 0.08
            const duration = 1.5 + (i % 3) * 0.2
            return (
              <div
                key={`confetti-${i}`}
                className={`absolute ${shape} animate-confetti-fall`}
                style={{
                  width: `${size}px`,
                  height: `${size * 1.6}px`,
                  left: `${left}%`,
                  top: '-20px',
                  backgroundColor: celebration.emotion.hex,
                  animationDelay: `${delay}s`,
                  animationDuration: `${duration}s`,
                  '--drift': `${(i % 2 === 0 ? 1 : -1) * (20 + (i % 5) * 8)}px`,
                  '--spin': `${(i % 2 === 0 ? 1 : -1) * (180 + (i % 3) * 60)}deg`,
                } as React.CSSProperties}
              />
            )
          })}

          {/* Layer 6: Particle burst — 8 個圓點散出 */}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2
            const distance = 180
            const tx = Math.cos(angle) * distance
            const ty = Math.sin(angle) * distance
            return (
              <div
                key={`particle-${i}`}
                className="absolute w-4 h-4 rounded-full animate-celebration-particle"
                style={{
                  backgroundColor: celebration.emotion.hex,
                  '--tx': `${tx}px`,
                  '--ty': `${ty}px`,
                  boxShadow: `0 0 12px ${celebration.emotion.hex}`,
                } as React.CSSProperties}
              />
            )
          })}
        </div>
      )}
    </>
  )
}

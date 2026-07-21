/**
 * WeakModeChipGrid — 3×3 emotion grid + webcam background + finger cursor
 *
 * Layout:
 *   <div> stage (relative, flex-1, max-w-3xl)
 *     <video> webcam background layer (absolute, mirror flip)
 *     <div> chip grid (z-10, auto-rows-fr)
 *     <FingerCursor> overlay
 *   </div>
 *
 * Family F1: webcam video ref 永遠掛喺 DOM, 即使 OFF 都保留 element,
 *   咁 useHandTracker video ref stable(F2 reset-on-render 唔 trigger)
 */

import type { RefObject } from 'react'
import { GRID_LAYOUT, type Emotion, type EmotionId } from '../../constants/emotions'
import type { ChipProps } from '../../hooks/useFingerHover'

export interface WeakModeChipGridProps {
  webcamRef: RefObject<HTMLVideoElement | null>
  showWebcam: boolean
  webcamOpacity: number
  hoveredId: string | null
  lastClicked: EmotionId | 'skip' | null
  progress: number
  getChipProps: (id: string) => ChipProps
  /** Finger tracker 狀態 */
  hand: {
    isReady: boolean
    indexFingerTip: { x: number; y: number } | null
  }
}

export function WeakModeChipGrid({
  webcamRef,
  showWebcam,
  webcamOpacity,
  hoveredId,
  lastClicked,
  progress,
  getChipProps,
  hand,
}: WeakModeChipGridProps): React.JSX.Element {
  return (
    <div className="relative w-full max-w-3xl mx-auto flex-1 min-h-0 flex flex-col">
      {/*
        Webcam image layer (full stage background, mirror flip)
        永遠掛喺 DOM, 即使 OFF 都保留 element
      */}
      <video
        ref={webcamRef}
        className="absolute inset-0 w-full h-full object-cover rounded-2xl pointer-events-none transition-opacity duration-300"
        style={{
          opacity: showWebcam ? webcamOpacity / 100 : 0,
          transform: 'scaleX(-1)',
        }}
        autoPlay
        playsInline
        muted
        aria-hidden="true"
      />

      {/*
        Chip grid layer: z-index 1, 永遠喺 webcam 之上
        auto-rows-fr 確保每 row 平分高度
      */}
      <div
        className="relative z-10 grid grid-cols-3 auto-rows-fr gap-2 sm:gap-3 h-full p-2"
        role="grid"
        aria-label="Plutchik 8 情緒選擇"
      >
        {GRID_LAYOUT.map((cell) => {
          const isSkip = cell.id === 'skip'
          const isHovered = hoveredId === cell.id
          const isLastClicked = lastClicked === cell.id
          const cellProgress = isHovered ? progress : 0
          const props = getChipProps(cell.id)

          return (
            <button
              key={cell.id}
              type="button"
              role="gridcell"
              {...props}
              data-finger-target={cell.id}
              className={`
                group relative
                min-h-[120px] sm:min-h-[160px]
                p-2 sm:p-3
                rounded-2xl sm:rounded-3xl
                border-2 sm:border-4
                flex flex-col items-center justify-center
                transition-all duration-200 ease-out
                shadow-xl
                focus-visible:ring-4 focus-visible:ring-amber-400 focus:outline-none
                ${isSkip
                  ? 'bg-slate-800/80 border-slate-600 text-slate-400'
                  : ''
                }
                ${!isSkip && isLastClicked ? 'animate-bounce' : ''}
                ${isHovered && !isSkip ? 'scale-110 shadow-2xl z-20' : 'hover:scale-105'}
                active:scale-95
              `}
              style={
                isSkip
                  ? undefined
                  : {
                      backgroundColor: isHovered ? cell.hex : cell.hexSoft,
                      borderColor: isHovered || isLastClicked ? cell.hex : 'transparent',
                      color: cell.hex,
                    }
              }
              aria-label={
                isSkip
                  ? '跳過'
                  : `${cell.labelZh} ${cell.labelEn} (${(cell as Emotion).ttsText})`
              }
            >
              {/* Progress ring (dwell visualization, R32 + Bug 4 finger dwell) */}
              {!isSkip && isHovered && cellProgress > 0 && (
                <svg
                  className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                  aria-hidden="true"
                >
                  <rect
                    x="4"
                    y="4"
                    width="calc(100% - 8px)"
                    height="calc(100% - 8px)"
                    rx="16"
                    fill="none"
                    stroke="white"
                    strokeOpacity="0.95"
                    strokeWidth="6"
                    strokeDasharray={`${cellProgress * 100} 100`}
                    style={{ pathLength: 100 } as React.CSSProperties}
                  />
                </svg>
              )}

              {/*
                Bug 2 fix v3.0.7: emoji text-7xl / sm:text-8xl
                chip 用 flex-1 + auto-rows-fr 後, 高度由 row 控制
              */}
              <div
                className={`
                  text-7xl sm:text-8xl leading-none
                  ${isHovered && !isSkip ? 'animate-pulse' : ''}
                  transition-transform duration-200
                `}
                aria-hidden="true"
              >
                {cell.emoji}
              </div>
              <div className="text-sm sm:text-base font-bold leading-tight mt-1">
                {cell.labelZh}
              </div>
              <div className="text-[9px] sm:text-[10px] opacity-70 leading-tight hidden sm:block">
                {cell.labelEn}
              </div>
            </button>
          )
        })}
      </div>

      {/* Finger cursor overlay(v3.0.7 加強)
          - 加大粒 (w-10 h-10)
          - 3 層 ring: 內核 + ping + outer glow
          - 👆 emoji 入 core 清楚指「呢個就係你食指」
          - pointer-events-none 唔阻擋 elementFromPoint
      */}
      {hand.isReady && hand.indexFingerTip && showWebcam && webcamRef.current && (() => {
        const v = webcamRef.current
        const rect = v.getBoundingClientRect()
        // Mirror flip 同 useFingerHoverOnElement 一致
        const screenX = (1 - hand.indexFingerTip.x) * rect.width + rect.left
        const screenY = hand.indexFingerTip.y * rect.height + rect.top
        return (
          <div
            className="fixed pointer-events-none z-50"
            style={{
              left: `${screenX}px`,
              top: `${screenY}px`,
              transform: 'translate(-50%, -50%)',
            }}
            aria-hidden="true"
          >
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-xl" />
              <div className="absolute inset-0 rounded-full bg-amber-400/50 animate-ping" />
              <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 border-[3px] border-white shadow-2xl flex items-center justify-center">
                <span className="text-lg leading-none">👆</span>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

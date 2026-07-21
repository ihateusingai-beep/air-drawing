/**
 * WeakModeStatus — Status row (instruction text + webcam init status)
 * 純 status text, 唔 include feedback strip / slider
 * (Feedback strip 同 slider 已拆 WeakModeFeedbackStrip / WeakModeSlider)
 */

import { EMOTIONS_BY_ID, type EmotionId } from '../../constants/emotions'

export interface WeakModeStatusProps {
  isIpad: boolean
  showWebcam: boolean
  hand: {
    isReady: boolean
    error: string | null
  }
  webcamError: string | null
  dwellTimeMs: number
}

export function WeakModeStatus({
  isIpad,
  showWebcam,
  hand,
  webcamError,
  dwellTimeMs,
}: WeakModeStatusProps): React.JSX.Element {
  return (
    <div className="text-center shrink-0">
      <p className="text-slate-300 text-sm sm:text-base">
        {isIpad
          ? '👆 用手指 click 一個表情'
          : showWebcam && hand.isReady
            ? `👆 將手指 / 滑鼠停留喺一個表情 ${(dwellTimeMs / 1000).toFixed(1)} 秒, 或者直接 click`
            : `🖱️ 將滑鼠停留喺一個表情 ${(dwellTimeMs / 1000).toFixed(1)} 秒, 或者直接 click`}
      </p>
      {showWebcam && (
        <p className="text-xs text-slate-500 mt-1" aria-live="polite">
          {webcamError
            ? `⚠️ ${webcamError}`
            : hand.error
              ? `⚠️ 手指偵測錯誤: ${hand.error}`
              : hand.isReady
                ? '🖐️ 手指偵測就緒 — 鏡頭前舉起食指, 見到 👆 跟住你'
                : '⌛ 手指偵測啟動中…(首次需下載 MediaPipe model, 約 5-10 秒)'}
        </p>
      )}
    </div>
  )
}

export interface WeakModeFeedbackStripProps {
  celebrationActive: boolean
  lastClicked: EmotionId | 'skip' | null
}

export function WeakModeFeedbackStrip({
  celebrationActive,
  lastClicked,
}: WeakModeFeedbackStripProps): React.JSX.Element {
  return (
    <div
      className="min-h-[3rem] flex items-center justify-center shrink-0"
      aria-live="polite"
      aria-atomic="true"
    >
      {!celebrationActive && lastClicked && lastClicked !== 'skip' && (
        <div
          className="px-4 py-2 rounded-full text-sm font-semibold shadow-lg animate-feedback-fade-in"
          style={{
            backgroundColor: EMOTIONS_BY_ID[lastClicked].hexSoft,
            color: EMOTIONS_BY_ID[lastClicked].hex,
          }}
        >
          ✨ 你揀咗: {EMOTIONS_BY_ID[lastClicked].emoji}{' '}
          {EMOTIONS_BY_ID[lastClicked].labelZh} ·{' '}
          {EMOTIONS_BY_ID[lastClicked].labelEn}
        </div>
      )}
      {!celebrationActive && lastClicked === 'skip' && (
        <div className="px-4 py-2 rounded-full text-sm text-slate-400 bg-slate-800">
          已跳過
        </div>
      )}
    </div>
  )
}

export interface WeakModeSliderProps {
  showWebcam: boolean
  webcamOpacity: number
  onChange: (v: number) => void
}

export function WeakModeSlider({
  showWebcam,
  webcamOpacity,
  onChange,
}: WeakModeSliderProps): React.JSX.Element | null {
  if (!showWebcam) return null
  return (
    <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-400 shrink-0">
      <span>👤 鏡頭背景:</span>
      <input
        type="range"
        min={0}
        max={100}
        value={webcamOpacity}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 accent-amber-400"
        aria-label="鏡頭背景透明度"
      />
      <span className="font-mono">{webcamOpacity}%</span>
      {webcamOpacity > 70 && (
        <span className="text-amber-300 ml-1" role="status">
          ⚠️ 過高可能遮 chip
        </span>
      )}
    </div>
  )
}

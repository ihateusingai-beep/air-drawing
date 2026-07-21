/**
 * Web Audio engine — 純函數封裝。
 *
 * 對應 source §1 (4 個 playTone wrapper + AudioContext singleton)。
 *
 * AudioContext 用 module-level singleton(memory rule 5:React StrictMode 雙 mount 安全),
 * 第一次 user gesture (click / touch) 之後 audioCtx.state 由 'suspended' 變 'running'。
 *
 * 對應 R8 緩解。
 */

let audioCtxSingleton: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (audioCtxSingleton) return audioCtxSingleton
  const Ctx = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  audioCtxSingleton = new Ctx()
  return audioCtxSingleton
}

/** Resume audio context (iOS PWA 需 user gesture 觸發) */
export async function ensureAudioContext(): Promise<void> {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      /* ignore */
    }
  }
}

/**
 * 播放一個 tone。失敗 silent (R33 模式)。
 */
export function playTone(
  freq: number,
  type: OscillatorType = 'sine',
  duration: number = 0.1,
): void {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
  } catch {
    /* silent */
  }
}

/** Click 短音(C5) */
export function playClickSound(): void {
  playTone(523.25, 'sine', 0.1)
}

/** Success 上行和弦(C5-E5-G5) */
export function playSuccessSound(): void {
  playTone(523.25, 'sine', 0.1)
  setTimeout(() => playTone(659.25, 'sine', 0.1), 80)
  setTimeout(() => playTone(783.99, 'sine', 0.2), 160)
}

/** Clear 沉穩低音(150Hz sawtooth) */
export function playClearSound(): void {
  playTone(150, 'sawtooth', 0.3)
}

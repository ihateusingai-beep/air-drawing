/**
 * Web Audio engine — 純函數封裝。
 *
 * 對應 source §1 (4 個 playTone wrapper + AudioContext singleton)。
 * v3.0.9: 中度模式分情緒慶祝音效
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
  volume: number = 0.12,
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
    gain.gain.setValueAtTime(volume, ctx.currentTime)
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

/**
 * 中度模式 — 每情緒專屬慶祝音（「中獎感」）
 * joy: 上行大三 + 高叮
 * sadness: 柔和下行
 * anger: 鼓點感 square
 * fear: 叮叮 sparkle
 */
export type EmotionSfxId = 'joy' | 'sadness' | 'anger' | 'fear'

export function playEmotionCelebrate(id: EmotionSfxId): void {
  switch (id) {
    case 'joy': {
      // 開心：C-E-G-C 上行 + 叮
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((f, i) => {
        setTimeout(() => playTone(f, 'sine', 0.18, 0.16), i * 90)
      })
      setTimeout(() => playTone(1568, 'triangle', 0.25, 0.1), 400)
      break
    }
    case 'sadness': {
      // 傷心：柔和 A-F-E 下行（安慰感，唔淒涼到嚇親）
      const notes = [440, 349.23, 329.63]
      notes.forEach((f, i) => {
        setTimeout(() => playTone(f, 'sine', 0.35, 0.1), i * 160)
      })
      break
    }
    case 'anger': {
      // 嬲：短促鼓點
      const hits = [150, 150, 200, 120]
      hits.forEach((f, i) => {
        setTimeout(() => playTone(f, 'square', 0.08, 0.08), i * 100)
      })
      setTimeout(() => playTone(98, 'sawtooth', 0.25, 0.07), 420)
      break
    }
    case 'fear': {
      // 驚：高叮叮 + 顫音感
      const notes = [987.77, 1318.5, 987.77, 1568]
      notes.forEach((f, i) => {
        setTimeout(() => playTone(f, 'triangle', 0.12, 0.12), i * 70)
      })
      break
    }
    default:
      playSuccessSound()
  }
}

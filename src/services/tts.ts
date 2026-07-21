/**
 * TTS service — Web Speech API wrapper.
 *
 * E18: TTS 語音(PLAN §11.1, 升做 Wave 1 core by v2.0 pivot)
 *
 * iOS PWA 限制(R33 緩解):
 *   - iOS Safari speechSynthesis 喺 PWA standalone mode 仍 work(2026-07)
 *   - 預載常用情緒詞(iOS TTS 預載較慢)
 *   - 用戶可關 TTS(per profile)
 *   - Failed silently fallback 唔 throw
 *
 * 用法:
 *   import { speak, setTtsEnabled, isTtsSupported } from '@/services/tts'
 *   speak('我覺得係快樂', { lang: 'zh-Hant' })
 *   setTtsEnabled(false)
 */

export interface SpeakOptions {
  lang?: string // BCP-47 e.g. 'zh-Hant', 'zh-HK', 'en-US'
  rate?: number // 0.1 - 10, default 1
  pitch?: number // 0 - 2, default 1
  volume?: number // 0 - 1, default 1
}

let ttsEnabled = true
let preferredVoice: SpeechSynthesisVoice | null = null
let initTried = false

function isSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function getSynthesis(): SpeechSynthesis | null {
  if (!isSupported()) return null
  return window.speechSynthesis
}

function pickVoice(synth: SpeechSynthesis, langHint: string): SpeechSynthesisVoice | null {
  const voices = synth.getVoices()
  if (voices.length === 0) return null
  // 1) exact match
  let v = voices.find((vv) => vv.lang === langHint)
  if (v) return v
  // 2) prefix match (e.g. 'zh-Hant' → 'zh-HK' / 'zh-TW' / 'zh-CN')
  const prefix = langHint.split('-')[0]
  v = voices.find((vv) => vv.lang.startsWith(prefix))
  return v ?? null
}

function initVoices(): void {
  if (initTried) return
  initTried = true
  const synth = getSynthesis()
  if (!synth) return
  // iOS 嘅 getVoices() 喺 init 之後先 return list,onvoiceschanged 監聽
  const tryPick = (): void => {
    preferredVoice =
      pickVoice(synth, 'zh-Hant') ??
      pickVoice(synth, 'zh-HK') ??
      pickVoice(synth, 'zh-TW') ??
      pickVoice(synth, 'zh-CN') ??
      pickVoice(synth, 'en-US')
  }
  tryPick()
  if (typeof synth.onvoiceschanged !== 'undefined') {
    synth.onvoiceschanged = () => {
      tryPick()
    }
  }
}

/** 預載 voices(iOS PWA 改善 cold start) */
export function preloadVoices(): void {
  initVoices()
}

export function isTtsSupported(): boolean {
  return isSupported()
}

export function setTtsEnabled(enabled: boolean): void {
  ttsEnabled = enabled
  if (!enabled) {
    const synth = getSynthesis()
    if (synth) synth.cancel()
  }
}

export function getTtsEnabled(): boolean {
  return ttsEnabled
}

/**
 * 講嘢。如果 TTS 唔 support / disabled / 冇 text,都 silently 失敗。
 * 唔 throw,符合 R33 緩解(iOS PWA 偶有 quirk)。
 */
export function speak(text: string, options: SpeakOptions = {}): void {
  if (!ttsEnabled) return
  if (!text || text.trim().length === 0) return
  const synth = getSynthesis()
  if (!synth) return

  // 預載 voices 喺第一次 speak
  if (!initTried) initVoices()

  // iOS bug: 連續 cancel + speak 會丟 utterance,
  // 等 microtask 先 cancel
  if (synth.speaking || synth.pending) {
    synth.cancel()
  }

  try {
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = options.lang ?? 'zh-Hant'
    utter.rate = options.rate ?? 1.0
    utter.pitch = options.pitch ?? 1.0
    utter.volume = options.volume ?? 1.0
    if (preferredVoice) utter.voice = preferredVoice
    // 加 error handler,避免 iOS 喺 PWA 模式 throw
    utter.onerror = () => {
      /* silent */
    }
    synth.speak(utter)
  } catch {
    /* silent — R33 fallback */
  }
}

/** Stop any current TTS */
export function stopTts(): void {
  const synth = getSynthesis()
  if (synth) synth.cancel()
}

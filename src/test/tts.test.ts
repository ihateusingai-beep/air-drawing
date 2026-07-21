/**
 * tts service — isTtsSpeaking / speak / stopTts mock test (plan §5 R33)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { isTtsSpeaking, setTtsEnabled, getTtsEnabled, stopTts, speak } from '../services/tts'

describe('tts service', () => {
  beforeEach(() => {
    setTtsEnabled(true)
  })

  it('getTtsEnabled 預設 true', () => {
    expect(getTtsEnabled()).toBe(true)
  })

  it('setTtsEnabled false → getTtsEnabled false', () => {
    setTtsEnabled(false)
    expect(getTtsEnabled()).toBe(false)
  })

  it('isTtsSpeaking 起始 false (mock 冇 speaking)', () => {
    expect(isTtsSpeaking()).toBe(false)
  })

  it('stopTts 唔 throw', () => {
    expect(() => stopTts()).not.toThrow()
  })

  it('TTS 關咗時 speak 唔 throw (R33 iOS PWA fallback)', () => {
    setTtsEnabled(false)
    expect(() => speak('你好')).not.toThrow()
  })
})

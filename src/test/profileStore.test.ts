/**
 * profileStore — F1 default state + clampDwellTimeMs
 *
 * Critical: 唔正確 default → 所有 mode 嘅 dwell time 崩潰
 */

import { describe, it, expect } from 'vitest'
import { clampDwellTimeMs, dwellWarningLevel, DWELL_TIME_MIN_MS, DWELL_TIME_MAX_MS, DWELL_TIME_DEFAULT_MS } from '../store/profileStore'

describe('profileStore / dwell time bounds', () => {
  describe('clampDwellTimeMs (memory rule 3 — SemVer invariant)', () => {
    it('預設值喺範圍中間', () => {
      expect(DWELL_TIME_DEFAULT_MS).toBeGreaterThanOrEqual(DWELL_TIME_MIN_MS)
      expect(DWELL_TIME_DEFAULT_MS).toBeLessThanOrEqual(DWELL_TIME_MAX_MS)
    })

    it('value < MIN 自動 clamp 上 MIN', () => {
      expect(clampDwellTimeMs(0)).toBe(DWELL_TIME_MIN_MS)
      expect(clampDwellTimeMs(100)).toBe(DWELL_TIME_MIN_MS)
    })

    it('value > MAX 自動 clamp 下 MAX', () => {
      expect(clampDwellTimeMs(99999)).toBe(DWELL_TIME_MAX_MS)
      expect(clampDwellTimeMs(DWELL_TIME_MAX_MS + 1000)).toBe(DWELL_TIME_MAX_MS)
    })

    it('value 喺範圍內 round 返整數', () => {
      expect(clampDwellTimeMs(1234)).toBe(1234)
      expect(clampDwellTimeMs(1234.7)).toBe(1235)
    })

    it('v3.0.7.4 fix: 預設 1500 配合 TTS 句長 1.5-2.5s', () => {
      expect(DWELL_TIME_DEFAULT_MS).toBe(1500)
    })

    it('v3.0.7.4 fix: 範圍 0.5-2.5s 而唔係 0.3-1.0s', () => {
      expect(DWELL_TIME_MIN_MS).toBe(500)
      expect(DWELL_TIME_MAX_MS).toBe(2500)
    })
  })

  describe('dwellWarningLevel', () => {
    it('range 內 medium', () => {
      expect(dwellWarningLevel(1500)).toBeNull()
    })

    it('< 800ms 太快 (TTS 句未讀完)', () => {
      expect(dwellWarningLevel(700)).toBe('fast')
    })

    it('> 2000ms 太慢 (fast learner 嫌悶)', () => {
      expect(dwellWarningLevel(2100)).toBe('slow')
    })
  })
})

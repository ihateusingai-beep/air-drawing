/**
 * Plutchik 8 emotion constants — 100% coverage (plan §11.3 C1)
 * Emotion vocabulary 係全 app 嘅 source of truth: 8 個 emotion 必須齊 + ID unique
 */

import { describe, it, expect } from 'vitest'
import { EMOTIONS_BY_ID, GRID_LAYOUT, SKIP_CELL, MODERATE_EMOTIONS, MODERATE_EMOTIONS_BY_ID, type EmotionId } from '../constants/emotions'

describe('Plutchik 8 emotions', () => {
  it('有 8 個 emotion ID + 1 skip cell', () => {
    const ids = Object.keys(EMOTIONS_BY_ID) as EmotionId[]
    expect(ids).toHaveLength(8)
    expect(ids).toEqual(
      expect.arrayContaining(['joy', 'sadness', 'anger', 'fear', 'trust', 'disgust', 'surprise', 'anticipation']),
    )
  })

  it('每個 emotion 必須有 emoji + 中英文 label + 顏色', () => {
    for (const id of Object.keys(EMOTIONS_BY_ID) as EmotionId[]) {
      const e = EMOTIONS_BY_ID[id]
      expect(e.emoji, `${id} 必須有 emoji`).toBeTruthy()
      expect(e.labelZh, `${id} 必須有中文 label`).toBeTruthy()
      expect(e.labelEn, `${id} 必須有英文 label`).toBeTruthy()
      expect(e.hex, `${id} 必須有 hex 顏色`).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(e.hexSoft, `${id} 必須有 hexSoft 背景色`).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(e.ttsText, `${id} 必須有 TTS 讀出字串`).toBeTruthy()
    }
  })

  it('所有 emotion ID 都 unique', () => {
    const ids = Object.keys(EMOTIONS_BY_ID) as EmotionId[]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('GRID_LAYOUT 3×3 = 8 emotion + 1 skip', () => {
    expect(GRID_LAYOUT).toHaveLength(9)
    const emotionCells = GRID_LAYOUT.filter((c) => c.id !== 'skip')
    expect(emotionCells).toHaveLength(8)
    expect(GRID_LAYOUT.some((c) => c.id === SKIP_CELL.id)).toBe(true)
  })

  it('中度 4 格：開心/傷心/嬲/驚 + 短 TTS', () => {
    expect(MODERATE_EMOTIONS).toHaveLength(4)
    expect(MODERATE_EMOTIONS.map((e) => e.id)).toEqual([
      'joy',
      'sadness',
      'anger',
      'fear',
    ])
    for (const e of MODERATE_EMOTIONS) {
      expect(e.ttsText.endsWith('！') || e.ttsText.length <= 4).toBe(true)
      expect(e.labelZh.length).toBeLessThanOrEqual(2)
      expect(e.emoji).toBeTruthy()
    }
    expect(Object.keys(MODERATE_EMOTIONS_BY_ID)).toHaveLength(4)
  })
})

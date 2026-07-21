/**
 * emotionVocabulary — 情緒 vocabulary 教學 data (Sprint 76 F3 Batch 1)
 *
 * Per user decision (2026-07-22): user 寫 content, 我哋 ship placeholder
 * 結構: 8 emotion × 3 scenario template = 24 條 placeholder
 *
 * Memory rule 12: project-specific facts → 項目 data file (outdate 30 日)
 * Memory rule 13 family 5: 避免 name collision — 用 emotionVocabulary export
 *   唔好叫 scenarios (太 generic)
 *
 * F3 設計 (per proposal):
 * - 每個 emotion 有 3 個「日常場景」短句 (中英對照)
 * - 1 個 emoji 演繹 (短片 placeholder)
 * - Weak mode chip hover 2s → 自動 display 1 個 scenario
 * - High mode dock 整合 (留 F3 batch 2)
 *
 * Phase 2 留:
 * - 短片生成 (Mavis video generation 工具)
 * - 場景 content 豐富化 (user 寫)
 * - body language cue + AI camera (F3 batch 3)
 */

import type { EmotionId } from '../constants/emotions'

export interface EmotionScenario {
  /** 場景短句, 用嚟教 ASD 學生 emotion 應用情境 */
  text: string
  /** 場景類型標籤, 用嚟將來 group / filter */
  category: 'social' | 'sensory' | 'achievement' | 'loss' | 'discovery'
}

export interface EmotionBodyLanguage {
  /** 身體語言文字描述, e.g. "肩膀放低, 嘴角向上" */
  description: string
  /** AI camera 對比 emoji 嘅 reference, e.g. "mirror 😊 face" */
  cameraReference: string
}

export interface EmotionVocabulary {
  emotionId: EmotionId
  /** 3 個日常場景 (F3 batch 1 placeholder) */
  scenarios: readonly [EmotionScenario, EmotionScenario, EmotionScenario]
  /** 1 個 body language cue (F3 batch 3 placeholder) */
  bodyLanguage: EmotionBodyLanguage
  /** 短片 URL placeholder (F3 batch 2 — 將來用 video generation 工具) */
  videoUrl?: string
}

const PLACEHOLDER_TEXT = '[請老師/家長填寫場景, e.g. 「當朋友跌倒,我會 __」]'

const PLACEHOLDER_SCENARIOS: readonly [EmotionScenario, EmotionScenario, EmotionScenario] = [
  { text: PLACEHOLDER_TEXT, category: 'social' },
  { text: PLACEHOLDER_TEXT, category: 'sensory' },
  { text: PLACEHOLDER_TEXT, category: 'achievement' },
]

const PLACEHOLDER_BODY: EmotionBodyLanguage = {
  description: '[請填寫 body language 描述, e.g. 「嘴角向上, 眼睛笑」]',
  cameraReference: '[將來接 AI camera 對比 emoji 嘅 reference]',
}

/** 8 個 Plutchik emotion 各自 vocabulary entry */
export const EMOTION_VOCABULARY: Readonly<Record<EmotionId, EmotionVocabulary>> = {
  joy: {
    emotionId: 'joy',
    scenarios: PLACEHOLDER_SCENARIOS,
    bodyLanguage: PLACEHOLDER_BODY,
  },
  trust: {
    emotionId: 'trust',
    scenarios: PLACEHOLDER_SCENARIOS,
    bodyLanguage: PLACEHOLDER_BODY,
  },
  fear: {
    emotionId: 'fear',
    scenarios: PLACEHOLDER_SCENARIOS,
    bodyLanguage: PLACEHOLDER_BODY,
  },
  surprise: {
    emotionId: 'surprise',
    scenarios: PLACEHOLDER_SCENARIOS,
    bodyLanguage: PLACEHOLDER_BODY,
  },
  sadness: {
    emotionId: 'sadness',
    scenarios: PLACEHOLDER_SCENARIOS,
    bodyLanguage: PLACEHOLDER_BODY,
  },
  disgust: {
    emotionId: 'disgust',
    scenarios: PLACEHOLDER_SCENARIOS,
    bodyLanguage: PLACEHOLDER_BODY,
  },
  anger: {
    emotionId: 'anger',
    scenarios: PLACEHOLDER_SCENARIOS,
    bodyLanguage: PLACEHOLDER_BODY,
  },
  anticipation: {
    emotionId: 'anticipation',
    scenarios: PLACEHOLDER_SCENARIOS,
    bodyLanguage: PLACEHOLDER_BODY,
  },
}

/**
 * Plutchik 8 emotions — central data source.
 *
 * Wheel of emotions (Robert Plutchik, 1980):
 *   Joy      Trust    Fear     Surprise
 *   Sadness  Disgust  Anger    Anticipation
 *
 * Each emotion carries:
 *   - id: stable string key
 *   - emoji: visual primary indicator (≥80px, Proloquo2Go ref)
 *   - labelZh / labelEn: 雙語 label
 *   - hex: 主色綁定(用於 chip border / TTS pulse / R31 random pick)
 *   - hexSoft: bg color (a11y ≥4.5:1 contrast vs text)
 *   - ttsText: TTS 讀出文本(2026-07-22 v3.0.9 fix: 用單字 vocabulary, 唔再係
 *     「我覺得係 X」完整句子, 對齊 AAC 工具 Proloquo2Go 嘅 chip-only TTS pattern。
 *     重複 click 同一個 chip 唔會悶, ASD 學生 sensory load 較低)
 *   - pose: 中模式動作 mapping(Phase 3 實裝)
 *
 * 對標 Proloquo2Go / TouchChat(PLAN §10.2):
 *   - chip 顏色跟 emotion 而非隨意(iPad 直觀辨識)
 *   - 雙語對照符合華文 SEN 教室
 *
 * C1: Plutchik 8 emotion vocabulary (PLAN §11.0)
 */

export type EmotionId =
  | 'joy'
  | 'trust'
  | 'fear'
  | 'surprise'
  | 'sadness'
  | 'disgust'
  | 'anger'
  | 'anticipation'

export interface Emotion {
  id: EmotionId
  emoji: string
  labelZh: string
  labelEn: string
  hex: string
  hexSoft: string
  ttsText: string
  /** 動作名 — Phase 3 mid mode classifier 使用 */
  pose: string
}

export const EMOTIONS: ReadonlyArray<Emotion> = [
  {
    id: 'joy',
    emoji: '😊',
    labelZh: '開心',
    labelEn: 'Joy',
    hex: '#F59E0B', // amber-500
    hexSoft: '#FEF3C7', // amber-100
    ttsText: '開心',
    pose: 'hands_up',
  },
  {
    id: 'trust',
    emoji: '🤝',
    labelZh: '信任',
    labelEn: 'Trust',
    hex: '#10B981', // emerald-500
    hexSoft: '#D1FAE5', // emerald-100
    ttsText: '信任',
    pose: 'hug',
  },
  {
    id: 'fear',
    emoji: '😨',
    labelZh: '驚',
    labelEn: 'Fear',
    hex: '#1F2937', // gray-800
    hexSoft: '#E5E7EB', // gray-200
    ttsText: '驚',
    pose: 'cover_face',
  },
  {
    id: 'surprise',
    emoji: '😲',
    labelZh: '驚喜',
    labelEn: 'Surprise',
    hex: '#FBBF24', // amber-400
    hexSoft: '#FEF3C7', // amber-100
    ttsText: '驚喜',
    pose: 'clap',
  },
  {
    id: 'sadness',
    emoji: '😢',
    labelZh: '悲傷',
    labelEn: 'Sadness',
    hex: '#1E40AF', // blue-800
    hexSoft: '#DBEAFE', // blue-100
    ttsText: '悲傷',
    pose: 'hands_down',
  },
  {
    id: 'disgust',
    emoji: '🤢',
    labelZh: '討厭',
    labelEn: 'Disgust',
    hex: '#7C3AED', // violet-600
    hexSoft: '#EDE9FE', // violet-100
    ttsText: '討厭',
    pose: 'step_back',
  },
  {
    id: 'anger',
    emoji: '😠',
    labelZh: '嬲',
    labelEn: 'Anger',
    hex: '#DC2626', // red-600
    hexSoft: '#FEE2E2', // red-100
    ttsText: '嬲',
    pose: 'fist',
  },
  {
    id: 'anticipation',
    emoji: '🤔',
    labelZh: '期待',
    labelEn: 'Anticipation',
    hex: '#EA580C', // orange-600
    hexSoft: '#FFEDD5', // orange-100
    ttsText: '期待',
    pose: 'pace',
  },
]

/** Map for O(1) lookup */
export const EMOTIONS_BY_ID: Readonly<Record<EmotionId, Emotion>> = EMOTIONS.reduce(
  (acc, e) => {
    acc[e.id] = e
    return acc
  },
  {} as Record<EmotionId, Emotion>,
)

/** 9th cell — 跳過 / 冇感覺(Proloquo 3×3 grid ref) */
export const SKIP_CELL: Readonly<{
  id: 'skip'
  emoji: '⏭'
  labelZh: '跳過'
  labelEn: 'Skip'
  hex: string
  hexSoft: string
  ttsText: string
}> = {
  id: 'skip',
  emoji: '⏭',
  labelZh: '跳過',
  labelEn: 'Skip',
  hex: '#6B7280', // gray-500
  hexSoft: '#F3F4F6', // gray-100
  ttsText: '',
}

/** 9 cell layout — 8 Plutchik + 1 skip (Proloquo 3×3 grid 對標) */
export const GRID_LAYOUT: ReadonlyArray<Emotion | typeof SKIP_CELL> = [
  EMOTIONS_BY_ID.joy,
  EMOTIONS_BY_ID.sadness,
  EMOTIONS_BY_ID.anger,
  EMOTIONS_BY_ID.fear,
  EMOTIONS_BY_ID.trust,
  EMOTIONS_BY_ID.disgust,
  EMOTIONS_BY_ID.surprise,
  EMOTIONS_BY_ID.anticipation,
  SKIP_CELL,
]

/**
 * 中度智障學生用 — 只 4 個基本情緒（2×2）
 * 原則：生活化、短 TTS、大視覺、零抽象詞（信任/期待/討厭唔入）
 */
export type ModerateEmotionId = 'joy' | 'sadness' | 'anger' | 'fear'

export const MODERATE_EMOTIONS: ReadonlyArray<Emotion> = [
  {
    ...EMOTIONS_BY_ID.joy,
    labelZh: '開心',
    ttsText: '開心！',
  },
  {
    ...EMOTIONS_BY_ID.sadness,
    labelZh: '傷心',
    ttsText: '傷心！',
  },
  {
    ...EMOTIONS_BY_ID.anger,
    labelZh: '嬲',
    ttsText: '嬲！',
  },
  {
    ...EMOTIONS_BY_ID.fear,
    labelZh: '驚',
    ttsText: '驚！',
  },
]

export const MODERATE_EMOTIONS_BY_ID: Readonly<
  Record<ModerateEmotionId, Emotion>
> = MODERATE_EMOTIONS.reduce(
  (acc, e) => {
    acc[e.id as ModerateEmotionId] = e
    return acc
  },
  {} as Record<ModerateEmotionId, Emotion>,
)

/**
 * Pose classifier — 8 個 rule-based 動作對應 Plutchik 8 emotion.
 *
 * PLAN §12.3: 對應 source body Plan §12.3 嘅 8 個動作:
 *   Joy       → hands_up       雙手舉高
 *   Sadness   → hands_down     雙手垂下
 *   Anger     → fist           握拳
 *   Fear      → cover_face     雙手掩面
 *   Trust     → hug            擁抱姿勢(雙臂向前交叉)
 *   Disgust   → step_back      退後(身體 bbox 縮小)
 *   Surprise  → clap           拍手(雙手快速接近)
 *   Anticipation → pace        來回踱步(多幀 x 變化)
 *
 * 設計(R37 坐姿 friendly):
 *   - 唔假設站立/坐姿固定 — 偵測 hip center 動態比較
 *   - 距離鏡頭遠近會改變 bbox 大小, 所以唔用絕對 distance, 用 ratio
 *   - 提供 `tolerance` slider 0.5-1.5 (default 1.0), 老人/小孩可調
 *
 * 設計(對智障 / ASD 學生):
 *   - 動作簡單, 唔要求精確 3D 定位
 *   - 8 個動作 互相 orthogonal (混淆度低, R24 緩解)
 *
 * 設計(testable):
 *   - 純函數 input MediaPipe Pose normalized landmarks → output PoseClassification
 *   - mock 數據用 Vector3 模擬, 不依賴 MediaPipe runtime
 */

import type { EmotionId } from '../constants/emotions'

/**
 * Single 3D normalized landmark.
 * MediaPipe Pose 33 keypoints: x, y ∈ [0, 1] (image-relative), z 相對 hip depth.
 */
export interface NormalizedLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

/** 33 MediaPipe Pose landmarks 索引 */
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
} as const

export type PoseAction =
  | 'hands_up'
  | 'hands_down'
  | 'fist'
  | 'cover_face'
  | 'hug'
  | 'step_back'
  | 'clap'
  | 'pace'
  | 'none'

export interface PoseClassification {
  action: PoseAction
  emotionId: EmotionId | null
  /** 0-1 confidence */
  confidence: number
  /** 全部 8 個 score, debug 用 */
  scores: Record<PoseAction, number>
}

export const POSE_TO_EMOTION: Record<Exclude<PoseAction, 'none'>, EmotionId> = {
  hands_up: 'joy',
  hands_down: 'sadness',
  fist: 'anger',
  cover_face: 'fear',
  hug: 'trust',
  step_back: 'disgust',
  clap: 'surprise',
  pace: 'anticipation',
}

/**
 * 計算 2 點距離(2D, ignore Z)
 */
function dist2D(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 計算 2 點垂直距離(只 y)
 */
function distY(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return a.y - b.y // 向上 = 負值
}

/**
 * 計算 shoulder width(用作 reference distance 對坐姿友好)
 */
function shoulderWidth(lm: NormalizedLandmark[]): number {
  return dist2D(lm[POSE_LANDMARKS.LEFT_SHOULDER], lm[POSE_LANDMARKS.RIGHT_SHOULDER])
}

/**
 * 計算 hip center(用作 reference point)
 */
function hipCenter(lm: NormalizedLandmark[]): { x: number; y: number } {
  const lh = lm[POSE_LANDMARKS.LEFT_HIP]
  const rh = lm[POSE_LANDMARKS.RIGHT_HIP]
  return { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 }
}

/**
 * 8 個動作個別 score 計算。
 * 全部 return 0-1, 大於 threshold 算 matched。
 *
 * tolerance 0.5-1.5 (default 1.0):
 *   < 1.0 = 嚴格(老人 / 幼兒可調)
 *   > 1.0 = 寬鬆(動作不明顯)
 */
function scoreHandsUp(lm: NormalizedLandmark[], tolerance: number): number {
  const lw = lm[POSE_LANDMARKS.LEFT_WRIST]
  const rw = lm[POSE_LANDMARKS.RIGHT_WRIST]
  const ls = lm[POSE_LANDMARKS.LEFT_SHOULDER]
  const rs = lm[POSE_LANDMARKS.RIGHT_SHOULDER]
  if (!isVisible(lw) || !isVisible(rw)) return 0
  // Both wrists 應該喺 shoulders 之上 (y 小)
  const leftUp = distY(ls, lw) > 0.05 / tolerance
  const rightUp = distY(rs, rw) > 0.05 / tolerance
  return avgBool(leftUp, rightUp)
}

function scoreHandsDown(lm: NormalizedLandmark[], tolerance: number): number {
  const lw = lm[POSE_LANDMARKS.LEFT_WRIST]
  const rw = lm[POSE_LANDMARKS.RIGHT_WRIST]
  const lh = lm[POSE_LANDMARKS.LEFT_HIP]
  const rh = lm[POSE_LANDMARKS.RIGHT_HIP]
  if (!isVisible(lw) || !isVisible(rw)) return 0
  // Both wrists 應該喺 hips 之下 (y 大)
  const leftDown = distY(lh, lw) > 0.05 / tolerance
  const rightDown = distY(rh, rw) > 0.05 / tolerance
  return avgBool(leftDown, rightDown)
}

function scoreFist(lm: NormalizedLandmark[]): number {
  // 簡化: 兩 wrist 接近 elbow + 接近 body
  const lw = lm[POSE_LANDMARKS.LEFT_WRIST]
  const rw = lm[POSE_LANDMARKS.RIGHT_WRIST]
  const le = lm[POSE_LANDMARKS.LEFT_ELBOW]
  const re = lm[POSE_LANDMARKS.RIGHT_ELBOW]
  if (!isVisible(lw) || !isVisible(rw) || !isVisible(le) || !isVisible(re)) return 0
  const lwClose = dist2D(lw, le) < 0.05
  const rwClose = dist2D(rw, re) < 0.05
  return avgBool(lwClose, rwClose)
}

function scoreCoverFace(lm: NormalizedLandmark[]): number {
  // 兩 wrist 接近 nose
  const lw = lm[POSE_LANDMARKS.LEFT_WRIST]
  const rw = lm[POSE_LANDMARKS.RIGHT_WRIST]
  const nose = lm[POSE_LANDMARKS.NOSE]
  if (!isVisible(lw) || !isVisible(rw) || !isVisible(nose)) return 0
  const lwNear = dist2D(lw, nose) < 0.15
  const rwNear = dist2D(rw, nose) < 0.15
  return avgBool(lwNear, rwNear)
}

function scoreHug(lm: NormalizedLandmark[]): number {
  // 兩 wrist 接近, 在胸前, 不接近 face
  const lw = lm[POSE_LANDMARKS.LEFT_WRIST]
  const rw = lm[POSE_LANDMARKS.RIGHT_WRIST]
  const ls = lm[POSE_LANDMARKS.LEFT_SHOULDER]
  const rs = lm[POSE_LANDMARKS.RIGHT_SHOULDER]
  const nose = lm[POSE_LANDMARKS.NOSE]
  if (!isVisible(lw) || !isVisible(rw) || !isVisible(ls) || !isVisible(rs) || !isVisible(nose)) return 0
  const wristsClose = dist2D(lw, rw) < 0.15
  const belowFace = lw.y > nose.y - 0.05
  return avgBool(wristsClose, belowFace)
}

function scoreClap(lm: NormalizedLandmark[], tolerance: number): number {
  // 兩 wrist 非常接近
  const lw = lm[POSE_LANDMARKS.LEFT_WRIST]
  const rw = lm[POSE_LANDMARKS.RIGHT_WRIST]
  if (!isVisible(lw) || !isVisible(rw)) return 0
  const dist = dist2D(lw, rw)
  if (dist > 0.08 * tolerance) return 0
  return Math.max(0, 1 - dist / (0.08 * tolerance))
}

function scoreStepBack(
  lm: NormalizedLandmark[],
  prevFrame: NormalizedLandmark[] | null,
  tolerance: number,
): number {
  // 身體 bbox 變小 = 退後 (單幀難判定, 用 prev frame 比較)
  if (!prevFrame) return 0
  const sw = shoulderWidth(lm)
  const psw = shoulderWidth(prevFrame)
  if (psw === 0) return 0
  const ratio = sw / psw
  if (ratio >= 0.92) return 0
  // ratio 越小 = 退越後
  return Math.min(1, (0.92 - ratio) * 8 / tolerance)
}

function scorePace(
  lm: NormalizedLandmark[],
  prevFrames: (NormalizedLandmark[] | null)[],
  tolerance: number,
): number {
  // 來回踱步 = 多幀 x 變化有正有負
  // 接收 prev 3 frames (total 4-frame window)
  if (prevFrames.length < 3) return 0
  const validFrames = [lm, ...prevFrames].filter((f): f is NormalizedLandmark[] => f !== null)
  if (validFrames.length < 4) return 0
  const hips = validFrames.map((f) => hipCenter(f))
  let directionChanges = 0
  let prevDelta = 0
  for (let i = 1; i < hips.length; i++) {
    const delta = hips[i - 1].x - hips[i].x
    if (prevDelta !== 0 && Math.sign(delta) !== Math.sign(prevDelta)) {
      directionChanges++
    }
    prevDelta = delta
  }
  // 至少 1 個 direction change (來回) = match
  return Math.min(1, directionChanges / 2) * tolerance
}

function isVisible(lm: NormalizedLandmark | undefined): boolean {
  if (!lm) return false
  if (lm.visibility !== undefined && lm.visibility < 0.5) return false
  if (Number.isNaN(lm.x) || Number.isNaN(lm.y)) return false
  return true
}

function avgBool(a: boolean, b: boolean): number {
  return (Number(a) + Number(b)) / 2
}

/**
 * 8 動作 classifier 主 entry point.
 *
 * @param lm - 當前幀 33 keypoints
 * @param prevFrame - 上一幀 (for step_back)
 * @param prevFrames - 上 3 幀 (for pace)
 * @param tolerance - 0.5-1.5, default 1.0
 * @returns 8 score + best action + emotion mapping
 */
export function classifyPose(
  lm: NormalizedLandmark[],
  prevFrame: NormalizedLandmark[] | null = null,
  prevFrames: (NormalizedLandmark[] | null)[] = [],
  tolerance: number = 1.0,
): PoseClassification {
  // 8 個動作 score
  const scores: Record<PoseAction, number> = {
    hands_up: scoreHandsUp(lm, tolerance),
    hands_down: scoreHandsDown(lm, tolerance),
    fist: scoreFist(lm),
    cover_face: scoreCoverFace(lm),
    hug: scoreHug(lm),
    step_back: scoreStepBack(lm, prevFrame, tolerance),
    clap: scoreClap(lm, tolerance),
    pace: scorePace(lm, prevFrames, tolerance),
    none: 0,
  }

  // Best action (除 none)
  let bestAction: PoseAction = 'none'
  let bestScore = 0
  for (const [action, score] of Object.entries(scores)) {
    if (action === 'none') continue
    if (score > bestScore) {
      bestScore = score
      bestAction = action as PoseAction
    }
  }

  // threshold: tolerance 1.0 = 0.55 信心, tolerance 0.5 = 0.7 (更嚴格)
  const threshold = 0.7 - (tolerance - 0.5) * 0.3
  if (bestScore < threshold) {
    return { action: 'none', emotionId: null, confidence: 0, scores }
  }

  return {
    action: bestAction,
    emotionId: POSE_TO_EMOTION[bestAction as Exclude<PoseAction, 'none'>],
    confidence: bestScore,
    scores,
  }
}

/**
 * 8 動作嘅中文 + 英文 labels (UI 提示用).
 */
export const POSE_LABELS: Record<PoseAction, { zh: string; en: string; emoji: string }> = {
  hands_up: { zh: '舉高雙手', en: 'Hands up', emoji: '🙌' },
  hands_down: { zh: '放下雙手', en: 'Hands down', emoji: '👇' },
  fist: { zh: '握拳', en: 'Make a fist', emoji: '✊' },
  cover_face: { zh: '掩面', en: 'Cover face', emoji: '🙈' },
  hug: { zh: '擁抱姿勢', en: 'Hug', emoji: '🤗' },
  step_back: { zh: '退後', en: 'Step back', emoji: '🙅' },
  clap: { zh: '拍手', en: 'Clap', emoji: '👏' },
  pace: { zh: '來回踱步', en: 'Pace back and forth', emoji: '🚶' },
  none: { zh: '未識別', en: 'No pose', emoji: '❓' },
}

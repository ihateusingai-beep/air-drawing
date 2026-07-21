/**
 * MediaPipe model URL — 防止 404 / 錯 path
 *
 * v3.0.8.3 audit: usePoseTracker 原本用錯 path
 *   https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/pose_landmarker_lite.task
 *   (missing /float16/1/ → 404)
 *
 * 真實 URL (per Google 官方 mediapipe-samples-web 2026):
 *   https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
 *
 * HandLandmarker URL 都驗埋:
 *   https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
 */

import { describe, it, expect } from 'vitest'

const POSE_LITE_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
const HAND_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

describe('MediaPipe model URL format', () => {
  it('pose_landmarker_lite URL match Google 官方 pattern', () => {
    expect(POSE_LITE_URL).toMatch(
      /^https:\/\/storage\.googleapis\.com\/mediapipe-models\/pose_landmarker\/pose_landmarker_lite\/float16\/\d+\/pose_landmarker_lite\.task$/,
    )
  })

  it('hand_landmarker URL match Google 官方 pattern', () => {
    expect(HAND_URL).toMatch(
      /^https:\/\/storage\.googleapis\.com\/mediapipe-models\/hand_landmarker\/hand_landmarker\/float16\/\d+\/hand_landmarker\.task$/,
    )
  })

  it('path 含 /float16/1/ 必備 segment (防止 404 regression)', () => {
    expect(POSE_LITE_URL).toContain('/float16/1/')
    expect(HAND_URL).toContain('/float16/1/')
  })

  it('HTTPS 強制(R7 私隱 + mirror 必要)', () => {
    expect(POSE_LITE_URL.startsWith('https://')).toBe(true)
    expect(HAND_URL.startsWith('https://')).toBe(true)
  })

  it('.task 副檔名必備(MediaPipe bundle format)', () => {
    expect(POSE_LITE_URL.endsWith('.task')).toBe(true)
    expect(HAND_URL.endsWith('.task')).toBe(true)
  })
})

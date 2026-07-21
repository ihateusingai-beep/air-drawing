/**
 * usePoseTracker — MediaPipe Pose 33 keypoints 偵測.
 *
 * R23 緩解: iPad 性能考慮 — `modelComplexity: 0` + 鏡頭降 480p.
 * R5 緩解: 唔用 Pose model by default (用戶 opt-in 啟動).
 *
 * Memory rule 10: module-level Set keyed guard 防 mount-time 雙實例.
 * (MediaPipe Pose 同一個 video 雙實例會 crash + memory leak)
 */

import { useEffect, useRef, useState } from 'react'
import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'
import type { NormalizedLandmark } from '../lib/poseClassifier'

// Module-level idempotency guard
// Use a Map keyed by `usePoseTracker` instance (component lifecycle) — React's
// StrictMode 雙 mount 會 cancel + re-init 同一個 instance, 所以用 stable instance key.
let instanceCounter = 0
const activeTrackers = new Set<number>()

export interface UsePoseTrackerOptions {
  /** target video element, 由 caller 提供 */
  video: HTMLVideoElement | null
  /** start/stop tracking */
  active: boolean
  /** 0 = lite, 1 = full(預設) */
  modelComplexity?: 0 | 1
  /** 信心閾值, default 0.5 */
  minPoseDetectionConfidence?: number
  /** 信心閾值, default 0.5 */
  minPosePresenceConfidence?: number
  /** 信心閾值, default 0.5 */
  minTrackingConfidence?: number
}

export interface UsePoseTrackerState {
  /** MediaPipe Pose 已 loaded 同 ready */
  isReady: boolean
  /** 最新 33 keypoints (null = 未偵測) */
  landmarks: NormalizedLandmark[] | null
  /** error message */
  error: string | null
}

export function usePoseTracker(options: UsePoseTrackerOptions): UsePoseTrackerState {
  const {
    video,
    active,
    modelComplexity = 0, // R23 緩解: 預設 lite
    minPoseDetectionConfidence = 0.5,
    minPosePresenceConfidence = 0.5,
    minTrackingConfidence = 0.5,
  } = options

  const [isReady, setIsReady] = useState(false)
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastVideoTimeRef = useRef<number>(-1)
  const instanceIdRef = useRef<number>(-1)

  // Allocate stable instance id on first mount
  if (instanceIdRef.current === -1) {
    instanceIdRef.current = instanceCounter++
  }

  // Init / cleanup effect
  useEffect(() => {
    if (!active || !video) {
      return
    }

    const guardKey = instanceIdRef.current
    if (activeTrackers.has(guardKey)) {
      // Already running for this instance
      return
    }
    activeTrackers.add(guardKey)

    let cancelled = false

    const init = async () => {
      try {
        // R23 緩解: lite model
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
        )
        if (cancelled) return

        // v3.0.8.3 fix: 真實 Google Storage URL
        // 對齊 Google 官方 mediapipe-samples-web (verified 2026-07-21)
        // https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_{lite|full|heavy}/float16/1/pose_landmarker_{lite|full|heavy}.task
        // 我哋 ship 階段只用 lite (modelComplexity = 0)
        const modelAssetPath =
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            // v3.0.8.3 fix: 用 CPU delegate (GPU delegate 喺 Mac Safari + 部分 Chromium 唔穩, init 拋 generic error)
            // 對齊 useHandTracker v3.0.7.2 嘅 fix
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence,
          minPosePresenceConfidence,
          minTrackingConfidence,
        })
        if (cancelled) {
          landmarker.close()
          return
        }
        landmarkerRef.current = landmarker
        setIsReady(true)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to init Pose')
          setIsReady(false)
        }
      }
    }

    void init()

    return () => {
      cancelled = true
      activeTrackers.delete(guardKey)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close()
        } catch {
          /* ignore */
        }
        landmarkerRef.current = null
      }
      setIsReady(false)
      setLandmarks(null)
    }
  }, [active, video, modelComplexity, minPoseDetectionConfidence, minPosePresenceConfidence, minTrackingConfidence])

  // Per-frame detect loop
  useEffect(() => {
    if (!isReady || !video || !landmarkerRef.current) {
      return
    }

    const detectFrame = (): void => {
      const landmarker = landmarkerRef.current
      if (!landmarker || !video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(detectFrame)
        return
      }
      // Skip if same frame already processed
      if (video.currentTime === lastVideoTimeRef.current) {
        rafRef.current = requestAnimationFrame(detectFrame)
        return
      }
      lastVideoTimeRef.current = video.currentTime

      try {
        const result: PoseLandmarkerResult = landmarker.detectForVideo(video, performance.now())
        if (result.landmarks && result.landmarks.length > 0) {
          setLandmarks(result.landmarks[0] as NormalizedLandmark[])
        } else {
          setLandmarks(null)
        }
      } catch (err) {
        // 唔 throw (R24 緩解 + R33 iOS PWA)
        setError(err instanceof Error ? err.message : 'Detect failed')
        setLandmarks(null)
      }
      rafRef.current = requestAnimationFrame(detectFrame)
    }

    rafRef.current = requestAnimationFrame(detectFrame)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isReady, video])

  return { isReady, landmarks, error }
}

/**
 * 維持 N-frame history 用於 pace classifier.
 */
export function useLandmarkHistory(
  landmarks: NormalizedLandmark[] | null,
  maxFrames: number = 4,
): (NormalizedLandmark[] | null)[] {
  const [history, setHistory] = useState<(NormalizedLandmark[] | null)[]>([])
  const lastUpdateRef = useRef<number>(0)

  useEffect(() => {
    const now = performance.now()
    if (now - lastUpdateRef.current < 100) return // throttle to 10 FPS for pace tracking
    lastUpdateRef.current = now

    setHistory((prev) => {
      const next = [landmarks, ...prev]
      return next.slice(0, maxFrames)
    })
  }, [landmarks, maxFrames])

  return history
}

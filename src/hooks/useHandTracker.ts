/**
 * useHandTracker — MediaPipe Hands 21 keypoints 偵測.
 *
 * PLAN §12.2 (Bug 4 fix): 弱模式手指 hover chip 0.5s = click.
 * 原本只 dwell-click mouse 動作(無手指偵測), user 提問後實裝.
 *
 * 設計:
 *   - 21 個 hand landmarks, 食指 = landmark 8 (INDEX_FINGER_TIP)
 *   - 食指 normalized coord (0-1) 透過 DOM 元素 getBoundingClientRect 計算 hover 位置
 *   - Hover 某 DOM 元素 > 0.5s = trigger click event
 *   - R39 緩解: iPad (touch) auto-disable, 純 click 工作
 *   - R33 緩解: iOS PWA 失敗 silent, 不 throw
 *   - Module-level instance id guard (memory rule 10, 防 StrictMode 雙 mount 雙實例)
 *
 * 性能(R23 緩解):
 *   - Lite model (預設)
 *   - maxNumHands: 1(只追蹤一隻手, 智障學生通常單手)
 */

import { useEffect, useRef, useState } from 'react'
import {
  HandLandmarker,
  FilesetResolver,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision'

let instanceCounter = 0
const activeTrackers = new Set<number>()

/** 21 個 MediaPipe Hands landmark 索引(常用) */
export const HAND_LANDMARKS = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_FINGER_TIP: 8,
  INDEX_FINGER_MCP: 5,
  MIDDLE_FINGER_TIP: 12,
  RING_FINGER_TIP: 16,
  PINKY_TIP: 20,
} as const

export interface NormalizedHandLandmark {
  x: number
  y: number
  z: number
}

export interface UseHandTrackerOptions {
  /** target video element, 由 caller 提供 */
  video: HTMLVideoElement | null
  /** start/stop tracking */
  active: boolean
  /** 0 = lite, 1 = full(預設 lite, R23) */
  modelComplexity?: 0 | 1
  /** 信心閾值, default 0.5 */
  minHandDetectionConfidence?: number
  /** 信心閾值, default 0.5 */
  minHandPresenceConfidence?: number
  /** 信心閾值, default 0.5 */
  minTrackingConfidence?: number
  /** 追蹤手數, default 1 */
  numHands?: number
}

export interface UseHandTrackerState {
  isReady: boolean
  /** 第一隻手 21 landmarks, null = 未偵測 */
  landmarks: NormalizedHandLandmark[] | null
  /** Index finger tip 座標 (0-1) 或 null */
  indexFingerTip: { x: number; y: number } | null
  error: string | null
}

export function useHandTracker(options: UseHandTrackerOptions): UseHandTrackerState {
  const {
    video,
    active,
    modelComplexity = 0,
    minHandDetectionConfidence = 0.5,
    minHandPresenceConfidence = 0.5,
    minTrackingConfidence = 0.5,
    numHands = 1,
  } = options

  const [isReady, setIsReady] = useState(false)
  const [landmarks, setLandmarks] = useState<NormalizedHandLandmark[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastVideoTimeRef = useRef<number>(-1)
  const instanceIdRef = useRef<number>(-1)

  if (instanceIdRef.current === -1) {
    instanceIdRef.current = instanceCounter++
  }

  useEffect(() => {
    if (!active || !video) {
      return
    }

    const guardKey = instanceIdRef.current
    if (activeTrackers.has(guardKey)) {
      return
    }
    activeTrackers.add(guardKey)

    let cancelled = false

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
        )
        if (cancelled) return

        const modelAssetPath =
          modelComplexity === 0
            ? 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
            : 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands,
          minHandDetectionConfidence,
          minHandPresenceConfidence,
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
          setError(err instanceof Error ? err.message : 'Failed to init Hand')
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
  }, [active, video, modelComplexity, minHandDetectionConfidence, minHandPresenceConfidence, minTrackingConfidence, numHands])

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
      if (video.currentTime === lastVideoTimeRef.current) {
        rafRef.current = requestAnimationFrame(detectFrame)
        return
      }
      lastVideoTimeRef.current = video.currentTime

      try {
        const result: HandLandmarkerResult = landmarker.detectForVideo(video, performance.now())
        if (result.landmarks && result.landmarks.length > 0) {
          const hand = result.landmarks[0] as NormalizedHandLandmark[]
          setLandmarks(hand)
        } else {
          setLandmarks(null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Hand detect failed')
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

  const indexFingerTip =
    landmarks && landmarks[HAND_LANDMARKS.INDEX_FINGER_TIP]
      ? {
          x: landmarks[HAND_LANDMARKS.INDEX_FINGER_TIP].x,
          y: landmarks[HAND_LANDMARKS.INDEX_FINGER_TIP].y,
        }
      : null

  return { isReady, landmarks, indexFingerTip, error }
}

/**
 * Hover detection hook: 食指 normalized coord 對應某 DOM 元素範圍.
 * 持續 dwell dwellTimeMs 觸發 onTrigger callback.
 *
 * 設計: getBoundingClientRect() 計算 chip 嘅 mon-relative 範圍.
 * 食指 normalized x/y 透過 video element 嘅 rect 對應 mon pixel.
 */
export interface UseFingerHoverOnElementOptions {
  video: HTMLVideoElement | null
  /** 食指 normalized coord, null = 唔追蹤 */
  indexFingerTip: { x: number; y: number } | null
  /** 是否 active, false = 完全 bypass */
  active: boolean
  /** 停留時間 ms */
  dwellTimeMs: number
  /** 觸發 callback */
  onTrigger: (id: string) => void
}

export interface UseFingerHoverOnElementState {
  hoveredId: string | null
  /** 0-1 dwell progress (UI ring) */
  progress: number
}

export function useFingerHoverOnElement(
  options: UseFingerHoverOnElementOptions,
): UseFingerHoverOnElementState {
  const { video, indexFingerTip, active, dwellTimeMs, onTrigger } = options

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  // Refs (survive effect re-runs, no closure-capture issue)
  const startTsRef = useRef<number | null>(null)
  const lastIdRef = useRef<string | null>(null)
  const lastTriggerRef = useRef<Record<string, number>>({})
  const rafRef = useRef<number | null>(null)
  // latest values pattern: 避免 effect 因為 onTrigger / dwellTimeMs 改變而 cancel raf
  const tipRef = useRef<{ x: number; y: number } | null>(null)
  const activeRef = useRef(active)
  const dwellRef = useRef(dwellTimeMs)
  const onTriggerRef = useRef(onTrigger)
  const videoRef = useRef(video)

  useEffect(() => {
    activeRef.current = active
  }, [active])
  useEffect(() => {
    dwellRef.current = dwellTimeMs
  }, [dwellTimeMs])
  useEffect(() => {
    onTriggerRef.current = onTrigger
  }, [onTrigger])
  useEffect(() => {
    videoRef.current = video
  }, [video])

  // Single mount-time effect: run raf loop, read latest values from refs.
  // 唔依賴 indexFingerTip / onTrigger / dwellTimeMs 避免每次 tip move 重 run 而 cancel raf.
  useEffect(() => {
    let cancelled = false

    const findHoveredId = (tipX: number, tipY: number): string | null => {
      if (typeof document === 'undefined') return null
      const v = videoRef.current
      const rect = v?.getBoundingClientRect()
      const screenX = rect
        ? (1 - tipX) * rect.width + rect.left
        : tipX * window.innerWidth
      const screenY = rect
        ? tipY * rect.height + rect.top
        : tipY * window.innerHeight
      const el = document.elementFromPoint(screenX, screenY) as HTMLElement | null
      if (!el) return null
      const target = el.closest('[data-finger-target]') as HTMLElement | null
      return target?.dataset.fingerTarget ?? null
    }

    const tick = (): void => {
      if (cancelled) return
      const tip = tipRef.current
      const isActive = activeRef.current
      if (!isActive || !tip) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const id = findHoveredId(tip.x, tip.y)
      if (id !== lastIdRef.current) {
        // ID 變化:重設 dwell start
        lastIdRef.current = id
        startTsRef.current = id ? performance.now() : null
        setHoveredId(id)
        setProgress(0)
      } else if (id) {
        // ID 唔變, 繼續算 progress
        const start = startTsRef.current
        if (start !== null) {
          const elapsed = performance.now() - start
          const p = Math.min(1, elapsed / dwellRef.current)
          setProgress(p)
          if (p >= 1) {
            // Trigger
            const now = performance.now()
            const last = lastTriggerRef.current[id] ?? 0
            if (now - last >= 300) {
              lastTriggerRef.current[id] = now
              onTriggerRef.current(id)
            }
            // Reset
            startTsRef.current = null
            lastIdRef.current = null
            setHoveredId(null)
            setProgress(0)
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, []) // mount-only

  // Lightweight effect: 將最新 tip 寫入 ref (唔 cancel raf)
  useEffect(() => {
    tipRef.current = indexFingerTip
    if (!active || !indexFingerTip) {
      // Deactivate: clear hover state
      startTsRef.current = null
      lastIdRef.current = null
      setHoveredId(null)
      setProgress(0)
    }
  }, [active, indexFingerTip])

  return { hoveredId, progress }
}

/**
 * useAACPreference — 持久化 AAC mode toggle (E22 ship 缺口)
 *
 * AAC = Augmentative and Alternative Communication
 * Mode "純 click / 鍵盤" 唔需要鏡頭, 適合:
 *   - 鏡頭壞咗 / 冇 device camera
 *   - ASD 學生對鏡頭敏感
 *   - 學校 IT policy disable camera
 *
 * 持久化: localStorage (simple key, 唔入 IndexedDB schema migration)
 * 預設 false (即係用鏡頭, 同歷史行為一致)
 */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'air-drawing:aac-mode'

function readStored(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return false
    return raw === 'true'
  } catch {
    return false
  }
}

export function useAACPreference(): {
  aacMode: boolean
  setAacMode: (v: boolean) => void
  toggleAacMode: () => void
} {
  const [aacMode, setAacModeState] = useState<boolean>(() => readStored())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, aacMode ? 'true' : 'false')
    } catch {
      /* localStorage quota — silent */
    }
  }, [aacMode])

  const setAacMode = useCallback((v: boolean) => {
    setAacModeState(v)
  }, [])

  const toggleAacMode = useCallback(() => {
    setAacModeState((prev) => !prev)
  }, [])

  return { aacMode, setAacMode, toggleAacMode }
}

/**
 * usePageVisibility — track document visibility (PWA background 偵測).
 *
 * R14 緩解: iOS PWA background 時 WebRTC stream 會被 suspend,
 * 我哋要 react suspend webcam 釋放 resources, resume 時 re-init。
 *
 * 設計:
 *   - listen document visibilitychange event
 *   - return boolean (isVisible)
 *   - 配 onChange callback 可掛 side effect
 */

import { useEffect, useState } from 'react'

export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof document === 'undefined') return true
    return document.visibilityState === 'visible'
  })

  useEffect(() => {
    if (typeof document === 'undefined') return

    const handleVisibilityChange = (): void => {
      setIsVisible(document.visibilityState === 'visible')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return isVisible
}

/**
 * useInstallPrompt — PWA install prompt detection.
 *
 * R14 緩解: iPad 冇原生 install banner, 需 custom in-app banner
 * (iOS Safari 唔 fire `beforeinstallprompt`)。
 * Chrome / Edge / Firefox 桌面會 fire, 我哋用 native prompt。
 *
 * 設計:
 *   - iOS Safari: navigator.standalone 偵測已加 Home Screen, hidden banner
 *   - iPad (non-standalone): 顯示 custom banner 「分享 → 加到主畫面」
 *   - Chrome/Edge: 用 beforeinstallprompt 儲起 deferred prompt,
 *     用戶 click 我哋 UI 就 prompt()
 *   - Firefox / Safari desktop: hidden
 *   - 已 dismiss banner: localStorage 記住, 7 日內唔再顯示
 *
 * 跨裝置對應 PLAN §6.5 雙 install prompt UX。
 */

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

export type InstallPlatform = 'ios' | 'chrome' | 'firefox' | 'unsupported'

export interface InstallState {
  /** can show custom banner */
  canShowBanner: boolean
  /** platform detected */
  platform: InstallPlatform
  /** 已經加咗 home screen (PWA standalone) */
  isInstalled: boolean
  /** trigger native install prompt (Chrome / Edge only) */
  triggerInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
  /** dismiss banner (localStorage 7-day cooldown) */
  dismiss: () => void
}

const DISMISS_KEY = 'air-drawing:install-banner-dismissed'
const DISMISS_DAYS = 7

function detectPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'unsupported'
  const ua = navigator.userAgent
  // iPad (iPadOS 13+ reports as Mac with touch, but iOS still reports as iPad)
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Mac/.test(ua) && navigator.maxTouchPoints > 1) return 'ios' // iPadOS 13+
  if (/Chrome|Chromium|Edg/.test(ua) && !/OPR|Edge/.test(ua)) return 'chrome'
  if (/Firefox/.test(ua)) return 'firefox'
  return 'unsupported'
}

function isInstalledPWA(): boolean {
  if (typeof window === 'undefined') return false
  // iOS: navigator.standalone === true when added to home screen
  if ((navigator as Navigator & { standalone?: boolean }).standalone) return true
  // Android / Desktop: display-mode === 'standalone'
  return window.matchMedia('(display-mode: standalone)').matches
}

function wasDismissedRecently(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const ts = Number(raw)
    if (!Number.isFinite(ts)) return false
    const ageMs = Date.now() - ts
    return ageMs < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export function useInstallPrompt(): InstallState {
  const [platform] = useState<InstallPlatform>(() => detectPlatform())
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isInstalledPWA())
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState<boolean>(() => wasDismissedRecently())

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Listen for beforeinstallprompt (Chrome / Edge)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', handleAppInstalled)

    // Listen for display-mode change (Android desktop)
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsInstalled(true)
    }
    mediaQuery.addEventListener('change', handleDisplayChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
      mediaQuery.removeEventListener('change', handleDisplayChange)
    }
  }, [])

  const canShowBanner =
    !isInstalled &&
    !dismissed &&
    (platform === 'ios' || platform === 'chrome') &&
    // Chrome 必須有 deferredPrompt (user 已經 engage 過)
    (platform !== 'chrome' || deferredPrompt !== null)

  const triggerInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable'
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return choice.outcome
  }

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
  }

  return {
    canShowBanner,
    platform,
    isInstalled,
    triggerInstall,
    dismiss,
  }
}

/**
 * PinLock — 老師 PIN 鎖(可選)。
 *
 * 對應 E7 PIN 鎖 + 觀察者模式。智障學生保護(R27)。
 *
 * 設計:
 *   - 4-digit PIN
 *   - Hash via Web Crypto API (SHA-256 + 16-byte salt) — services/pinHash.ts
 *   - 5 分鐘 idle 自動鎖(Phase 3 加 idle timer)
 *   - Master reset code: 老師可手動 reset (Phase 3 加 file-based recovery)
 *
 * 向後兼容:Legacy XOR-based hash 仍然 verify 通過,但 verify 時 push 一個
 * one-time upgrade flag,提示老師「請重新設定 PIN」。Phase 3 升級腳本自動轉移。
 */

import { useState } from 'react'
import { useProfileStore } from '../store/profileStore'
import {
  hashPin as cryptoHashPin,
  verifyPin as cryptoVerifyPin,
  isLegacyHash,
} from '../services/pinHash'

interface PinLockProps {
  open: boolean
  onClose?: () => void
  /** 如果 true, 解鎖後自動關閉 modal */
  autoCloseOnUnlock?: boolean
}

const PIN_LENGTH = 4

export function PinLock({ open, onClose, autoCloseOnUnlock = true }: PinLockProps): React.JSX.Element | null {
  const profile = useProfileStore((s) =>
    s.profiles.find((p) => p.id === s.activeProfileId),
  )
  const updateProfile = useProfileStore((s) => s.updateProfile)
  const setPinUnlocked = useProfileStore((s) => s.setPinUnlocked)

  const [pin, setPin] = useState('')
  const [step, setStep] = useState<'enter' | 'set' | 'confirm'>('enter')
  const [firstPin, setFirstPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open || !profile) return null

  const hasPin = profile.pinHash != null && profile.pinHash.length > 0

  const handleDigit = (d: string) => {
    if (busy) return
    setError(null)
    if (pin.length < PIN_LENGTH) {
      setPin(pin + d)
    }
    if (pin.length === PIN_LENGTH - 1) {
      // Auto-submit on 4th digit — async verify
      const full = pin + d
      setBusy(true)
      void (async () => {
        try {
          if (step === 'enter' && hasPin) {
            const ok = await cryptoVerifyPin(full, profile.pinHash!)
            if (ok) {
              setPinUnlocked(true)
              if (autoCloseOnUnlock) onClose?.()
            } else {
              setError('PIN 錯誤')
            }
          } else if (step === 'set') {
            setFirstPin(full)
            setStep('confirm')
          } else if (step === 'confirm') {
            if (full === firstPin) {
              const newHash = await cryptoHashPin(full)
              await updateProfile(profile.id, { pinHash: newHash })
              setPinUnlocked(true)
              if (autoCloseOnUnlock) onClose?.()
            } else {
              setError('兩次 PIN 唔一致')
              setStep('set')
            }
          }
        } catch {
          setError('操作失敗,請重試')
        } finally {
          setPin('')
          setBusy(false)
        }
      })()
    }
  }

  const handleBackspace = () => {
    if (busy) return
    setError(null)
    setPin(pin.slice(0, -1))
  }

  const handleClear = () => {
    if (busy) return
    setError(null)
    setPin('')
  }

  // Show upgrade hint if user is on legacy hash (Phase 2 batch 2 升級提示)
  const showLegacyUpgradeHint =
    hasPin && profile.pinHash != null && isLegacyHash(profile.pinHash)

  return (
    <div
      className="fixed inset-0 bg-slate-950/95 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="PIN 鎖"
    >
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl max-w-sm w-full p-6">
        <h2 className="text-lg font-bold text-amber-400 mb-4 text-center flex items-center justify-center gap-2">
          <span>🔒</span>
          <span>{step === 'enter' ? '輸入 PIN' : step === 'set' ? '設定新 PIN' : '確認 PIN'}</span>
        </h2>

        <p className="text-sm text-slate-400 text-center mb-4">
          {step === 'enter'
            ? '請輸入 4 位數字 PIN'
            : step === 'set'
              ? '設定 4 位數字 PIN'
              : '再輸入一次確認'}
        </p>

        {showLegacyUpgradeHint && (
          <p className="text-xs text-amber-300 text-center mb-3 bg-amber-900/30 border border-amber-700/50 rounded p-2">
            🔐 建議重新設定 PIN 以升級到 SHA-256 + Salt 安全標準
          </p>
        )}

        <div className="flex justify-center gap-3 mb-4" aria-label="PIN 輸入進度">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`
                w-12 h-14 rounded-lg border-2 flex items-center justify-center text-2xl
                ${i < pin.length
                  ? 'bg-amber-500 border-amber-400 text-slate-900'
                  : 'bg-slate-900 border-slate-700'
                }
              `}
              aria-hidden="true"
            >
              {i < pin.length ? '•' : ''}
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-rose-400 text-center mb-3" role="alert">
            {error}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              disabled={busy}
              className="py-3 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-lg font-semibold active:scale-95"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            disabled={busy}
            className="py-3 rounded-lg bg-rose-600/80 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-semibold active:scale-95"
          >
            C
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={busy}
            className="py-3 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-lg font-semibold active:scale-95"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            disabled={busy}
            className="py-3 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-semibold active:scale-95"
          >
            ⌫
          </button>
        </div>

        {!hasPin && step === 'enter' && (
          <button
            type="button"
            onClick={() => {
              setStep('set')
              setError(null)
              setPin('')
            }}
            className="w-full py-2 text-sm text-slate-400 hover:text-slate-300"
          >
            未設定 PIN? 點此設定
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * ProfileSwitcher — 老師切換 / 新增 / 刪除 student profile。
 *
 * 對應 E6 多 profile (R27 私隱:亂數 ID, 唔用真名)。
 */

import { useState } from 'react'
import {
  useProfileStore,
  type Mode,
  DWELL_TIME_MIN_MS,
  DWELL_TIME_MAX_MS,
  DWELL_TIME_STEP_MS,
  dwellWarningLevel,
  CLS_TOLERANCE_MIN,
  CLS_TOLERANCE_MAX,
  CLS_TOLERANCE_STEP,
  toleranceWarningLevel,
} from '../store/profileStore'
import type { ProfileRecord } from '../services/idb'

interface ProfileSwitcherProps {
  open: boolean
  onClose: () => void
}

export function ProfileSwitcher({ open, onClose }: ProfileSwitcherProps): React.JSX.Element | null {
  const profiles = useProfileStore((s) => s.profiles)
  const activeId = useProfileStore((s) => s.activeProfileId)
  const setActive = useProfileStore((s) => s.setActiveProfile)
  const createProfile = useProfileStore((s) => s.createProfile)
  const deleteProfile = useProfileStore((s) => s.deleteProfile)
  const setLastMode = useProfileStore((s) => s.setLastMode)

  const [newName, setNewName] = useState('')
  const [newMode, setNewMode] = useState<Mode>('low')
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const updateProfile = useProfileStore((s) => s.updateProfile)

  const selectedProfile = selectedProfileId
    ? profiles.find((p) => p.id === selectedProfileId) ?? null
    : null

  if (!open) return null

  const handleCreate = async () => {
    if (newName.trim().length === 0) return
    await createProfile(newName, newMode)
    await setLastMode(newMode)
    setNewName('')
  }

  const handleSelect = async (id: string) => {
    await setActive(id)
    onClose()
  }

  const handleDelete = async (id: string, name: string) => {
    if (typeof window !== 'undefined' && !window.confirm(`確定刪除「${name}」?`)) return
    await deleteProfile(id)
  }

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 z-40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="選擇學生"
    >
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
            <span>👤</span>
            <span>選擇學生</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded-md text-slate-400 hover:bg-slate-700"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto mb-4 space-y-2">
          {profiles.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">未有任何學生。新增第一個:</p>
          ) : (
            profiles.map((p) => (
              <div
                key={p.id}
                className={`
                  flex items-center justify-between gap-2 p-3 rounded-xl border-2
                  ${p.id === selectedProfileId
                    ? 'bg-amber-500/10 border-amber-400'
                    : p.id === activeId
                      ? 'bg-slate-800 border-slate-600'
                      : 'bg-slate-900 border-slate-700 hover:border-slate-600'
                  }
                `}
              >
                <button
                  type="button"
                  onClick={() => setSelectedProfileId(p.id)}
                  className="flex-1 text-left"
                  aria-pressed={p.id === selectedProfileId}
                >
                  <div className="text-sm font-semibold text-white">{p.name}</div>
                  <div className="text-xs text-slate-400">
                    ID: {p.id} · {p.defaultMode === 'low' ? '🟢' : p.defaultMode === 'mid' ? '🟡' : '🔴'} {p.defaultMode} · dwell {(p.dwellTimeMs / 1000).toFixed(1)}s
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect(p.id)}
                  className="px-2 py-1 text-emerald-400 hover:bg-emerald-500/10 rounded text-xs"
                  aria-label={`切換到 ${p.name}`}
                  title="切換為當前學生"
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id, p.name)}
                  className="px-2 py-1 text-rose-400 hover:bg-rose-500/10 rounded text-xs"
                  aria-label={`刪除 ${p.name}`}
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-700 pt-4 space-y-2">
          {/* R40 緩解: 揀咗 profile 之後可調 dwell slider 0.3-1.0s */}
          {selectedProfile && (
            <DwellSliderSection
              profile={selectedProfile}
              onChange={async (ms) => {
                await updateProfile(selectedProfile.id, { dwellTimeMs: ms })
              }}
            />
          )}

          {/* Phase 3 校準: tolerance slider 0.5-1.5, 適用 mid mode 動作 classifier */}
          {selectedProfile && (
            <ToleranceSliderSection
              profile={selectedProfile}
              onChange={async (t) => {
                await updateProfile(selectedProfile.id, { classifierTolerance: t })
              }}
            />
          )}

          <h3 className="text-sm font-semibold text-slate-300">新增學生</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="學生名字(可匿名)"
              className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
              maxLength={20}
            />
            <select
              value={newMode}
              onChange={(e) => setNewMode(e.target.value as Mode)}
              className="px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white"
              aria-label="預設模式"
            >
              <option value="low">🟢 弱</option>
              <option value="mid">🟡 中</option>
              <option value="high">🔴 強</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={newName.trim().length === 0}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-bold rounded-lg transition active:scale-95"
          >
            ➕ 新增
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * DwellSliderSection — R40 UI 控件。
 * 0.3-1.0s slider, 50ms step, 過低 / 過高 warning(R40 預設建議)。
 */
function DwellSliderSection({
  profile,
  onChange,
}: {
  profile: ProfileRecord
  onChange: (ms: number) => void | Promise<void>
}) {
  const warning = dwellWarningLevel(profile.dwellTimeMs)
  return (
    <div className="bg-slate-900 rounded-xl p-3 space-y-2 border border-slate-700">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-amber-400">
          ⏱️ {profile.name} 嘅停留時間
        </h3>
        <span className="text-sm font-mono text-white">
          {(profile.dwellTimeMs / 1000).toFixed(2)}s
        </span>
      </div>

      <input
        type="range"
        min={DWELL_TIME_MIN_MS}
        max={DWELL_TIME_MAX_MS}
        step={DWELL_TIME_STEP_MS}
        value={profile.dwellTimeMs}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-400"
        aria-label="停留時間 (0.3 至 1.0 秒)"
        aria-valuemin={DWELL_TIME_MIN_MS}
        aria-valuemax={DWELL_TIME_MAX_MS}
        aria-valuenow={profile.dwellTimeMs}
      />

      <div className="flex justify-between text-[10px] text-slate-500">
        <span>0.3s (快)</span>
        <span>0.5s (預設)</span>
        <span>1.0s (慢)</span>
      </div>

      {warning && (
        <p
          className={`text-xs ${warning === 'fast' ? 'text-amber-300' : 'text-orange-300'}`}
          role="status"
        >
          {warning === 'fast'
            ? '⚡ 較快:適合智障 / ASD 學生,但可能誤觸'
            : '🛡️ 較慢:防誤觸,但學生可能等不住'}
        </p>
      )}

      <p className="text-[10px] text-slate-500">
        💡 Dwell-click 停留時間越短,點擊越快但越易誤觸。智障 / ASD 學生建議
        0.3-0.4s,學習遲緩建議 0.5s,怕誤觸可調到 0.7-0.8s。
      </p>
    </div>
  )
}

/**
 * ToleranceSliderSection — R24 / Phase 3 校準 UI.
 * Mid mode pose classifier tolerance 0.5-1.5, per profile.
 */
function ToleranceSliderSection({
  profile,
  onChange,
}: {
  profile: ProfileRecord
  onChange: (t: number) => void | Promise<void>
}) {
  const warning = toleranceWarningLevel(profile.classifierTolerance)
  return (
    <div className="bg-slate-900 rounded-xl p-3 space-y-2 border border-slate-700">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-amber-400">
          🎯 {profile.name} 嘅 Pose 寬鬆度
        </h3>
        <span className="text-sm font-mono text-white">
          {profile.classifierTolerance.toFixed(1)}
        </span>
      </div>

      <input
        type="range"
        min={CLS_TOLERANCE_MIN * 10}
        max={CLS_TOLERANCE_MAX * 10}
        step={CLS_TOLERANCE_STEP * 10}
        value={profile.classifierTolerance * 10}
        onChange={(e) => onChange(Number(e.target.value) / 10)}
        className="w-full accent-amber-400"
        aria-label="Pose 動作寬鬆度 (0.5 嚴格 至 1.5 寬鬆)"
        aria-valuemin={CLS_TOLERANCE_MIN}
        aria-valuemax={CLS_TOLERANCE_MAX}
        aria-valuenow={profile.classifierTolerance}
      />

      <div className="flex justify-between text-[10px] text-slate-500">
        <span>0.5 嚴格</span>
        <span>1.0 預設</span>
        <span>1.5 寬鬆</span>
      </div>

      {warning && (
        <p
          className={`text-xs ${warning === 'strict' ? 'text-amber-300' : 'text-orange-300'}`}
          role="status"
        >
          {warning === 'strict'
            ? '🎯 嚴格:動作必須精確,可能漏 match'
            : '🌊 寬鬆:易 match 但可能誤觸'}
        </p>
      )}

      <p className="text-[10px] text-slate-500">
        💡 Mid mode 嘅動作偵測敏感度。嚴格 = 高信心但漏 match,寬鬆 = 易 match 但易誤觸。
        進入 Mid mode 可用「🎯 校準 Pose 動作」自動建議 per profile 數值。
      </p>
    </div>
  )
}

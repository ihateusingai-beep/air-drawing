/**
 * ProfileSwitcher — 老師切換 / 新增 / 刪除 student profile。
 *
 * 對應 E6 多 profile (R27 私隱:亂數 ID, 唔用真名)。
 */

import { useState } from 'react'
import { useProfileStore, type Mode } from '../store/profileStore'

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
                  ${p.id === activeId
                    ? 'bg-amber-500/10 border-amber-400'
                    : 'bg-slate-900 border-slate-700 hover:border-slate-600'
                  }
                `}
              >
                <button
                  type="button"
                  onClick={() => handleSelect(p.id)}
                  className="flex-1 text-left"
                >
                  <div className="text-sm font-semibold text-white">{p.name}</div>
                  <div className="text-xs text-slate-400">
                    ID: {p.id} · {p.defaultMode === 'low' ? '🟢' : p.defaultMode === 'mid' ? '🟡' : '🔴'} {p.defaultMode}
                  </div>
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

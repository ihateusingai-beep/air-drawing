/**
 * Profile store — Zustand.
 *
 * 對應 plan §3 架構 + §11 E6 多 profile + §12.7 Profile × Mode 雙軸。
 *
 * R27 緩解:profile id 用 randomId(8 字 alphanumeric),唔用真名(雖然 name 仍可顯示)。
 * 雙軸 schema:{ profileId, mode, lastUsedAt }。
 *
 * Memory rule 10:mount-time side effect 暫不需 keyed guard(Phase 1 stub 階段)。
 * Phase 3 接入 MediaPipe Hands 嘅 camera 時加。
 */

import { create } from 'zustand'
import {
  type ProfileRecord,
  putProfile,
  getAllProfiles,
  getMeta,
  putMeta,
  deleteProfile as deleteProfileFromIdb,
} from '../services/idb'

export type Mode = 'low' | 'mid' | 'high'

export interface ProfileStoreState {
  /** All profiles in IDB */
  profiles: ProfileRecord[]
  /** Active profile id (randomId) */
  activeProfileId: string | null
  /** Last mode used (per profile stored separately in meta) */
  lastMode: Mode
  /** PIN lock state */
  pinLockEnabled: boolean
  pinUnlocked: boolean
  /** Loading flag */
  loading: boolean

  // Actions
  loadProfiles: () => Promise<void>
  createProfile: (name: string, defaultMode: Mode) => Promise<ProfileRecord>
  setActiveProfile: (id: string | null) => Promise<void>
  updateProfile: (id: string, patch: Partial<ProfileRecord>) => Promise<void>
  deleteProfile: (id: string) => Promise<void>
  setLastMode: (mode: Mode) => Promise<void>
  setPinLockEnabled: (enabled: boolean) => void
  setPinUnlocked: (unlocked: boolean) => void
}

/** Generate 8 字 alphanumeric random ID (R27 智障私隱) */
export function generateRandomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = 's_'
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}

const META_LAST_PROFILE = 'lastProfileId'
const META_LAST_MODE = 'lastMode'

export const useProfileStore = create<ProfileStoreState>((set, get) => ({
  profiles: [],
  activeProfileId: null,
  lastMode: 'low',
  pinLockEnabled: false,
  pinUnlocked: true, // default unlocked
  loading: false,

  loadProfiles: async () => {
    set({ loading: true })
    try {
      const profiles = await getAllProfiles()
      let activeProfileId: string | null = null
      const savedId = await getMeta(META_LAST_PROFILE)
      if (savedId && profiles.find((p) => p.id === savedId)) {
        activeProfileId = savedId
      } else if (profiles.length > 0) {
        activeProfileId = profiles[0].id
        await putMeta(META_LAST_PROFILE, activeProfileId)
      }

      const savedMode = await getMeta(META_LAST_MODE)
      const lastMode: Mode =
        savedMode === 'low' || savedMode === 'mid' || savedMode === 'high' ? savedMode : 'low'

      const activeProfile = activeProfileId ? profiles.find((p) => p.id === activeProfileId) : null
      const pinLockEnabled = activeProfile?.pinHash != null && activeProfile.pinHash.length > 0

      set({
        profiles,
        activeProfileId,
        lastMode,
        pinLockEnabled,
        pinUnlocked: !pinLockEnabled, // unlocked by default if no PIN
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  createProfile: async (name, defaultMode) => {
    const profile: ProfileRecord = {
      id: generateRandomId(),
      name: name.trim() || `Student ${Math.floor(Math.random() * 1000)}`,
      defaultMode,
      dwellTimeMs: 500,
      ttsEnabled: true,
      createdAt: Date.now(),
    }
    await putProfile(profile)
    const profiles = [...get().profiles, profile]
    set({ profiles, activeProfileId: profile.id })
    await putMeta(META_LAST_PROFILE, profile.id)
    return profile
  },

  setActiveProfile: async (id) => {
    set({ activeProfileId: id })
    if (id) {
      await putMeta(META_LAST_PROFILE, id)
      const profile = get().profiles.find((p) => p.id === id)
      set({ pinLockEnabled: profile?.pinHash != null && profile.pinHash.length > 0 })
    } else {
      set({ pinLockEnabled: false })
    }
    set({ pinUnlocked: !get().pinLockEnabled })
  },

  updateProfile: async (id, patch) => {
    const profile = get().profiles.find((p) => p.id === id)
    if (!profile) return
    const updated = { ...profile, ...patch }
    await putProfile(updated)
    set({
      profiles: get().profiles.map((p) => (p.id === id ? updated : p)),
    })
  },

  deleteProfile: async (id) => {
    await deleteProfileFromIdb(id)
    const remaining = get().profiles.filter((p) => p.id !== id)
    set({ profiles: remaining })
    if (get().activeProfileId === id) {
      const next = remaining[0]?.id ?? null
      await get().setActiveProfile(next)
    }
  },

  setLastMode: async (mode) => {
    set({ lastMode: mode })
    await putMeta(META_LAST_MODE, mode)
  },

  setPinLockEnabled: (enabled) => {
    set({ pinLockEnabled: enabled, pinUnlocked: !enabled })
  },

  setPinUnlocked: (unlocked) => {
    set({ pinUnlocked: unlocked })
  },
}))

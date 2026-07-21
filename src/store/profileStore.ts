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

/** Dwell time bounds (R40 — 0.3-1.0s safe range) */
export const DWELL_TIME_MIN_MS = 300
export const DWELL_TIME_MAX_MS = 1000
export const DWELL_TIME_DEFAULT_MS = 500
export const DWELL_TIME_STEP_MS = 50

/** Clamp dwell time 落 safe range */
export function clampDwellTimeMs(ms: number): number {
  return Math.max(DWELL_TIME_MIN_MS, Math.min(DWELL_TIME_MAX_MS, Math.round(ms)))
}

/** Detect 過低 / 過高 warning level(對應 plan §12.2 預設建議) */
export function dwellWarningLevel(ms: number): 'fast' | 'slow' | null {
  if (ms < DWELL_TIME_MIN_MS || ms > DWELL_TIME_MAX_MS) return null
  if (ms < 400) return 'fast' // 智障 / ASD 學生 fast
  if (ms > 800) return 'slow' // 防誤觸
  return null
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
      dwellTimeMs: DWELL_TIME_DEFAULT_MS,
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
    // R40 緩解: validate dwellTimeMs 範圍, 防止 store invalid data
    const validated: Partial<ProfileRecord> = { ...patch }
    if (validated.dwellTimeMs !== undefined) {
      validated.dwellTimeMs = clampDwellTimeMs(validated.dwellTimeMs)
    }
    const updated = { ...profile, ...validated }
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

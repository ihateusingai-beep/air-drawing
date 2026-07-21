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

/**
 * Dwell time bounds (R40 — 原本 0.3-1.0s, v3.0.7.4 改 0.5-2.5s)
 * TTS 中文一句 1.5-2.5s, 0.5-1.0s 太短, TTS 句未讀完會 trigger 過
 * Max 2.5s 等 TTS 完整讀完, Min 0.5s 防誤觸
 */
export const DWELL_TIME_MIN_MS = 500
export const DWELL_TIME_MAX_MS = 2500
export const DWELL_TIME_DEFAULT_MS = 1500
export const DWELL_TIME_STEP_MS = 100

/** Clamp dwell time 落 safe range */
export function clampDwellTimeMs(ms: number): number {
  return Math.max(DWELL_TIME_MIN_MS, Math.min(DWELL_TIME_MAX_MS, Math.round(ms)))
}

/** Detect 過低 / 過高 warning level(對應 plan §12.2 預設建議) */
export function dwellWarningLevel(ms: number): 'fast' | 'slow' | null {
  if (ms < DWELL_TIME_MIN_MS || ms > DWELL_TIME_MAX_MS) return null
  if (ms < 800) return 'fast' // <0.8s 可能 TTS 未讀完
  if (ms > 2000) return 'slow' // >2s 對 fast learner 太慢
  return null
}

/** Mid mode pose classifier tolerance bounds (R24 緩解) */
export const CLS_TOLERANCE_MIN = 0.5
export const CLS_TOLERANCE_MAX = 1.5
export const CLS_TOLERANCE_DEFAULT = 1.0
export const CLS_TOLERANCE_STEP = 0.1

/** Clamp classifier tolerance 落 safe range */
export function clampClassifierTolerance(t: number): number {
  return Math.max(
    CLS_TOLERANCE_MIN,
    Math.min(CLS_TOLERANCE_MAX, Math.round(t * 10) / 10),
  )
}

/** Detect tolerance warning level(對應 plan §12.3) */
export function toleranceWarningLevel(t: number): 'strict' | 'loose' | null {
  if (t < CLS_TOLERANCE_MIN || t > CLS_TOLERANCE_MAX) return null
  if (t <= 0.6) return 'strict' // 高信心, 嚴格, 動作必須精確
  if (t >= 1.4) return 'loose' // 低信心, 寬鬆, 易誤觸
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
      const rawProfiles = await getAllProfiles()
      // Backward-compat: 舊 IDB profile 冇 classifierTolerance 字段, 自動補預設
      const profiles = rawProfiles.map((p) => ({
        ...p,
        classifierTolerance:
          typeof p.classifierTolerance === 'number'
            ? clampClassifierTolerance(p.classifierTolerance)
            : CLS_TOLERANCE_DEFAULT,
      }))
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
      classifierTolerance: CLS_TOLERANCE_DEFAULT,
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
    // R40 / R24 緩解: validate range fields, 防止 store invalid data
    const validated: Partial<ProfileRecord> = { ...patch }
    if (validated.dwellTimeMs !== undefined) {
      validated.dwellTimeMs = clampDwellTimeMs(validated.dwellTimeMs)
    }
    if (validated.classifierTolerance !== undefined) {
      validated.classifierTolerance = clampClassifierTolerance(
        validated.classifierTolerance,
      )
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

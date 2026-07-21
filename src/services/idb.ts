/**
 * IndexedDB wrapper — emotion log / profile / artwork 持久化。
 *
 * 設計:每個 store 一個 typed API,避免 raw IDBTransaction 散落。
 * IndexedDB 喺 R27 私隱保護下使用(只 local,0 上傳)。
 *
 * Store 結構(統一 schema, R38 緩解):
 *   - profiles:  { id, name, randomId, pinHash, defaultMode, dwellTimeMs, classifierTolerance, ttsEnabled, createdAt }
 *   - emotion_logs:  { id, profileId, emotionId, source, ts }
 *   - artworks:  { id, profileId, ts, dataURL, emotionLabel }
 *   - pose_logs:  { id, profileId, pose, confidence, matched, ts } (Phase 3)
 *   - meta:  { key, value } (e.g. lastMode, lastProfileId)
 */

const DB_NAME = 'air-drawing'
const DB_VERSION = 1

const STORE_PROFILES = 'profiles'
const STORE_EMOTION_LOGS = 'emotion_logs'
const STORE_ARTWORKS = 'artworks'
const STORE_POSE_LOGS = 'pose_logs'
const STORE_META = 'meta'

let dbPromise: Promise<IDBDatabase> | null = null

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not supported'))
  }
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_PROFILES)) {
        db.createObjectStore(STORE_PROFILES, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_EMOTION_LOGS)) {
        const store = db.createObjectStore(STORE_EMOTION_LOGS, { keyPath: 'id', autoIncrement: true })
        store.createIndex('byProfile', 'profileId', { unique: false })
        store.createIndex('byTs', 'ts', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_ARTWORKS)) {
        const store = db.createObjectStore(STORE_ARTWORKS, { keyPath: 'id', autoIncrement: true })
        store.createIndex('byProfile', 'profileId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_POSE_LOGS)) {
        const store = db.createObjectStore(STORE_POSE_LOGS, { keyPath: 'id', autoIncrement: true })
        store.createIndex('byProfile', 'profileId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function promisifyReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function promisifyTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

// ────────────────────────────────────────────────────────────────
// Profile API
// ────────────────────────────────────────────────────────────────

export interface ProfileRecord {
  id: string // randomId (e.g. 's_a8f3e2')
  name: string // display name (老師 set)
  pinHash?: string // optional 4-6 digit PIN (hashed, plain text 唔 store)
  defaultMode: 'low' | 'mid' | 'high'
  dwellTimeMs: number
  /** Mid mode pose classifier tolerance, 0.5 (嚴格) - 1.5 (寬鬆) */
  classifierTolerance: number
  ttsEnabled: boolean
  createdAt: number
}

export async function putProfile(p: ProfileRecord): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(STORE_PROFILES, 'readwrite')
  tx.objectStore(STORE_PROFILES).put(p)
  await promisifyTx(tx)
}

export async function getProfile(id: string): Promise<ProfileRecord | null> {
  const db = await getDB()
  const tx = db.transaction(STORE_PROFILES, 'readonly')
  const result = await promisifyReq(tx.objectStore(STORE_PROFILES).get(id))
  return result ?? null
}

export async function getAllProfiles(): Promise<ProfileRecord[]> {
  const db = await getDB()
  const tx = db.transaction(STORE_PROFILES, 'readonly')
  const result = await promisifyReq(tx.objectStore(STORE_PROFILES).getAll())
  return result ?? []
}

export async function deleteProfile(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(STORE_PROFILES, 'readwrite')
  tx.objectStore(STORE_PROFILES).delete(id)
  await promisifyTx(tx)
}

// ────────────────────────────────────────────────────────────────
// Emotion log API
// ────────────────────────────────────────────────────────────────

export interface EmotionLogRecord {
  id?: number
  profileId: string
  emotionId: string
  source: 'mouse-dwell' | 'touch-click' | 'mouse-click' | 'pose-classifier'
  ts: number
}

export async function appendEmotionLog(record: Omit<EmotionLogRecord, 'id'>): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(STORE_EMOTION_LOGS, 'readwrite')
  tx.objectStore(STORE_EMOTION_LOGS).add(record)
  await promisifyTx(tx)
}

export async function getEmotionLogs(profileId: string, limit: number = 200): Promise<EmotionLogRecord[]> {
  const db = await getDB()
  const tx = db.transaction(STORE_EMOTION_LOGS, 'readonly')
  const index = tx.objectStore(STORE_EMOTION_LOGS).index('byProfile')
  const results = await promisifyReq(index.getAll(profileId))
  const all = (results ?? []) as EmotionLogRecord[]
  return all.slice(-limit)
}

export async function clearEmotionLogs(profileId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(STORE_EMOTION_LOGS, 'readwrite')
  const index = tx.objectStore(STORE_EMOTION_LOGS).index('byProfile')
  const keys = await promisifyReq(index.getAllKeys(profileId))
  const store = tx.objectStore(STORE_EMOTION_LOGS)
  keys.forEach((k) => store.delete(k))
  await promisifyTx(tx)
}

// ────────────────────────────────────────────────────────────────
// Meta API (lastMode, lastProfileId, etc.)
// ────────────────────────────────────────────────────────────────

export interface MetaRecord {
  key: string
  value: string
}

export async function putMeta(key: string, value: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(STORE_META, 'readwrite')
  tx.objectStore(STORE_META).put({ key, value })
  await promisifyTx(tx)
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDB()
  const tx = db.transaction(STORE_META, 'readonly')
  const result = await promisifyReq(tx.objectStore(STORE_META).get(key))
  if (!result) return null
  return (result as MetaRecord).value
}

/**
 * PIN hashing — Web Crypto API (SHA-256 + salt).
 *
 * Phase 2 batch 2 known-issue fix:
 *   之前用 XOR + base64 簡單 hash, 唔係 crypto-secure.
 *   Phase 2 batch 2 升 Web Crypto API:
 *     - SHA-256 摘要
 *     - 16-byte random salt per PIN
 *     - store format: `v1:<saltHex>:<hashHex>`
 *
 * 設計考量 (R27 智障私隱):
 *   - Salt 每次新 set PIN 都係新 random, 防 rainbow table
 *   - Store format versioned (`v1:`) — Phase 3 升 Argon2 嘅 migration path
 *   - Plain text PIN 永遠唔落 IDB / log / telemetry
 *
 * SSR-safe:crypto.subtle 喺 Node 18+ / browser 都 support,
 * 但 web 環境係主要 target(iPad Safari / Chrome)。
 */

const VERSION = 'v1'
const SALT_BYTES = 16

function getSubtleCrypto(): SubtleCrypto | null {
  if (typeof crypto !== 'undefined' && crypto.subtle) return crypto.subtle
  if (typeof globalThis !== 'undefined' && (globalThis as { crypto?: Crypto }).crypto?.subtle) {
    return (globalThis as { crypto: Crypto }).crypto.subtle
  }
  return null
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * Generate 16-byte random salt, encoded hex.
 * Falls back to Math.random for SSR / non-secure env (Phase 3 加 warning).
 */
export function generateSalt(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const salt = new Uint8Array(SALT_BYTES)
    crypto.getRandomValues(salt)
    return bytesToHex(salt)
  }
  // Fallback (SSR / insecure env)
  const salt = new Uint8Array(SALT_BYTES)
  for (let i = 0; i < SALT_BYTES; i++) {
    salt[i] = Math.floor(Math.random() * 256)
  }
  return bytesToHex(salt)
}

/**
 * Hash a PIN with given salt, return `v1:<saltHex>:<hashHex>`.
 * Uses SHA-256 via Web Crypto API.
 */
export async function hashPin(pin: string, salt?: string): Promise<string> {
  const useSalt = salt ?? generateSalt()
  const subtle = getSubtleCrypto()
  if (!subtle) {
    throw new Error('Web Crypto API not available')
  }
  const enc = new TextEncoder()
  // Combine salt + pin to prevent salt reuse attacks
  const data = enc.encode(useSalt + ':' + pin)
  const hashBuffer = await subtle.digest('SHA-256', data)
  const hashHex = bytesToHex(new Uint8Array(hashBuffer))
  return `${VERSION}:${useSalt}:${hashHex}`
}

/**
 * Verify a PIN against a stored hash. Constant-time comparison.
 */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split(':')
    if (parts.length !== 3 || parts[0] !== VERSION) {
      // Legacy XOR hash format — fallback
      return verifyLegacyPin(pin, stored)
    }
    const salt = parts[1]
    const expected = await hashPin(pin, salt)
    return constantTimeEqual(expected, stored)
  } catch {
    return false
  }
}

/**
 * Constant-time string comparison. Prevents timing attacks.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Legacy XOR + base64 verifier (Phase 2 batch 2 嘅舊 hash).
 * 保留以支援已經 store 嘅 PIN 向後兼容。
 * Phase 3 升 Argon2 時移除呢個 fallback。
 */
function verifyLegacyPin(pin: string, stored: string): boolean {
  try {
    const xored = pin
      .split('')
      .map((c) => c.charCodeAt(0) ^ 0x5a)
      .join(',')
    const legacy = btoa(xored)
    return constantTimeEqual(legacy, stored)
  } catch {
    return false
  }
}

/**
 * Check if a stored hash is legacy (XOR) format. Used by Phase 3 升級腳本
 * 提示老師「請重新設定 PIN」。
 */
export function isLegacyHash(stored: string): boolean {
  return !stored.startsWith(`${VERSION}:`)
}

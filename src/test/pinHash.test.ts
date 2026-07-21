/**
 * pinHash — collision simulation + Web Crypto SubtleCrypto edge case
 * Critical for R7 私隱 PIN 鎖保護
 */

import { describe, it, expect } from 'vitest'
import { hashPin, verifyPin, generateSalt, isLegacyHash } from '../services/pinHash'

describe('pinHash service', () => {
  it('hashPin 一致性: 同 PIN + 同 salt → 同 hash', async () => {
    const salt = generateSalt()
    const h1 = await hashPin('1234', salt)
    const h2 = await hashPin('1234', salt)
    expect(h1).toBe(h2)
  })

  it('hashPin 唯一性: 唔同 PIN → 唔同 hash', async () => {
    const salt = generateSalt()
    const h1 = await hashPin('1234', salt)
    const h2 = await hashPin('5678', salt)
    expect(h1).not.toBe(h2)
  })

  it('hashPin 唯一性: 唔同 salt → 唔同 hash (防 rainbow table)', async () => {
    const h1 = await hashPin('1234')
    const h2 = await hashPin('1234')
    expect(h1).not.toBe(h2)
  })

  it('hashPin 格式: v1:<saltHex>:<hashHex>', async () => {
    const h = await hashPin('1234')
    expect(h).toMatch(/^v1:[0-9a-f]{32}:[0-9a-f]{64}$/)
  })

  it('verifyPin 正確 PIN 通過', async () => {
    const stored = await hashPin('1234')
    expect(await verifyPin('1234', stored)).toBe(true)
  })

  it('verifyPin 錯 PIN 拒絕', async () => {
    const stored = await hashPin('1234')
    expect(await verifyPin('5678', stored)).toBe(false)
  })

  it('generateSalt 每次都唔同 (防 replay)', () => {
    const salts = new Set<string>()
    for (let i = 0; i < 100; i++) {
      salts.add(generateSalt())
    }
    expect(salts.size).toBe(100)
  })

  it('1000 個 PIN 唔撞 hash (lightweight collision check)', async () => {
    const hashes = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const hash = await hashPin(String(i).padStart(4, '0'))
      hashes.add(hash)
    }
    expect(hashes.size).toBe(1000)
  })

  it('isLegacyHash: v1: 前綴 = 新格式, 其他 = legacy', () => {
    expect(isLegacyHash('v1:abc:def')).toBe(false)
    expect(isLegacyHash('YWJjZAo=')).toBe(true)
  })
})

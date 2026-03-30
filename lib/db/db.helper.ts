// ----------------------------------------------------------------
// DBHelper — Katman 7
// AES-256-GCM sifreleme/cozme.
// v1 ile birebir uyumlu format: { iv, ciphertext, tag, version }
// Sadece server-side'da calisir (Node.js crypto).
// ----------------------------------------------------------------

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import type { EncryptedBlob } from './types'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit
const TAG_LENGTH = 16 // 128-bit

function getKey(): Buffer {
  const keyBase64 = process.env.MARKETPLACE_SECRET_KEY
  if (!keyBase64) {
    throw new Error('MARKETPLACE_SECRET_KEY tanimlanmamis')
  }
  const key = Buffer.from(keyBase64, 'base64')
  if (key.length !== 32) {
    throw new Error('MARKETPLACE_SECRET_KEY 32 byte olmali')
  }
  return key
}

function getOldKey(): Buffer | null {
  const keyBase64 = process.env.MARKETPLACE_SECRET_KEY_OLD
  if (!keyBase64) return null
  const key = Buffer.from(keyBase64, 'base64')
  if (key.length !== 32) return null
  return key
}

function getCurrentVersion(): number {
  // Key rotation'da version artirilir
  return process.env.MARKETPLACE_SECRET_KEY_OLD ? 2 : 1
}

/**
 * Duzy metni AES-256-GCM ile sifreler.
 * @returns JSON string: { iv, ciphertext, tag, version }
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  const blob: EncryptedBlob = {
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    tag: tag.toString('base64'),
    version: getCurrentVersion(),
  }

  return JSON.stringify(blob)
}

/**
 * AES-256-GCM sifreli blobu cozer.
 * Oncelikle guncel anahtari dener, basarisiz olursa eski anahtari dener.
 * @param blobString JSON string: { iv, ciphertext, tag, version }
 * @returns Duz metin
 */
export function decrypt(blobString: string): string {
  const blob: EncryptedBlob = JSON.parse(blobString)

  const iv = Buffer.from(blob.iv, 'base64')
  const ciphertext = Buffer.from(blob.ciphertext, 'base64')
  const tag = Buffer.from(blob.tag, 'base64')

  // Guncel anahtar ile dene
  try {
    const key = getKey()
    return decryptWithKey(key, iv, ciphertext, tag)
  } catch {
    // Eski anahtar ile dene (key rotation durumu)
    const oldKey = getOldKey()
    if (!oldKey) {
      throw new Error('Sifre cozme basarisiz — anahtar uyumsuz')
    }
    return decryptWithKey(oldKey, iv, ciphertext, tag)
  }
}

function decryptWithKey(
  key: Buffer,
  iv: Buffer,
  ciphertext: Buffer,
  tag: Buffer
): string {
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

/**
 * Eski anahtarla sifrelenmi veriyi guncel anahtarla yeniden sifreler.
 * Key rotation icin kullanilir.
 * @param oldBlobString Eski sifreli blob
 * @returns Yeni sifreli blob (guncel anahtar + yeni IV)
 */
export function rotateKey(oldBlobString: string): string {
  const plaintext = decrypt(oldBlobString)
  return encrypt(plaintext)
}

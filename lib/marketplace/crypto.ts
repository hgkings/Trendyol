/**
 * AES-256-GCM encryption for marketplace credentials.
 * Server-only module — never import this in client components.
 *
 * Env: MARKETPLACE_SECRET_KEY (32 bytes, base64-encoded)
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;       // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;      // 128-bit auth tag
const CURRENT_VERSION = 1;

function getKey(): Buffer {
    const b64 = process.env.MARKETPLACE_SECRET_KEY;
    if (!b64) throw new Error('MARKETPLACE_SECRET_KEY environment variable is not set');
    const key = Buffer.from(b64, 'base64');
    if (key.length !== 32) throw new Error('MARKETPLACE_SECRET_KEY must be exactly 32 bytes');
    return key;
}

export interface EncryptedBlob {
    iv: string;         // hex
    ciphertext: string; // hex
    tag: string;        // hex
    version: number;
}

/**
 * Encrypt a plaintext JSON object into an encrypted blob string.
 */
export function encryptCredentials(plainObj: Record<string, string>): string {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, new Uint8Array(key), new Uint8Array(iv), { authTagLength: TAG_LENGTH });

    const plaintext = JSON.stringify(plainObj);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    const blob: EncryptedBlob = {
        iv: iv.toString('hex'),
        ciphertext: encrypted,
        tag: tag.toString('hex'),
        version: CURRENT_VERSION,
    };

    return JSON.stringify(blob);
}

/**
 * Decrypt an encrypted blob string back to a plaintext JSON object.
 */
export function decryptCredentials(blobStr: string): Record<string, string> {
    const key = getKey();
    const blob: EncryptedBlob = JSON.parse(blobStr) as EncryptedBlob;

    const iv = Buffer.from(blob.iv, 'hex');
    const tag = Buffer.from(blob.tag, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, new Uint8Array(key), new Uint8Array(iv), { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(new Uint8Array(tag));

    let decrypted = decipher.update(blob.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted) as Record<string, string>;
}
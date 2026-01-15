/**
 * AES-256-GCM Encryption Module
 * Provides symmetric encryption for local storage
 */

import { AUTH_CONFIG } from '../../constants/auth';
import type { EncryptedData, EncryptResult, DecryptResult } from './types';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  generateRandomBytes,
  isWebCryptoAvailable,
} from './utils';

const CURRENT_VERSION = 1;

/**
 * Generate a new AES-256-GCM encryption key
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  if (!isWebCryptoAvailable()) {
    throw new Error('Web Crypto API not available');
  }

  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: AUTH_CONFIG.KEY_LENGTH_BITS,
    },
    true, // extractable for backup purposes
    ['encrypt', 'decrypt']
  );
}

/**
 * Import a raw key for encryption/decryption
 */
export async function importKey(keyMaterial: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM', length: AUTH_CONFIG.KEY_LENGTH_BITS },
    false, // not extractable after import
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey to raw format
 */
export async function exportKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', key);
}

/**
 * Encrypt plaintext using AES-256-GCM
 * @param plaintext - The string to encrypt
 * @param key - The CryptoKey to use for encryption
 * @returns EncryptResult with encrypted data or error
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptResult> {
  if (!isWebCryptoAvailable()) {
    return {
      success: false,
      error: 'Web Crypto API not available',
      code: 'CRYPTO_NOT_AVAILABLE',
    };
  }

  try {
    // Generate random IV (12 bytes for GCM)
    const iv = generateRandomBytes(AUTH_CONFIG.IV_LENGTH_BYTES);

    // Encode plaintext to bytes
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);

    // Encrypt with AES-GCM
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv.buffer as ArrayBuffer,
        // GCM tag length is 128 bits by default
      },
      key,
      plaintextBytes
    );

    // Package result
    const encryptedData: EncryptedData = {
      version: CURRENT_VERSION,
      algorithm: 'AES-256-GCM',
      iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
      ciphertext: arrayBufferToBase64(ciphertext),
    };

    return {
      success: true,
      data: encryptedData,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Encryption failed',
      code: 'ENCRYPTION_FAILED',
    };
  }
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param encrypted - The encrypted data structure
 * @param key - The CryptoKey to use for decryption
 * @returns DecryptResult with plaintext or error
 */
export async function decrypt(
  encrypted: EncryptedData,
  key: CryptoKey
): Promise<DecryptResult> {
  if (!isWebCryptoAvailable()) {
    return {
      success: false,
      error: 'Web Crypto API not available',
      code: 'CRYPTO_NOT_AVAILABLE',
    };
  }

  try {
    // Validate version
    if (encrypted.version > CURRENT_VERSION) {
      return {
        success: false,
        error: `Unsupported encryption version: ${encrypted.version}`,
        code: 'VERSION_UNSUPPORTED',
      };
    }

    // Validate algorithm
    if (encrypted.algorithm !== 'AES-256-GCM') {
      return {
        success: false,
        error: `Unsupported algorithm: ${encrypted.algorithm}`,
        code: 'ALGORITHM_UNSUPPORTED',
      };
    }

    // Decode IV and ciphertext from base64
    const iv = base64ToArrayBuffer(encrypted.iv);
    const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);

    // Decrypt
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertext
    );

    // Decode to string
    const decoder = new TextDecoder();
    const plaintext = decoder.decode(decryptedBuffer);

    return {
      success: true,
      plaintext,
    };
  } catch (error) {
    // GCM will throw if authentication tag doesn't match (tampering detected)
    const message = error instanceof Error ? error.message : 'Decryption failed';
    const isTampered = message.includes('operation-specific reason');

    return {
      success: false,
      error: isTampered ? 'Data integrity check failed - possible tampering' : message,
      code: isTampered ? 'INTEGRITY_FAILED' : 'DECRYPTION_FAILED',
    };
  }
}

/**
 * Re-encrypt data with a new key (for key rotation)
 */
export async function reEncrypt(
  encrypted: EncryptedData,
  oldKey: CryptoKey,
  newKey: CryptoKey
): Promise<EncryptResult> {
  // First decrypt with old key
  const decryptResult = await decrypt(encrypted, oldKey);
  if (!decryptResult.success) {
    return {
      success: false,
      error: decryptResult.error,
      code: decryptResult.code,
    };
  }

  // Then encrypt with new key
  return encrypt(decryptResult.plaintext, newKey);
}

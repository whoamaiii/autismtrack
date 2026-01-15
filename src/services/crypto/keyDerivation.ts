/**
 * Key Derivation Module
 * HKDF-based key derivation from device key + salt
 */

import { AUTH_CONFIG } from '../../constants/auth';
import { generateRandomBytes, isWebCryptoAvailable, arrayBufferToBase64, base64ToArrayBuffer } from './utils';

/**
 * Generate a device-specific salt for key derivation
 * This salt should be generated once and stored securely
 */
export function generateDeviceSalt(): Uint8Array {
  return generateRandomBytes(AUTH_CONFIG.SALT_LENGTH_BYTES);
}

/**
 * Derive an encryption key from deviceKey (from QR) and device salt using HKDF
 *
 * @param deviceKey - The 256-bit device key from QR payload (base64 encoded)
 * @param salt - Device-specific salt (16 bytes)
 * @returns CryptoKey ready for AES-GCM encryption
 */
export async function deriveStorageKey(
  deviceKey: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  if (!isWebCryptoAvailable()) {
    throw new Error('Web Crypto API not available');
  }

  // Import the device key as raw key material for HKDF
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    base64ToArrayBuffer(deviceKey),
    'HKDF',
    false, // not extractable
    ['deriveKey']
  );

  // Derive the storage key using HKDF
  const storageKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt.buffer as ArrayBuffer,
      info: new TextEncoder().encode(AUTH_CONFIG.HKDF_INFO),
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: AUTH_CONFIG.KEY_LENGTH_BITS,
    },
    false, // not extractable (security best practice)
    ['encrypt', 'decrypt']
  );

  return storageKey;
}

/**
 * Derive a key for HMAC operations (for data integrity)
 */
export async function deriveHmacKey(
  deviceKey: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  if (!isWebCryptoAvailable()) {
    throw new Error('Web Crypto API not available');
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    base64ToArrayBuffer(deviceKey),
    'HKDF',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt.buffer as ArrayBuffer,
      info: new TextEncoder().encode('neurologg-hmac-v1'),
    },
    keyMaterial,
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign', 'verify']
  );
}

/**
 * Generate a secure 256-bit device key for QR payload
 * This is typically done by the admin tool, not the app
 */
export function generateDeviceKey(): string {
  const keyBytes = generateRandomBytes(32); // 256 bits
  return arrayBufferToBase64(keyBytes.buffer as ArrayBuffer);
}

/**
 * Validate a device key format
 */
export function isValidDeviceKey(deviceKey: string): boolean {
  try {
    const decoded = base64ToArrayBuffer(deviceKey);
    // Must be exactly 256 bits (32 bytes)
    return decoded.byteLength === 32;
  } catch {
    return false;
  }
}

/**
 * Cryptographic utility functions
 * Base64 encoding, array buffer conversions
 */

/**
 * Convert ArrayBuffer to Base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

/**
 * Convert Base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(base64ToArrayBuffer(base64));
}

/**
 * Convert Uint8Array to Base64 string
 */
export function uint8ArrayToBase64(array: Uint8Array): string {
  return arrayBufferToBase64(array.buffer as ArrayBuffer);
}

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Generate a random UUID
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Hash a string using SHA-256
 */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToBase64(hashBuffer);
}

/**
 * Validate Base64 string format
 */
export function isValidBase64(str: string): boolean {
  if (!str || str.length === 0) {
    return false;
  }
  try {
    // Check if it's valid base64
    const decoded = atob(str);
    const encoded = btoa(decoded);
    return encoded === str;
  } catch {
    return false;
  }
}

/**
 * Check if Web Crypto API is available
 */
export function isWebCryptoAvailable(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.subtle.encrypt === 'function' &&
    typeof crypto.subtle.decrypt === 'function' &&
    typeof crypto.subtle.deriveKey === 'function'
  );
}

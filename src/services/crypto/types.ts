/**
 * Cryptographic types for encrypted storage
 */

// Encrypted data structure stored in localStorage/IndexedDB
export interface EncryptedData {
  version: number;
  algorithm: 'AES-256-GCM';
  iv: string; // Base64 encoded
  ciphertext: string; // Base64 encoded
  tag?: string; // Auth tag (included in ciphertext for GCM)
}

// Key derivation parameters
export interface KeyDerivationParams {
  salt: Uint8Array;
  info: string;
  keyLength: number;
}

// Encryption result
export interface EncryptionResult {
  success: true;
  data: EncryptedData;
}

export interface EncryptionError {
  success: false;
  error: string;
  code: string;
}

export type EncryptResult = EncryptionResult | EncryptionError;

// Decryption result
export interface DecryptionResult {
  success: true;
  plaintext: string;
}

export interface DecryptionError {
  success: false;
  error: string;
  code: string;
}

export type DecryptResult = DecryptionResult | DecryptionError;

// Key export format (for backup)
export interface ExportedKey {
  version: number;
  keyMaterial: string; // Base64 encoded
  algorithm: string;
  extractable: boolean;
  usages: KeyUsage[];
}

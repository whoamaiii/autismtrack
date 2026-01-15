/**
 * Crypto module exports
 */

// Types
export type {
  EncryptedData,
  EncryptResult,
  DecryptResult,
  EncryptionResult,
  EncryptionError,
  DecryptionResult,
  DecryptionError,
  KeyDerivationParams,
  ExportedKey,
} from './types';

// AES-GCM encryption
export {
  generateEncryptionKey,
  importKey,
  exportKey,
  encrypt,
  decrypt,
  reEncrypt,
} from './aesGcm';

// Key derivation
export {
  generateDeviceSalt,
  deriveStorageKey,
  deriveHmacKey,
  generateDeviceKey,
  isValidDeviceKey,
} from './keyDerivation';

// Utilities
export {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  base64ToUint8Array,
  uint8ArrayToBase64,
  generateRandomBytes,
  generateUUID,
  timingSafeEqual,
  sha256,
  isValidBase64,
  isWebCryptoAvailable,
} from './utils';

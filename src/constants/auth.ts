/**
 * Authentication configuration constants
 * Centralized auth settings for biometric + QR unlock system
 */

export const AUTH_CONFIG = {
  // QR Time-To-Live settings
  QR_TTL_MINUTES: 30,
  QR_WARNING_THRESHOLD_MINUTES: 5, // Show warning when < 5 minutes remaining

  // Biometric settings
  BIOMETRIC_GRACE_PERIOD_SECONDS: 30, // Skip biometric if just unlocked
  MAX_BIOMETRIC_ATTEMPTS: 5, // Before requiring QR

  // Session settings
  SESSION_TIMEOUT_MINUTES: 5, // Lock after inactivity
  LOCK_ON_BACKGROUND: true, // Lock when app goes to background

  // Encryption settings
  ENCRYPTION_ALGORITHM: 'AES-GCM' as const,
  KEY_LENGTH_BITS: 256,
  IV_LENGTH_BYTES: 12,
  SALT_LENGTH_BYTES: 16,
  HKDF_INFO: 'neurologg-storage-v1',

  // QR payload version
  QR_PAYLOAD_VERSION: '1.0.0' as const,
} as const;

// Auth storage keys (separate from main app storage)
export const AUTH_STORAGE_KEYS = {
  // Enrollment state
  ENROLLMENT_STATUS: 'kreativium_auth_enrollment',
  BIOMETRIC_CREDENTIAL: 'kreativium_auth_biometric_credential',
  QR_ENROLLMENT: 'kreativium_auth_qr_enrollment',

  // Session state
  LAST_QR_VALIDATION: 'kreativium_auth_last_qr',
  SESSION_START: 'kreativium_auth_session_start',
  LAST_ACTIVITY: 'kreativium_auth_last_activity',

  // Encryption keys (stored securely)
  DEVICE_SALT: 'kreativium_auth_device_salt',
  KEY_VERSION: 'kreativium_auth_key_version',

  // Migration tracking
  MIGRATION_COMPLETE: 'kreativium_auth_migration_complete',
  MIGRATION_BACKUP: 'kreativium_auth_migration_backup',
} as const;

// Error codes for auth failures
export const AUTH_ERROR_CODES = {
  // Biometric errors
  BIOMETRIC_NOT_AVAILABLE: 'BIOMETRIC_NOT_AVAILABLE',
  BIOMETRIC_NOT_ENROLLED: 'BIOMETRIC_NOT_ENROLLED',
  BIOMETRIC_LOCKOUT: 'BIOMETRIC_LOCKOUT',
  BIOMETRIC_LOCKOUT_PERMANENT: 'BIOMETRIC_LOCKOUT_PERMANENT',
  BIOMETRIC_CANCELLED: 'BIOMETRIC_CANCELLED',
  BIOMETRIC_FAILED: 'BIOMETRIC_FAILED',

  // QR errors
  QR_INVALID_FORMAT: 'QR_INVALID_FORMAT',
  QR_INVALID_SCHEMA: 'QR_INVALID_SCHEMA',
  QR_EXPIRED: 'QR_EXPIRED',
  QR_VERSION_UNSUPPORTED: 'QR_VERSION_UNSUPPORTED',
  QR_KEY_MISMATCH: 'QR_KEY_MISMATCH',
  QR_SCAN_FAILED: 'QR_SCAN_FAILED',

  // Session errors
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_INVALID: 'SESSION_INVALID',

  // Encryption errors
  ENCRYPTION_FAILED: 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED: 'DECRYPTION_FAILED',
  KEY_DERIVATION_FAILED: 'KEY_DERIVATION_FAILED',

  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type AuthErrorCode = typeof AUTH_ERROR_CODES[keyof typeof AUTH_ERROR_CODES];

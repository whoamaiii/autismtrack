/**
 * Authentication Types
 * Types for biometric + QR unlock system
 */

import type { AuthErrorCode } from '../constants/auth';
import type { QRPermissions } from '../utils/qrPayloadSchema';

// ============================================
// AUTH STATE MACHINE
// ============================================

/**
 * Authentication state machine states
 */
export type AuthState =
  | 'initializing'     // App starting, checking enrollment
  | 'enrolling'        // First-time enrollment in progress
  | 'locked'           // Fully locked, no access
  | 'biometricPending' // Awaiting biometric verification
  | 'qrPending'        // Biometric passed, QR expired
  | 'unlocked'         // Full access granted
  | 'error';           // Authentication failed

/**
 * Authentication method used
 */
export type AuthMethod = 'biometric' | 'qr' | 'combined';

// ============================================
// BIOMETRIC TYPES
// ============================================

/**
 * Available biometric authentication methods
 */
export type BiometricType =
  | 'fingerprint'
  | 'face'
  | 'iris'
  | 'unknown';

/**
 * Biometric capability status
 */
export interface BiometricCapability {
  available: boolean;
  enrolled: boolean;
  type: BiometricType;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Stored biometric credential reference
 */
export interface BiometricCredential {
  id: string;
  type: BiometricType;
  enrolledAt: string;
  lastUsed?: string;
  platform: 'android' | 'web';
}

/**
 * Biometric authentication result
 */
export interface BiometricAuthResult {
  success: boolean;
  type?: BiometricType;
  errorCode?: string;
  errorMessage?: string;
  timestamp: string;
}

// ============================================
// QR ENROLLMENT
// ============================================

/**
 * QR enrollment state stored locally
 */
export interface QREnrollment {
  enrolledAt: string;
  keyFingerprint: string; // First 8 chars of SHA-256(deviceKey)
  keyHash: string;        // Full SHA-256(deviceKey) for validation
  permissions: QRPermissions;
  pgpPublicKey: string;   // Stored for export encryption
}

/**
 * QR validation state
 */
export interface QRValidationState {
  validatedAt: string;
  qrHash: string; // SHA-256 of QR payload for change detection
  expiresAt: string;
}

// ============================================
// SESSION
// ============================================

/**
 * Active authentication session
 */
export interface AuthSession {
  id: string;
  startedAt: string;
  lastActivity: string;
  authMethod: AuthMethod;
  biometricValidatedAt?: string;
  qrValidatedAt?: string;
}

// ============================================
// AUTH ERROR
// ============================================

/**
 * Authentication error details
 */
export interface AuthError {
  code: AuthErrorCode;
  message: string;
  recoverable: boolean;
  timestamp: string;
  details?: string[];
}

// ============================================
// AUTH CONTEXT TYPE
// ============================================

/**
 * Full authentication context type
 */
export interface AuthContextType {
  // Current state
  state: AuthState;
  error: AuthError | null;

  // Capabilities
  biometricCapability: BiometricCapability | null;
  qrEnrolled: boolean;

  // Session info
  session: AuthSession | null;
  qrTTLRemaining: number; // seconds remaining until QR required

  // Enrollment status
  isEnrolled: boolean;
  enrollment: {
    biometric: BiometricCredential | null;
    qr: QREnrollment | null;
  };

  // Actions
  requestBiometric: () => Promise<BiometricAuthResult>;
  validateQR: (qrData: string) => Promise<{ success: boolean; error?: AuthError }>;
  lock: () => void;
  clearError: () => void;

  // Enrollment actions
  enrollBiometric: () => Promise<BiometricAuthResult>;
  enrollQR: (qrData: string) => Promise<{ success: boolean; error?: AuthError }>;
  completeEnrollment: () => Promise<void>;
  unenroll: () => Promise<void>;

  // Storage key access (only when unlocked)
  getEncryptionKey: () => CryptoKey | null;

  // Development mode - skip auth entirely
  devModeUnlock: () => void;
}

// ============================================
// WEBAUTHN TYPES (for PWA)
// ============================================

/**
 * WebAuthn credential stored in IndexedDB
 */
export interface WebAuthnCredential {
  id: string; // Base64 credential ID
  rawId: string; // Base64 raw ID
  type: 'public-key';
  createdAt: string;
  lastUsed?: string;
}

/**
 * WebAuthn registration result
 */
export interface WebAuthnRegistrationResult {
  success: boolean;
  credential?: WebAuthnCredential;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * WebAuthn authentication result
 */
export interface WebAuthnAuthResult {
  success: boolean;
  credentialId?: string;
  errorCode?: string;
  errorMessage?: string;
}

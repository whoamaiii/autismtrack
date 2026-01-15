/**
 * QR Payload Schema and Validation
 * Defines the structure of unlock QR codes and validates them
 */

import { z } from 'zod';
import { AUTH_CONFIG, AUTH_ERROR_CODES, type AuthErrorCode } from '../constants/auth';
import { isValidDeviceKey } from '../services/crypto';

// Base64-encoded 256-bit key validation
const deviceKeySchema = z.string()
  .min(43, 'Device key too short')
  .max(44, 'Device key too long')
  .refine(isValidDeviceKey, {
    message: 'Invalid device key format (must be 256-bit base64)',
  });

// PGP public key validation
const pgpPublicKeySchema = z.string()
  .startsWith('-----BEGIN PGP PUBLIC KEY BLOCK-----', {
    message: 'Invalid PGP public key format',
  })
  .includes('-----END PGP PUBLIC KEY BLOCK-----', {
    message: 'PGP public key missing end block',
  });

// Permission flags
const permissionsSchema = z.object({
  canExport: z.boolean(),
  canDeleteData: z.boolean(),
  canModifyProfile: z.boolean(),
});

// Full QR payload schema
export const QRPayloadSchema = z.object({
  version: z.literal(AUTH_CONFIG.QR_PAYLOAD_VERSION),
  deviceKey: deviceKeySchema,
  pgpPublicKey: pgpPublicKeySchema,
  issuedAt: z.string().datetime({ message: 'Invalid issuedAt timestamp' }),
  expiresAt: z.string().datetime({ message: 'Invalid expiresAt timestamp' }).optional(),
  permissions: permissionsSchema,
});

export type QRPayload = z.infer<typeof QRPayloadSchema>;
export type QRPermissions = z.infer<typeof permissionsSchema>;

// Validation result types
export interface QRValidationSuccess {
  success: true;
  payload: QRPayload;
}

export interface QRValidationError {
  success: false;
  code: AuthErrorCode;
  message: string;
  details?: string[];
}

export type QRValidationResult = QRValidationSuccess | QRValidationError;

/**
 * Parse and validate a QR code data string
 * @param qrData - Raw string data from QR code scan
 * @returns Validated QR payload or error
 */
export function parseQrPayload(qrData: string): QRValidationResult {
  // Step 1: Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(qrData);
  } catch {
    return {
      success: false,
      code: AUTH_ERROR_CODES.QR_INVALID_FORMAT,
      message: 'QR code does not contain valid JSON',
    };
  }

  // Step 2: Check version before full validation
  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (obj.version && obj.version !== AUTH_CONFIG.QR_PAYLOAD_VERSION) {
      return {
        success: false,
        code: AUTH_ERROR_CODES.QR_VERSION_UNSUPPORTED,
        message: `QR version "${obj.version}" is not supported. Expected "${AUTH_CONFIG.QR_PAYLOAD_VERSION}"`,
      };
    }
  }

  // Step 3: Validate against schema
  const result = QRPayloadSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
    return {
      success: false,
      code: AUTH_ERROR_CODES.QR_INVALID_SCHEMA,
      message: 'QR code data does not match expected format',
      details: errors,
    };
  }

  // Step 4: Check expiration (if set)
  const payload = result.data;
  if (payload.expiresAt) {
    const expiresAt = new Date(payload.expiresAt).getTime();
    if (Date.now() > expiresAt) {
      return {
        success: false,
        code: AUTH_ERROR_CODES.QR_EXPIRED,
        message: 'QR code has expired',
      };
    }
  }

  return {
    success: true,
    payload,
  };
}

/**
 * Validate that a scanned QR matches the enrolled device key
 * @param scannedPayload - Newly scanned QR payload
 * @param enrolledKeyHash - SHA-256 hash of enrolled device key
 */
export async function validateQrKeyMatch(
  scannedPayload: QRPayload,
  enrolledKeyHash: string
): Promise<QRValidationResult> {
  const { sha256 } = await import('../services/crypto');
  const scannedKeyHash = await sha256(scannedPayload.deviceKey);

  if (scannedKeyHash !== enrolledKeyHash) {
    return {
      success: false,
      code: AUTH_ERROR_CODES.QR_KEY_MISMATCH,
      message: 'QR code does not match enrolled device',
    };
  }

  return {
    success: true,
    payload: scannedPayload,
  };
}

/**
 * Extract device key fingerprint for display (first 8 chars of hash)
 */
export async function getKeyFingerprint(deviceKey: string): Promise<string> {
  const { sha256 } = await import('../services/crypto');
  const hash = await sha256(deviceKey);
  return hash.substring(0, 8).toUpperCase();
}

/**
 * Create a QR payload for admin tool
 * This would typically be used by a separate admin/provisioning app
 */
export function createQrPayload(
  deviceKey: string,
  pgpPublicKey: string,
  permissions: Partial<QRPermissions> = {}
): QRPayload {
  return {
    version: AUTH_CONFIG.QR_PAYLOAD_VERSION,
    deviceKey,
    pgpPublicKey,
    issuedAt: new Date().toISOString(),
    permissions: {
      canExport: true,
      canDeleteData: false,
      canModifyProfile: true,
      ...permissions,
    },
  };
}

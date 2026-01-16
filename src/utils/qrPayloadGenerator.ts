/**
 * QR Payload Generator
 * Generates valid QR payloads for device enrollment and authentication
 *
 * This utility is primarily for:
 * - Admin/caregiver tool to create enrollment QR codes
 * - Development/testing purposes
 *
 * In production, this would typically be run on a separate admin device/app
 */

import { generateDeviceKey } from '../services/crypto/keyDerivation';
import type { QRPayload, QRPermissions } from '../utils/qrPayloadSchema';

/**
 * Default permissions for a new device
 */
export const DEFAULT_PERMISSIONS: QRPermissions = {
  canExport: true,
  canDeleteData: true,
  canModifyProfile: true,
};

/**
 * Restricted permissions (e.g., for a child's device)
 */
export const RESTRICTED_PERMISSIONS: QRPermissions = {
  canExport: false,
  canDeleteData: false,
  canModifyProfile: false,
};

/**
 * Generate a minimal PGP public key placeholder
 * In production, this would be a real PGP key generated with openpgp.js
 */
function generatePlaceholderPgpKey(): string {
  // This is a placeholder - in production, use openpgp.generateKey()
  // The key is used for encrypted exports
  return `-----BEGIN PGP PUBLIC KEY BLOCK-----

mQINBGdHAAAAAAEEALnPbLQpz4EXAMPLE_PLACEHOLDER_KEY
This is a placeholder for development/testing.
In production, generate a real PGP key pair.
=XXXX
-----END PGP PUBLIC KEY BLOCK-----`;
}

export interface GeneratedQRPayload {
  /**
   * The full QR payload as JSON string (scan this)
   */
  qrString: string;

  /**
   * The parsed payload object
   */
  payload: QRPayload;

  /**
   * The device key (keep secret - only share via QR)
   */
  deviceKey: string;

  /**
   * Instructions for use
   */
  instructions: string;
}

/**
 * Generate a new QR payload for device enrollment
 *
 * @param permissions - What the device is allowed to do
 * @param pgpPublicKey - Optional PGP public key for encrypted exports
 * @returns Generated QR payload and metadata
 */
export function generateQRPayload(
  permissions: QRPermissions = DEFAULT_PERMISSIONS,
  pgpPublicKey?: string
): GeneratedQRPayload {
  // Generate a new 256-bit device key
  const deviceKey = generateDeviceKey();

  // Use provided PGP key or placeholder
  const pgpKey = pgpPublicKey || generatePlaceholderPgpKey();

  // Create the payload
  const payload: QRPayload = {
    version: '1.0.0',
    deviceKey,
    pgpPublicKey: pgpKey,
    issuedAt: new Date().toISOString(),
    permissions,
  };

  // Convert to JSON string for QR code
  const qrString = JSON.stringify(payload);

  return {
    qrString,
    payload,
    deviceKey,
    instructions: `
QR Code Generated Successfully!

IMPORTANT SECURITY NOTES:
1. This QR code contains a secret device key
2. Anyone with this QR code can unlock the app
3. Store this QR code securely (print and lock away, or save encrypted)
4. Do not share this QR code digitally (no screenshots, no messaging)

TO USE:
1. Open the Kreativium app on the target device
2. When prompted, scan this QR code
3. The device will be enrolled and unlocked

QR TTL:
- After scanning, the QR must be re-scanned every 30 minutes
- This ensures only authorized users with physical QR access can use the app

Permissions granted:
- Export data: ${permissions.canExport ? 'YES' : 'NO'}
- Delete data: ${permissions.canDeleteData ? 'YES' : 'NO'}
- Modify profile: ${permissions.canModifyProfile ? 'YES' : 'NO'}
`.trim(),
  };
}

/**
 * Generate a test QR payload for development
 * Uses predictable values for easier testing
 */
export function generateTestQRPayload(): GeneratedQRPayload {
  return generateQRPayload(DEFAULT_PERMISSIONS);
}

/**
 * Pretty print a QR payload for display
 */
export function formatQRPayloadForDisplay(payload: QRPayload): string {
  return JSON.stringify(
    {
      ...payload,
      // Truncate the device key for display (show first/last 8 chars)
      deviceKey: `${payload.deviceKey.slice(0, 8)}...${payload.deviceKey.slice(-8)}`,
      // Truncate PGP key
      pgpPublicKey: payload.pgpPublicKey.split('\n')[0] + '...',
    },
    null,
    2
  );
}

/**
 * Console-based QR generator for development
 * Run this in browser console to generate a test QR
 */
export function printTestQR(): void {
  const result = generateTestQRPayload();

  console.log('='.repeat(60));
  console.log('TEST QR PAYLOAD GENERATED');
  console.log('='.repeat(60));
  console.log('\nCopy this JSON and paste it in the QR input field:\n');
  console.log(result.qrString);
  console.log('\n' + '='.repeat(60));
  console.log('Display format (truncated):');
  console.log(formatQRPayloadForDisplay(result.payload));
  console.log('='.repeat(60));
  console.log(result.instructions);
}

// Export for use in browser console during development
if (typeof window !== 'undefined') {
  // Make available globally for console access
  (window as unknown as { generateTestQR: typeof printTestQR }).generateTestQR = printTestQR;
  (window as unknown as { generateQRPayload: typeof generateQRPayload }).generateQRPayload =
    generateQRPayload;
}

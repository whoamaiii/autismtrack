/**
 * Biometric Authentication Service
 * Cross-platform wrapper for biometric authentication
 */

import { registerPlugin } from '@capacitor/core';
import { isAndroid, isNative } from '../utils/platform';
import type {
  BiometricCapability,
  BiometricAuthResult,
  BiometricType,
} from '../types/auth';

// ============================================
// NATIVE PLUGIN INTERFACE
// ============================================

interface BiometricPluginInterface {
  isAvailable(): Promise<{
    available: boolean;
    strongAvailable: boolean;
    biometryType: string;
    errorCode: string | null;
    errorMessage: string | null;
  }>;

  checkEnrollment(): Promise<{
    hardwareAvailable: boolean;
    enrolled: boolean;
    needsEnrollment: boolean;
    errorCode: string | null;
  }>;

  authenticate(options: {
    title: string;
    subtitle?: string;
    description?: string;
    negativeButtonText?: string;
    allowDeviceCredential?: boolean;
  }): Promise<{
    success: boolean;
    authenticationType?: string;
    errorCode?: string;
    errorMessage?: string;
    timestamp: number;
  }>;

  cancelAuthentication(): Promise<{ cancelled: boolean }>;
}

// Register the native plugin (only available on Android)
const BiometricPlugin = registerPlugin<BiometricPluginInterface>('Biometric');

// ============================================
// PUBLIC API
// ============================================

/**
 * Check if biometric authentication is available on this device
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isNative() || !isAndroid()) {
    // For PWA, check WebAuthn availability
    return isWebAuthnAvailable();
  }

  try {
    const result = await BiometricPlugin.isAvailable();
    return result.available;
  } catch (error) {
    console.error('[BiometricAuth] Error checking availability:', error);
    return false;
  }
}

/**
 * Get detailed biometric capability information
 */
export async function getBiometricCapability(): Promise<BiometricCapability> {
  if (!isNative() || !isAndroid()) {
    // For PWA, return WebAuthn capability
    return getWebAuthnCapability();
  }

  try {
    const [availability, enrollment] = await Promise.all([
      BiometricPlugin.isAvailable(),
      BiometricPlugin.checkEnrollment(),
    ]);

    return {
      available: availability.available,
      enrolled: enrollment.enrolled,
      type: mapBiometryType(availability.biometryType),
      errorCode: availability.errorCode ?? undefined,
      errorMessage: availability.errorMessage ?? undefined,
    };
  } catch (error) {
    console.error('[BiometricAuth] Error getting capability:', error);
    return {
      available: false,
      enrolled: false,
      type: 'unknown',
      errorCode: 'PLUGIN_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Authenticate user with biometric
 */
export async function authenticateWithBiometric(options?: {
  title?: string;
  subtitle?: string;
  description?: string;
  negativeButtonText?: string;
  allowDeviceCredential?: boolean;
}): Promise<BiometricAuthResult> {
  const defaultOptions = {
    title: 'Unlock NeuroLogg',
    subtitle: 'Authenticate to access your data',
    description: '',
    negativeButtonText: 'Cancel',
    allowDeviceCredential: false,
    ...options,
  };

  if (!isNative() || !isAndroid()) {
    // For PWA, use WebAuthn
    return authenticateWithWebAuthn();
  }

  try {
    const result = await BiometricPlugin.authenticate(defaultOptions);

    return {
      success: result.success,
      type: result.authenticationType === 'biometric' ? 'fingerprint' : 'unknown',
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      timestamp: new Date(result.timestamp).toISOString(),
    };
  } catch (error) {
    console.error('[BiometricAuth] Authentication error:', error);
    return {
      success: false,
      errorCode: 'AUTHENTICATION_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Cancel an in-progress biometric authentication
 */
export async function cancelBiometricAuth(): Promise<void> {
  if (!isNative() || !isAndroid()) {
    return; // WebAuthn cancellation handled by browser
  }

  try {
    await BiometricPlugin.cancelAuthentication();
  } catch (error) {
    console.error('[BiometricAuth] Cancel error:', error);
  }
}

// ============================================
// WEBAUTHN (PWA) FALLBACK
// ============================================

/**
 * Check if WebAuthn is available (for PWA)
 */
export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof window.PublicKeyCredential === 'function'
  );
}

/**
 * Check if platform authenticator (TouchID, FaceID, Windows Hello) is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnAvailable()) {
    return false;
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Get WebAuthn capability for PWA
 */
async function getWebAuthnCapability(): Promise<BiometricCapability> {
  const available = isWebAuthnAvailable();
  const platformAuthAvailable = available ? await isPlatformAuthenticatorAvailable() : false;

  // Check if credential is enrolled (stored in IndexedDB)
  const hasCredential = await hasStoredWebAuthnCredential();

  return {
    available: platformAuthAvailable,
    enrolled: hasCredential,
    type: platformAuthAvailable ? 'unknown' : 'unknown', // Can't determine specific type in WebAuthn
    errorCode: !available ? 'WEBAUTHN_NOT_SUPPORTED' : undefined,
    errorMessage: !available ? 'WebAuthn is not supported in this browser' : undefined,
  };
}

/**
 * Authenticate using WebAuthn (for PWA)
 */
async function authenticateWithWebAuthn(): Promise<BiometricAuthResult> {
  if (!isWebAuthnAvailable()) {
    return {
      success: false,
      errorCode: 'WEBAUTHN_NOT_SUPPORTED',
      errorMessage: 'WebAuthn is not supported in this browser',
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const credential = await getStoredWebAuthnCredential();
    if (!credential) {
      return {
        success: false,
        errorCode: 'NO_CREDENTIAL',
        errorMessage: 'No WebAuthn credential enrolled. Please set up biometric first.',
        timestamp: new Date().toISOString(),
      };
    }

    // Generate challenge
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [
        {
          id: base64ToArrayBuffer(credential.rawId),
          type: 'public-key',
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyOptions,
    });

    if (assertion) {
      // Update last used timestamp
      await updateCredentialLastUsed(credential.id);

      return {
        success: true,
        type: 'unknown',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: false,
      errorCode: 'AUTHENTICATION_FAILED',
      errorMessage: 'WebAuthn authentication failed',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'Unknown';
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      errorCode: errorName === 'NotAllowedError' ? 'USER_CANCELLED' : 'AUTHENTICATION_ERROR',
      errorMessage: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================
// WEBAUTHN CREDENTIAL STORAGE (IndexedDB)
// ============================================

const WEBAUTHN_DB_NAME = 'neurologg-webauthn';
const WEBAUTHN_STORE_NAME = 'credentials';

interface StoredCredential {
  id: string;
  rawId: string;
  type: 'public-key';
  createdAt: string;
  lastUsed?: string;
}

async function openWebAuthnDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WEBAUTHN_DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(WEBAUTHN_STORE_NAME)) {
        db.createObjectStore(WEBAUTHN_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function hasStoredWebAuthnCredential(): Promise<boolean> {
  try {
    const db = await openWebAuthnDB();
    return new Promise((resolve) => {
      const tx = db.transaction(WEBAUTHN_STORE_NAME, 'readonly');
      const store = tx.objectStore(WEBAUTHN_STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

async function getStoredWebAuthnCredential(): Promise<StoredCredential | null> {
  try {
    const db = await openWebAuthnDB();
    return new Promise((resolve) => {
      const tx = db.transaction(WEBAUTHN_STORE_NAME, 'readonly');
      const store = tx.objectStore(WEBAUTHN_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const credentials = request.result as StoredCredential[];
        resolve(credentials[0] || null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function updateCredentialLastUsed(id: string): Promise<void> {
  try {
    const db = await openWebAuthnDB();
    const tx = db.transaction(WEBAUTHN_STORE_NAME, 'readwrite');
    const store = tx.objectStore(WEBAUTHN_STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      const credential = request.result as StoredCredential;
      if (credential) {
        credential.lastUsed = new Date().toISOString();
        store.put(credential);
      }
    };
  } catch {
    // Ignore errors updating last used
  }
}

/**
 * Register a new WebAuthn credential (for enrollment)
 */
export async function registerWebAuthnCredential(userId: string): Promise<{
  success: boolean;
  credential?: StoredCredential;
  error?: string;
}> {
  if (!isWebAuthnAvailable()) {
    return {
      success: false,
      error: 'WebAuthn is not supported in this browser',
    };
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'NeuroLogg Pro',
        id: window.location.hostname,
      },
      user: {
        id: new TextEncoder().encode(userId),
        name: userId,
        displayName: 'NeuroLogg User',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };

    const credential = await navigator.credentials.create({
      publicKey: publicKeyOptions,
    }) as PublicKeyCredential;

    if (!credential) {
      return {
        success: false,
        error: 'Failed to create credential',
      };
    }

    // Store credential reference
    const storedCredential: StoredCredential = {
      id: arrayBufferToBase64(credential.rawId),
      rawId: arrayBufferToBase64(credential.rawId),
      type: 'public-key',
      createdAt: new Date().toISOString(),
    };

    const db = await openWebAuthnDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WEBAUTHN_STORE_NAME, 'readwrite');
      const store = tx.objectStore(WEBAUTHN_STORE_NAME);
      const request = store.put(storedCredential);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    return {
      success: true,
      credential: storedCredential,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// HELPERS
// ============================================

function mapBiometryType(type: string): BiometricType {
  switch (type) {
    case 'strong':
    case 'fingerprint':
      return 'fingerprint';
    case 'face':
      return 'face';
    case 'iris':
      return 'iris';
    default:
      return 'unknown';
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

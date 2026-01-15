/* eslint-disable react-refresh/only-export-components */
/**
 * Authentication Context
 * Manages biometric + QR unlock state machine
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { App } from '@capacitor/app';

import { AUTH_CONFIG, AUTH_STORAGE_KEYS, AUTH_ERROR_CODES } from '../constants/auth';
import { isNative } from '../utils/platform';
import {
  isBiometricAvailable,
  getBiometricCapability,
  authenticateWithBiometric,
} from '../services/biometricAuth';
import {
  parseQrPayload,
  validateQrKeyMatch,
  getKeyFingerprint,
  type QRPayload,
} from '../utils/qrPayloadSchema';
import {
  deriveStorageKey,
  generateDeviceSalt,
  sha256,
  uint8ArrayToBase64,
  base64ToUint8Array,
} from '../services/crypto';

import type {
  AuthState,
  AuthContextType,
  AuthError,
  AuthSession,
  BiometricCapability,
  BiometricCredential,
  BiometricAuthResult,
  QREnrollment,
} from '../types/auth';

// ============================================
// CONTEXT
// ============================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// PROVIDER
// ============================================

interface AuthProviderProps {
  children: React.ReactNode;
  /**
   * If true, skip auth requirements (for development)
   */
  bypassAuth?: boolean;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  bypassAuth = false,
}) => {
  // State - use lazy initializer to handle bypassAuth
  const [state, setState] = useState<AuthState>(() =>
    bypassAuth ? 'unlocked' : 'initializing'
  );
  const [error, setError] = useState<AuthError | null>(null);
  const [biometricCapability, setBiometricCapability] = useState<BiometricCapability | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [qrTTLRemaining, setQrTTLRemaining] = useState(0);

  // Enrollment state
  const [biometricCredential, setBiometricCredential] = useState<BiometricCredential | null>(null);
  const [qrEnrollment, setQrEnrollment] = useState<QREnrollment | null>(null);

  // Encryption key (only available when unlocked)
  const encryptionKeyRef = useRef<CryptoKey | null>(null);
  const deviceSaltRef = useRef<Uint8Array | null>(null);

  // TTL timer
  const ttlTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // STORAGE HELPERS (defined first - no dependencies)
  // ============================================

  const loadQrEnrollment = (): QREnrollment | null => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEYS.QR_ENROLLMENT);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const loadBiometricCredential = (): BiometricCredential | null => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEYS.BIOMETRIC_CREDENTIAL);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const loadDeviceSalt = (): Uint8Array | null => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEYS.DEVICE_SALT);
      return saved ? base64ToUint8Array(saved) : null;
    } catch {
      return null;
    }
  };

  // ============================================
  // KEY DERIVATION (must be defined before validateQR/enrollQR)
  // ============================================

  const deriveAndStoreKey = useCallback(async (payload: QRPayload): Promise<void> => {
    // Ensure we have device salt
    if (!deviceSaltRef.current) {
      deviceSaltRef.current = generateDeviceSalt();
      localStorage.setItem(
        AUTH_STORAGE_KEYS.DEVICE_SALT,
        uint8ArrayToBase64(deviceSaltRef.current)
      );
    }

    // Derive storage key
    encryptionKeyRef.current = await deriveStorageKey(
      payload.deviceKey,
      deviceSaltRef.current
    );
  }, []);

  // ============================================
  // FINALIZE UNLOCK (must be defined before requestBiometric/validateQR)
  // ============================================

  const finalizeUnlock = useCallback(async () => {
    // Create session
    const newSession: AuthSession = {
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      authMethod: 'combined',
      biometricValidatedAt: new Date().toISOString(),
      qrValidatedAt: new Date().toISOString(),
    };
    setSession(newSession);

    // Clear any errors
    setError(null);

    // Update state
    setState('unlocked');
  }, []);

  // ============================================
  // INITIALIZATION
  // ============================================

  const initializeAuth = useCallback(async () => {
    setState('initializing');

    try {
      // Check biometric capability
      const capability = await getBiometricCapability();
      setBiometricCapability(capability);

      // Load enrollment state from storage
      const savedQrEnrollment = loadQrEnrollment();
      setQrEnrollment(savedQrEnrollment);

      const savedBiometricCredential = loadBiometricCredential();
      setBiometricCredential(savedBiometricCredential);

      // Load device salt
      deviceSaltRef.current = loadDeviceSalt();

      // Check if enrolled
      const isEnrolled = savedQrEnrollment !== null;

      if (!isEnrolled) {
        // First time - need enrollment
        setState('enrolling');
        return;
      }

      // Start unlock flow
      setState('biometricPending');
    } catch (err) {
      console.error('[Auth] Initialization error:', err);
      setError({
        code: AUTH_ERROR_CODES.UNKNOWN_ERROR,
        message: 'Failed to initialize authentication',
        recoverable: true,
        timestamp: new Date().toISOString(),
      });
      setState('error');
    }
  }, []);

  // Initialize auth on mount - this is a valid initialization pattern
  useEffect(() => {
    // Skip initialization if auth is bypassed (state already set via lazy initializer)
    if (bypassAuth) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- valid init pattern
    initializeAuth();
  }, [bypassAuth, initializeAuth]);

  // ============================================
  // QR TTL MANAGEMENT
  // ============================================

  const checkQrTTL = useCallback((): boolean => {
    const lastQrValidation = localStorage.getItem(AUTH_STORAGE_KEYS.LAST_QR_VALIDATION);
    if (!lastQrValidation) {
      return true; // No QR validation - expired
    }

    try {
      const { validatedAt } = JSON.parse(lastQrValidation);
      const validatedTime = new Date(validatedAt).getTime();
      const expiresAt = validatedTime + AUTH_CONFIG.QR_TTL_MINUTES * 60 * 1000;
      const now = Date.now();

      if (now >= expiresAt) {
        return true; // Expired
      }

      // Update remaining time
      setQrTTLRemaining(Math.floor((expiresAt - now) / 1000));
      return false; // Still valid
    } catch {
      return true; // Error parsing - treat as expired
    }
  }, []);

  // ============================================
  // APP STATE HANDLING
  // ============================================

  useEffect(() => {
    if (!isNative() || bypassAuth) return;

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    // Lock when app goes to background (if configured)
    const setupListener = async () => {
      listenerHandle = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive && AUTH_CONFIG.LOCK_ON_BACKGROUND && state === 'unlocked') {
          // App went to background - lock after grace period
          // For now, we'll require auth on resume regardless
        }

        if (isActive && state === 'unlocked') {
          // App resumed - check if QR TTL expired
          checkQrTTL();
        }
      });
    };

    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [state, bypassAuth, checkQrTTL]);

  // Start TTL countdown timer when unlocked
  useEffect(() => {
    if (state !== 'unlocked') {
      if (ttlTimerRef.current) {
        clearInterval(ttlTimerRef.current);
        ttlTimerRef.current = null;
      }
      return;
    }

    // Update TTL every second
    ttlTimerRef.current = setInterval(() => {
      const expired = checkQrTTL();
      if (expired) {
        // QR expired - need to re-authenticate
        setState('qrPending');
      }
    }, 1000);

    return () => {
      if (ttlTimerRef.current) {
        clearInterval(ttlTimerRef.current);
      }
    };
  }, [state, checkQrTTL]);

  // ============================================
  // BIOMETRIC AUTHENTICATION
  // ============================================

  const requestBiometric = useCallback(async (): Promise<BiometricAuthResult> => {
    if (!await isBiometricAvailable()) {
      return {
        success: false,
        errorCode: AUTH_ERROR_CODES.BIOMETRIC_NOT_AVAILABLE,
        errorMessage: 'Biometric authentication not available',
        timestamp: new Date().toISOString(),
      };
    }

    setState('biometricPending');

    const result = await authenticateWithBiometric({
      title: 'Unlock NeuroLogg',
      subtitle: 'Authenticate to access your data',
    });

    if (!result.success) {
      setError({
        code: result.errorCode as typeof AUTH_ERROR_CODES[keyof typeof AUTH_ERROR_CODES] ?? AUTH_ERROR_CODES.BIOMETRIC_FAILED,
        message: result.errorMessage ?? 'Biometric authentication failed',
        recoverable: true,
        timestamp: new Date().toISOString(),
      });
      setState('error');
      return result;
    }

    // Biometric succeeded - check QR TTL
    const qrExpired = checkQrTTL();

    if (qrExpired) {
      setState('qrPending');
    } else {
      // Both checks passed - unlock
      await finalizeUnlock();
    }

    return result;
  }, [checkQrTTL, finalizeUnlock]);

  // ============================================
  // QR VALIDATION
  // ============================================

  const validateQR = useCallback(async (qrData: string): Promise<{
    success: boolean;
    error?: AuthError;
  }> => {
    // Parse QR payload
    const parseResult = parseQrPayload(qrData);
    if (!parseResult.success) {
      const authError: AuthError = {
        code: parseResult.code,
        message: parseResult.message,
        recoverable: true,
        timestamp: new Date().toISOString(),
        details: parseResult.details,
      };
      setError(authError);
      return { success: false, error: authError };
    }

    // Check if this QR matches enrolled device
    if (qrEnrollment) {
      const matchResult = await validateQrKeyMatch(
        parseResult.payload,
        qrEnrollment.keyHash
      );

      if (!matchResult.success) {
        const authError: AuthError = {
          code: matchResult.code,
          message: matchResult.message,
          recoverable: true,
          timestamp: new Date().toISOString(),
        };
        setError(authError);
        return { success: false, error: authError };
      }
    }

    // Record QR validation
    const validationState = {
      validatedAt: new Date().toISOString(),
      qrHash: await sha256(qrData),
      expiresAt: new Date(Date.now() + AUTH_CONFIG.QR_TTL_MINUTES * 60 * 1000).toISOString(),
    };
    localStorage.setItem(
      AUTH_STORAGE_KEYS.LAST_QR_VALIDATION,
      JSON.stringify(validationState)
    );

    // Derive encryption key from QR
    await deriveAndStoreKey(parseResult.payload);

    // Unlock
    await finalizeUnlock();

    return { success: true };
  }, [qrEnrollment, deriveAndStoreKey, finalizeUnlock]);

  // ============================================
  // ENROLLMENT
  // ============================================

  const enrollBiometric = useCallback(async (): Promise<BiometricAuthResult> => {
    const capability = await getBiometricCapability();
    setBiometricCapability(capability);

    if (!capability.available) {
      return {
        success: false,
        errorCode: AUTH_ERROR_CODES.BIOMETRIC_NOT_AVAILABLE,
        errorMessage: capability.errorMessage ?? 'Biometric not available',
        timestamp: new Date().toISOString(),
      };
    }

    // Authenticate to verify biometric works
    const result = await authenticateWithBiometric({
      title: 'Set Up Biometric',
      subtitle: 'Verify your biometric to enable unlock',
    });

    if (result.success) {
      // Save credential reference
      const credential: BiometricCredential = {
        id: crypto.randomUUID(),
        type: result.type ?? 'unknown',
        enrolledAt: new Date().toISOString(),
        platform: isNative() ? 'android' : 'web',
      };
      localStorage.setItem(
        AUTH_STORAGE_KEYS.BIOMETRIC_CREDENTIAL,
        JSON.stringify(credential)
      );
      setBiometricCredential(credential);
    }

    return result;
  }, []);

  const enrollQR = useCallback(async (qrData: string): Promise<{
    success: boolean;
    error?: AuthError;
  }> => {
    // Parse and validate QR
    const parseResult = parseQrPayload(qrData);
    if (!parseResult.success) {
      const authError: AuthError = {
        code: parseResult.code,
        message: parseResult.message,
        recoverable: true,
        timestamp: new Date().toISOString(),
        details: parseResult.details,
      };
      return { success: false, error: authError };
    }

    const payload = parseResult.payload;

    // Generate device salt if not exists
    if (!deviceSaltRef.current) {
      deviceSaltRef.current = generateDeviceSalt();
      localStorage.setItem(
        AUTH_STORAGE_KEYS.DEVICE_SALT,
        uint8ArrayToBase64(deviceSaltRef.current)
      );
    }

    // Store enrollment
    const keyHash = await sha256(payload.deviceKey);
    const fingerprint = await getKeyFingerprint(payload.deviceKey);

    const enrollment: QREnrollment = {
      enrolledAt: new Date().toISOString(),
      keyFingerprint: fingerprint,
      keyHash,
      permissions: payload.permissions,
      pgpPublicKey: payload.pgpPublicKey,
    };

    localStorage.setItem(
      AUTH_STORAGE_KEYS.QR_ENROLLMENT,
      JSON.stringify(enrollment)
    );
    setQrEnrollment(enrollment);

    // Record QR validation
    const validationState = {
      validatedAt: new Date().toISOString(),
      qrHash: await sha256(qrData),
      expiresAt: new Date(Date.now() + AUTH_CONFIG.QR_TTL_MINUTES * 60 * 1000).toISOString(),
    };
    localStorage.setItem(
      AUTH_STORAGE_KEYS.LAST_QR_VALIDATION,
      JSON.stringify(validationState)
    );

    // Derive encryption key
    await deriveAndStoreKey(payload);

    return { success: true };
  }, [deriveAndStoreKey]);

  const unenroll = useCallback(async (): Promise<void> => {
    // Clear all auth storage
    localStorage.removeItem(AUTH_STORAGE_KEYS.ENROLLMENT_STATUS);
    localStorage.removeItem(AUTH_STORAGE_KEYS.BIOMETRIC_CREDENTIAL);
    localStorage.removeItem(AUTH_STORAGE_KEYS.QR_ENROLLMENT);
    localStorage.removeItem(AUTH_STORAGE_KEYS.LAST_QR_VALIDATION);
    localStorage.removeItem(AUTH_STORAGE_KEYS.DEVICE_SALT);

    // Clear state
    setBiometricCredential(null);
    setQrEnrollment(null);
    encryptionKeyRef.current = null;
    deviceSaltRef.current = null;

    setState('enrolling');
  }, []);

  const completeEnrollment = useCallback(async (): Promise<void> => {
    // Called when enrollment flow is complete (QR enrolled, optionally biometric)
    // Transition to unlocked state
    await finalizeUnlock();
  }, [finalizeUnlock]);

  // ============================================
  // LOCK / UNLOCK
  // ============================================

  const lock = useCallback(() => {
    // Clear sensitive data from memory
    encryptionKeyRef.current = null;
    setSession(null);

    // Don't clear device salt - needed for next unlock

    setState('locked');
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    // Return to appropriate state
    if (qrEnrollment) {
      setState('biometricPending');
    } else {
      setState('locked');
    }
  }, [qrEnrollment]);

  // Dev mode unlock - skip all auth checks
  const devModeUnlock = useCallback(() => {
    console.warn('[Auth] DEV MODE: Bypassing authentication');
    setError(null);

    // Set a mock QR validation so TTL timer doesn't immediately expire
    const mockValidation = {
      validatedAt: new Date().toISOString(),
      qrHash: 'DEV_MODE_MOCK_HASH',
      expiresAt: new Date(Date.now() + AUTH_CONFIG.QR_TTL_MINUTES * 60 * 1000).toISOString(),
    };
    localStorage.setItem(AUTH_STORAGE_KEYS.LAST_QR_VALIDATION, JSON.stringify(mockValidation));

    // Also set mock QR enrollment if not present (prevents re-enrollment loop)
    if (!qrEnrollment) {
      const mockEnrollment: QREnrollment = {
        enrolledAt: new Date().toISOString(),
        keyFingerprint: 'DEV_MODE',
        keyHash: 'DEV_MODE_MOCK_KEY_HASH',
        permissions: { canExport: true, canDeleteData: true, canModifyProfile: true },
        pgpPublicKey: 'DEV_MODE_PLACEHOLDER',
      };
      localStorage.setItem(AUTH_STORAGE_KEYS.QR_ENROLLMENT, JSON.stringify(mockEnrollment));
      setQrEnrollment(mockEnrollment);
    }

    setState('unlocked');
  }, [qrEnrollment]);

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const getEncryptionKey = useCallback((): CryptoKey | null => {
    if (state !== 'unlocked') {
      return null;
    }
    return encryptionKeyRef.current;
  }, [state]);

  const contextValue: AuthContextType = {
    state,
    error,
    biometricCapability,
    qrEnrolled: qrEnrollment !== null,
    session,
    qrTTLRemaining,
    isEnrolled: qrEnrollment !== null,
    enrollment: {
      biometric: biometricCredential,
      qr: qrEnrollment,
    },
    requestBiometric,
    validateQR,
    lock,
    clearError,
    enrollBiometric,
    enrollQR,
    completeEnrollment,
    unenroll,
    getEncryptionKey,
    devModeUnlock,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// ============================================
// HOOK
// ============================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ============================================
// DEVELOPMENT BYPASS
// ============================================

/**
 * Hook to check if auth is bypassed (for development)
 */
export function useAuthBypass(): boolean {
  const context = useContext(AuthContext);
  return context?.state === 'unlocked' && context?.session === null;
}

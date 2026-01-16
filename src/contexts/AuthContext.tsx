/* eslint-disable react-refresh/only-export-components */
/**
 * Authentication Context
 * Manages biometric-only unlock state machine
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { App } from '@capacitor/app';

import { AUTH_CONFIG, AUTH_STORAGE_KEYS, AUTH_ERROR_CODES } from '../constants/auth';
import { isNative } from '../utils/platform';
import {
  isBiometricAvailable,
  getBiometricCapability,
  authenticateWithBiometric,
} from '../services/biometricAuth';

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
  const [qrTTLRemaining] = useState(0); // Kept for interface compatibility

  // Enrollment state
  const [biometricCredential, setBiometricCredential] = useState<BiometricCredential | null>(null);
  const [qrEnrollment, setQrEnrollment] = useState<QREnrollment | null>(null);

  // ============================================
  // STORAGE HELPERS (defined first - no dependencies)
  // ============================================

  const loadBiometricCredential = (): BiometricCredential | null => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEYS.BIOMETRIC_CREDENTIAL);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  // ============================================
  // FINALIZE UNLOCK (must be defined before requestBiometric/validateQR)
  // ============================================

  const finalizeUnlock = useCallback(async () => {
    // Create session
    const newSession: AuthSession = {
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      authMethod: 'biometric',
      biometricValidatedAt: new Date().toISOString(),
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

      // Load biometric enrollment state from storage
      const savedBiometricCredential = loadBiometricCredential();
      setBiometricCredential(savedBiometricCredential);

      // Check if enrolled (biometric-only)
      const isEnrolled = savedBiometricCredential !== null;

      if (!isEnrolled) {
        // First time - need biometric enrollment
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
  // APP STATE HANDLING
  // ============================================

  useEffect(() => {
    if (!isNative() || bypassAuth) return;

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    // Lock when app goes to background (if configured)
    const setupListener = async () => {
      listenerHandle = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive && AUTH_CONFIG.LOCK_ON_BACKGROUND && state === 'unlocked') {
          // App went to background - could lock here if desired
        }
      });
    };

    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [state, bypassAuth]);

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
      title: 'Unlock Kreativium',
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

    // Biometric succeeded - unlock directly
    await finalizeUnlock();

    return result;
  }, [finalizeUnlock]);

  // ============================================
  // QR VALIDATION (stub - QR auth disabled)
  // ============================================

  const validateQR = useCallback(async (_qrData: string): Promise<{
    success: boolean;
    error?: AuthError;
  }> => {
    void _qrData; // Parameter kept for interface compatibility
    // QR authentication is disabled - biometric only
    return { success: true };
  }, []);

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

  const enrollQR = useCallback(async (_qrData: string): Promise<{
    success: boolean;
    error?: AuthError;
  }> => {
    void _qrData; // Parameter kept for interface compatibility
    // QR enrollment is disabled - biometric only
    return { success: true };
  }, []);

  const unenroll = useCallback(async (): Promise<void> => {
    // Clear biometric credential
    localStorage.removeItem(AUTH_STORAGE_KEYS.BIOMETRIC_CREDENTIAL);

    // Clear state
    setBiometricCredential(null);
    setQrEnrollment(null);

    setState('enrolling');
  }, []);

  const completeEnrollment = useCallback(async (): Promise<void> => {
    // Called when biometric enrollment is complete
    // Transition to unlocked state
    await finalizeUnlock();
  }, [finalizeUnlock]);

  // ============================================
  // LOCK / UNLOCK
  // ============================================

  const lock = useCallback(() => {
    setSession(null);
    setState('locked');
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    // Return to biometric pending state
    if (biometricCredential) {
      setState('biometricPending');
    } else {
      setState('enrolling');
    }
  }, [biometricCredential]);

  // Dev mode unlock - skip all auth checks
  const devModeUnlock = useCallback(() => {
    console.warn('[Auth] DEV MODE: Bypassing authentication');
    setError(null);
    setState('unlocked');
  }, []);

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const getEncryptionKey = useCallback((): CryptoKey | null => {
    // Encryption key is not used in biometric-only mode
    return null;
  }, []);

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

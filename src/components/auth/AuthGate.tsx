/**
 * AuthGate Component
 * Blocks app content until user is authenticated
 */

import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LockScreen } from './LockScreen';
import { BiometricPrompt } from './BiometricPrompt';
import { QRScanScreen } from './QRScanScreen';
import { AuthErrorScreen } from './AuthErrorScreen';
import { EnrollmentScreen } from './EnrollmentScreen';
import { LoadingScreen } from './LoadingScreen';

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * AuthGate wraps the app and shows appropriate auth UI based on state
 */
export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const { state } = useAuth();

  switch (state) {
    case 'initializing':
      return <LoadingScreen message="Initializing security..." />;

    case 'enrolling':
      // First-time enrollment in progress
      return <EnrollmentScreen />;

    case 'locked':
      return <LockScreen />;

    case 'biometricPending':
      return <BiometricPrompt />;

    case 'qrPending':
      return <QRScanScreen />;

    case 'error':
      return <AuthErrorScreen />;

    case 'unlocked':
      return <>{children}</>;

    default:
      return <LoadingScreen message="Loading..." />;
  }
};

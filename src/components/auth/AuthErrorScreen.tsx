/**
 * Auth Error Screen Component
 * Shown when authentication encounters an error
 */

import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, HelpCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AUTH_ERROR_CODES } from '../../constants/auth';

export const AuthErrorScreen: React.FC = () => {
  const { error, clearError, devModeUnlock } = useAuth();

  const getErrorDetails = () => {
    if (!error) {
      return {
        title: 'Unknown Error',
        description: 'An unexpected error occurred.',
        canRetry: true,
        helpText: '',
      };
    }

    switch (error.code) {
      case AUTH_ERROR_CODES.BIOMETRIC_NOT_AVAILABLE:
        return {
          title: 'Biometric Unavailable',
          description: 'Biometric authentication is not available on this device.',
          canRetry: false,
          helpText:
            'Please ensure your device has fingerprint or face recognition hardware.',
        };

      case AUTH_ERROR_CODES.BIOMETRIC_NOT_ENROLLED:
        return {
          title: 'Biometric Not Set Up',
          description:
            'No biometric credentials are enrolled on this device.',
          canRetry: false,
          helpText:
            'Please set up fingerprint or face recognition in your device settings.',
        };

      case AUTH_ERROR_CODES.BIOMETRIC_LOCKOUT:
        return {
          title: 'Too Many Attempts',
          description:
            'Biometric authentication is temporarily locked due to too many failed attempts.',
          canRetry: true,
          helpText: 'Please wait 30 seconds and try again.',
        };

      case AUTH_ERROR_CODES.BIOMETRIC_LOCKOUT_PERMANENT:
        return {
          title: 'Biometric Locked',
          description:
            'Biometric authentication is permanently locked.',
          canRetry: false,
          helpText:
            'Please unlock your device with PIN/password first, then try again.',
        };

      case AUTH_ERROR_CODES.BIOMETRIC_CANCELLED:
        return {
          title: 'Authentication Cancelled',
          description: 'Biometric authentication was cancelled.',
          canRetry: true,
          helpText: 'Tap the button below to try again.',
        };

      case AUTH_ERROR_CODES.QR_INVALID_FORMAT:
      case AUTH_ERROR_CODES.QR_INVALID_SCHEMA:
        return {
          title: 'Invalid QR Code',
          description: 'The scanned QR code is not valid.',
          canRetry: true,
          helpText:
            'Please scan the correct NeuroLogg unlock QR code.',
        };

      case AUTH_ERROR_CODES.QR_EXPIRED:
        return {
          title: 'QR Code Expired',
          description: 'This QR code has expired.',
          canRetry: true,
          helpText:
            'Please request a new QR code from your administrator.',
        };

      case AUTH_ERROR_CODES.QR_KEY_MISMATCH:
        return {
          title: 'Wrong QR Code',
          description:
            'This QR code does not match the enrolled device.',
          canRetry: true,
          helpText:
            'Please scan the QR code that was used during initial setup.',
        };

      default:
        return {
          title: 'Authentication Failed',
          description: error.message || 'An error occurred during authentication.',
          canRetry: error.recoverable,
          helpText: '',
        };
    }
  };

  const { title, description, canRetry, helpText } = getErrorDetails();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6">
      {/* Error icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mb-8"
      >
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-red-500/20 to-orange-500/20 backdrop-blur-xl border border-red-500/20 flex items-center justify-center">
          <AlertTriangle className="w-12 h-12 text-red-400" />
        </div>
      </motion.div>

      {/* Error title */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-semibold text-white mb-2"
      >
        {title}
      </motion.h2>

      {/* Error description */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-red-400/70 text-sm text-center max-w-xs mb-6"
      >
        {description}
      </motion.p>

      {/* Error details */}
      {error?.details && error.details.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl max-w-xs"
        >
          <ul className="text-red-400/60 text-xs space-y-1">
            {error.details.map((detail, i) => (
              <li key={i}>• {detail}</li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Help text */}
      {helpText && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-start gap-2 text-slate-400 text-xs max-w-xs mb-8 p-3 bg-slate-800/50 rounded-lg"
        >
          <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{helpText}</span>
        </motion.div>
      )}

      {/* Retry button */}
      {canRetry && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          onClick={clearError}
          className="flex items-center gap-2 px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-xl text-cyan-400 font-medium transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
          <span>Try Again</span>
        </motion.button>
      )}

      {/* Dev mode skip button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        onClick={devModeUnlock}
        className="mt-8 w-full max-w-xs py-3 text-slate-500 hover:text-slate-400 text-sm transition-colors border border-dashed border-slate-700 rounded-xl"
      >
        Skip Auth (Dev Mode)
      </motion.button>

      {/* Error code */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-8 text-xs text-slate-600"
      >
        Error code: {error?.code || 'UNKNOWN'}
      </motion.p>
    </div>
  );
};

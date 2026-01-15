/**
 * Biometric Prompt Component
 * Shows biometric authentication in progress
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, Scan, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const BiometricPrompt: React.FC = () => {
  const { requestBiometric, biometricCapability, error, devModeUnlock } = useAuth();
  const [isPrompting, setIsPrompting] = useState(false);
  const [failCount, setFailCount] = useState(0);

  const hasTriggeredRef = useRef(false);

  const triggerBiometric = useCallback(async () => {
    setIsPrompting(true);
    const result = await requestBiometric();

    if (!result.success) {
      setFailCount((prev) => prev + 1);
    }
    setIsPrompting(false);
  }, [requestBiometric]);

  // Auto-trigger biometric on mount (intentionally run once)
  useEffect(() => {
    if (hasTriggeredRef.current) {
      return;
    }
    hasTriggeredRef.current = true;

    // Small delay to let animation complete
    const timer = setTimeout(() => {
      void triggerBiometric();
    }, 500);
    return () => clearTimeout(timer);
  }, [triggerBiometric]);

  const handleRetry = useCallback(async () => {
    setIsPrompting(true);
    const result = await requestBiometric();
    if (!result.success) {
      setFailCount((prev) => prev + 1);
    }
    setIsPrompting(false);
  }, [requestBiometric]);

  const BiometricIcon = biometricCapability?.type === 'face' ? Scan : Fingerprint;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6">
      {/* Animated biometric icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative mb-8"
      >
        {/* Pulsing ring animation */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.1, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute inset-0 w-32 h-32 rounded-full bg-cyan-400/20"
        />
        <motion.div
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.2, 0.05, 0.2],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.3,
          }}
          className="absolute inset-0 w-32 h-32 rounded-full bg-cyan-400/10"
        />

        {/* Icon container */}
        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 backdrop-blur-xl border border-white/10 flex items-center justify-center">
          <BiometricIcon
            className={`w-16 h-16 ${isPrompting ? 'text-cyan-400 animate-pulse' : 'text-cyan-400/70'}`}
          />
        </div>
      </motion.div>

      {/* Status text */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center mb-8"
      >
        <h2 className="text-xl font-semibold text-white mb-2">
          {isPrompting
            ? 'Verifying...'
            : failCount > 0
              ? 'Try Again'
              : 'Biometric Required'}
        </h2>
        <p className="text-cyan-400/60 text-sm">
          {biometricCapability?.type === 'face'
            ? 'Look at your device to unlock'
            : 'Place your finger on the sensor'}
        </p>
      </motion.div>

      {/* Error message */}
      {error && !isPrompting && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 max-w-xs"
        >
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 text-sm">{error.message}</p>
            {failCount >= 3 && (
              <p className="text-red-400/60 text-xs mt-1">
                Multiple failed attempts. Please try again.
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Retry button */}
      {!isPrompting && failCount > 0 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={handleRetry}
          className="px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-xl text-cyan-400 font-medium transition-colors"
        >
          Try Again
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
        Skip Biometric (Dev Mode)
      </motion.button>

      {/* Help text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-8 text-center text-xs text-slate-500 max-w-xs"
      >
        {failCount >= 5
          ? 'Too many failed attempts. Please try again later.'
          : 'Biometric authentication keeps your data secure.'}
      </motion.p>
    </div>
  );
};

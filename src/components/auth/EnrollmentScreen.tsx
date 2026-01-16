/**
 * Enrollment Screen Component
 * First-time setup for biometric enrollment (QR disabled)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Fingerprint,
  CheckCircle,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type EnrollmentStep = 'welcome' | 'biometric' | 'complete';

export const EnrollmentScreen: React.FC = () => {
  const { enrollBiometric, completeEnrollment, biometricCapability, devModeUnlock } = useAuth();
  const [step, setStep] = useState<EnrollmentStep>('welcome');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Complete enrollment after showing success message
  useEffect(() => {
    if (step === 'complete') {
      // Brief delay to show success message before unlocking
      const timer = setTimeout(() => {
        completeEnrollment();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step, completeEnrollment]);

  const handleBiometricSetup = async () => {
    setIsProcessing(true);
    setError(null);

    const result = await enrollBiometric();

    if (result.success) {
      setStep('complete');
    } else {
      setError(result.errorMessage || 'Biometric setup failed');
    }

    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6">
      <AnimatePresence mode="wait">
        {/* Welcome Step */}
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center max-w-sm"
          >
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 backdrop-blur-xl border border-white/10 flex items-center justify-center mb-8">
              <Shield className="w-12 h-12 text-cyan-400" />
            </div>

            <h1 className="text-2xl font-bold text-white mb-3">
              Secure Your Data
            </h1>

            <p className="text-slate-400 text-sm text-center mb-8">
              Kreativium uses biometric authentication to keep
              your child's data safe and private.
            </p>

            <div className="space-y-4 w-full mb-8">
              <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-xl">
                <Fingerprint className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white text-sm font-medium">Biometric Unlock</p>
                  <p className="text-slate-400 text-xs">
                    Use fingerprint or face to unlock quickly and securely
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep('biometric')}
              className="w-full py-4 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 border border-white/10 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <span>Get Started</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {/* Biometric Step */}
        {step === 'biometric' && (
          <motion.div
            key="biometric"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center max-w-sm w-full"
          >
            <div className="w-20 h-20 rounded-2xl bg-cyan-500/20 flex items-center justify-center mb-6">
              <Fingerprint className="w-10 h-10 text-cyan-400" />
            </div>

            <h2 className="text-xl font-semibold text-white mb-2">
              Set Up Biometric
            </h2>

            <p className="text-slate-400 text-sm text-center mb-6">
              Enable{' '}
              {biometricCapability?.type === 'face'
                ? 'face recognition'
                : 'fingerprint'}{' '}
              unlock for quick and secure access.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 w-full">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleBiometricSetup}
              disabled={isProcessing}
              className="w-full py-4 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:bg-slate-800/50 border border-cyan-500/30 rounded-xl text-cyan-400 font-medium transition-colors"
            >
              {isProcessing ? 'Setting Up...' : 'Enable Biometric'}
            </button>

            {/* Dev mode skip button */}
            <button
              onClick={devModeUnlock}
              disabled={isProcessing}
              className="w-full py-3 mt-3 text-slate-500 hover:text-slate-400 text-sm transition-colors border border-dashed border-slate-700 rounded-xl"
            >
              Skip (Dev Mode)
            </button>
          </motion.div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center max-w-sm"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-8"
            >
              <CheckCircle className="w-12 h-12 text-green-400" />
            </motion.div>

            <h2 className="text-xl font-semibold text-white mb-2">All Set!</h2>

            <p className="text-slate-400 text-sm text-center mb-8">
              Biometric authentication is now enabled. Your data is protected.
            </p>

            <div className="space-y-2 w-full mb-8">
              <div className="flex items-center gap-2 text-green-400/70 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Biometric unlock enabled</span>
              </div>
              <div className="flex items-center gap-2 text-green-400/70 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Data protection active</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 text-center">
              The app will now unlock. You'll need to authenticate each time you
              open it.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

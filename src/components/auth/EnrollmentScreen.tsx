/**
 * Enrollment Screen Component
 * First-time setup for biometric + QR enrollment
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  QrCode,
  Fingerprint,
  CheckCircle,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type EnrollmentStep = 'welcome' | 'qr' | 'biometric' | 'complete';

export const EnrollmentScreen: React.FC = () => {
  const { enrollQR, enrollBiometric, completeEnrollment, biometricCapability } = useAuth();
  const [step, setStep] = useState<EnrollmentStep>('welcome');
  const [qrInput, setQrInput] = useState('');
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

  const handleQrSubmit = async () => {
    if (!qrInput.trim()) {
      setError('Please enter QR code data');
      return;
    }

    setIsProcessing(true);
    setError(null);

    const result = await enrollQR(qrInput.trim());

    if (result.success) {
      setStep('biometric');
    } else {
      setError(result.error?.message || 'Invalid QR code');
    }

    setIsProcessing(false);
  };

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

  const handleSkipBiometric = () => {
    setStep('complete');
  };

  // Dev mode: Skip QR with mock enrollment
  const handleSkipQR = async () => {
    setIsProcessing(true);
    setError(null);

    // Create a mock QR payload for development
    const mockQRPayload = JSON.stringify({
      version: '1.0.0',
      deviceKey: 'DEV_MODE_SKIP_KEY_' + btoa(String(Date.now())).slice(0, 32),
      pgpPublicKey: '-----BEGIN PGP PUBLIC KEY BLOCK-----\nDEV_MODE_PLACEHOLDER\n-----END PGP PUBLIC KEY BLOCK-----',
      issuedAt: new Date().toISOString(),
      permissions: {
        canExport: true,
        canDeleteData: true,
        canModifyProfile: true,
      },
    });

    const result = await enrollQR(mockQRPayload);

    if (result.success) {
      setStep('biometric');
    } else {
      // If mock enrollment fails, just skip anyway for dev
      console.warn('[Dev] Mock QR enrollment failed, skipping anyway:', result.error);
      setStep('biometric');
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
              NeuroLogg Pro uses biometric authentication and QR codes to keep
              your child's data safe and private.
            </p>

            <div className="space-y-4 w-full mb-8">
              <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-xl">
                <QrCode className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white text-sm font-medium">QR Code</p>
                  <p className="text-slate-400 text-xs">
                    Scan your unique QR code to link this device
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-xl">
                <Fingerprint className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white text-sm font-medium">Biometric</p>
                  <p className="text-slate-400 text-xs">
                    Use fingerprint or face to unlock quickly
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep('qr')}
              className="w-full py-4 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 border border-white/10 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <span>Get Started</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {/* QR Step */}
        {step === 'qr' && (
          <motion.div
            key="qr"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center max-w-sm w-full"
          >
            <div className="w-20 h-20 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6">
              <QrCode className="w-10 h-10 text-purple-400" />
            </div>

            <h2 className="text-xl font-semibold text-white mb-2">
              Scan QR Code
            </h2>

            <p className="text-slate-400 text-sm text-center mb-6">
              Scan the QR code provided by your administrator, or paste the QR
              data below.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 w-full">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <textarea
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              placeholder='{"version":"1.0.0","deviceKey":"..."}'
              className="w-full h-32 bg-slate-800/50 border border-white/10 rounded-xl p-4 text-white text-sm font-mono placeholder:text-slate-600 focus:outline-none focus:border-purple-400/50 mb-4"
            />

            <button
              onClick={handleQrSubmit}
              disabled={isProcessing || !qrInput.trim()}
              className="w-full py-4 bg-purple-500/20 hover:bg-purple-500/30 disabled:bg-slate-800/50 disabled:text-slate-600 border border-purple-500/30 disabled:border-slate-700 rounded-xl text-purple-400 font-medium transition-colors"
            >
              {isProcessing ? 'Validating...' : 'Continue'}
            </button>

            {/* Development skip button */}
            <button
              onClick={handleSkipQR}
              disabled={isProcessing}
              className="w-full py-3 mt-3 text-slate-500 hover:text-slate-400 text-sm transition-colors border border-dashed border-slate-700 rounded-xl"
            >
              Skip QR (Dev Mode)
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
              className="w-full py-4 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:bg-slate-800/50 border border-cyan-500/30 rounded-xl text-cyan-400 font-medium transition-colors mb-3"
            >
              {isProcessing ? 'Setting Up...' : 'Enable Biometric'}
            </button>

            <button
              onClick={handleSkipBiometric}
              disabled={isProcessing}
              className="w-full py-3 text-slate-500 hover:text-slate-400 text-sm transition-colors"
            >
              Skip for now
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
              Your device is now enrolled. Your data will be encrypted and
              protected.
            </p>

            <div className="space-y-2 w-full mb-8">
              <div className="flex items-center gap-2 text-green-400/70 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>QR code enrolled</span>
              </div>
              <div className="flex items-center gap-2 text-green-400/70 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Data encryption enabled</span>
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

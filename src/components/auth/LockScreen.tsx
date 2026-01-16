/**
 * Lock Screen Component
 * Shown when app is locked, prompts for biometric
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Fingerprint, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const LockScreen: React.FC = () => {
  const { requestBiometric, biometricCapability, qrTTLRemaining, devModeUnlock } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);

  const handleUnlock = async () => {
    setIsAuthenticating(true);
    await requestBiometric();
    setIsAuthenticating(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-lg shadow-cyan-500/10">
          <Lock className="w-12 h-12 text-cyan-400" />
        </div>
      </motion.div>

      {/* App Name */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-bold text-white mb-2"
      >
        Kreativium
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-cyan-400/60 text-sm mb-12"
      >
        Your data is protected
      </motion.p>

      {/* Unlock Button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        onClick={handleUnlock}
        disabled={isAuthenticating}
        className="relative w-full max-w-xs"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-2xl blur-xl" />
        <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 hover:border-cyan-400/30 transition-colors active:scale-[0.98]">
          <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center">
            <Fingerprint
              className={`w-8 h-8 text-cyan-400 ${isAuthenticating ? 'animate-pulse' : ''}`}
            />
          </div>
          <div className="text-center">
            <p className="text-white font-medium">
              {isAuthenticating ? 'Authenticating...' : 'Tap to Unlock'}
            </p>
            <p className="text-cyan-400/50 text-xs mt-1">
              {biometricCapability?.type === 'fingerprint'
                ? 'Use fingerprint'
                : biometricCapability?.type === 'face'
                  ? 'Use face recognition'
                  : 'Use biometric'}
            </p>
          </div>
        </div>
      </motion.button>

      {/* QR TTL indicator */}
      {qrTTLRemaining > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex items-center gap-2 text-green-400/60 text-xs"
        >
          <Shield className="w-4 h-4" />
          <span>
            QR valid for {Math.floor(qrTTLRemaining / 60)}:
            {(qrTTLRemaining % 60).toString().padStart(2, '0')}
          </span>
        </motion.div>
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

      {/* Privacy note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-8 text-center text-xs text-slate-500 max-w-xs"
      >
        All data is encrypted and stored locally on your device. No cloud sync.
      </motion.p>
    </div>
  );
};

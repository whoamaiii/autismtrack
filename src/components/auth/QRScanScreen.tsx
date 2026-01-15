/**
 * QR Scan Screen Component
 * Shown when QR validation is required (TTL expired or initial enrollment)
 *
 * Uses ML Kit barcode scanner on native platforms,
 * falls back to manual input on web
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  QrCode,
  Camera,
  AlertCircle,
  CheckCircle,
  Clock,
  Keyboard,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AUTH_CONFIG } from '../../constants/auth';
import { isNative } from '../../utils/platform';
import { scanQrCode, isQrScannerSupported, type QrScanResult } from '../../services/qrScanner';

export const QRScanScreen: React.FC = () => {
  const { validateQR, error, clearError } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [scannerSupported, setScannerSupported] = useState<boolean | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Check if scanner is supported on mount
  useEffect(() => {
    const checkSupport = async () => {
      const supported = await isQrScannerSupported();
      setScannerSupported(supported);
      // If not supported, show manual input by default
      if (!supported) {
        setShowManualInput(true);
      }
    };
    checkSupport();
  }, []);

  const handleScan = async () => {
    setIsScanning(true);
    setScanError(null);
    clearError();

    const result: QrScanResult = await scanQrCode();

    if (result.success && result.data) {
      // Validate the scanned QR data
      const validateResult = await validateQR(result.data);

      if (validateResult.success) {
        setValidationSuccess(true);
        // AuthContext will transition to unlocked state
      }
    } else {
      // Handle scan errors
      if (result.errorCode === 'CANCELLED') {
        // User cancelled - just reset state
        setScanError(null);
      } else if (result.errorCode === 'PERMISSION_DENIED') {
        setScanError('Camera permission denied. Please enable in device settings.');
        setShowManualInput(true);
      } else if (result.errorCode === 'NOT_SUPPORTED') {
        setScanError('Camera scanning not available. Use manual input.');
        setShowManualInput(true);
      } else {
        setScanError(result.error || 'Failed to scan QR code');
      }
    }

    setIsScanning(false);
  };

  const handleManualSubmit = async () => {
    if (!manualInput.trim()) return;

    setIsScanning(true);
    setScanError(null);
    clearError();

    const result = await validateQR(manualInput.trim());

    if (result.success) {
      setValidationSuccess(true);
      // AuthContext will transition to unlocked state
    }

    setIsScanning(false);
  };

  const toggleInputMode = () => {
    setShowManualInput(!showManualInput);
    setScanError(null);
  };

  // Dev mode: Skip QR validation with mock data
  const handleSkipQR = async () => {
    setIsScanning(true);
    setScanError(null);
    clearError();

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

    const result = await validateQR(mockQRPayload);

    if (result.success) {
      setValidationSuccess(true);
    } else {
      // For dev mode, just show success anyway
      console.warn('[Dev] Mock QR validation failed, forcing unlock:', result.error);
      setValidationSuccess(true);
    }

    setIsScanning(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6">
      {/* Success animation */}
      {validationSuccess ? (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center"
        >
          <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
            <CheckCircle className="w-12 h-12 text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">QR Verified</h2>
          <p className="text-green-400/70 text-sm">Unlocking...</p>
        </motion.div>
      ) : (
        <>
          {/* QR Icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-8"
          >
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 backdrop-blur-xl border border-white/10 flex items-center justify-center">
              <QrCode className="w-12 h-12 text-purple-400" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <h2 className="text-xl font-semibold text-white mb-2">QR Code Required</h2>
            <div className="flex items-center justify-center gap-2 text-purple-400/70 text-sm">
              <Clock className="w-4 h-4" />
              <span>{AUTH_CONFIG.QR_TTL_MINUTES}-minute session expired</span>
            </div>
          </motion.div>

          {/* Error messages */}
          {(error || scanError) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 max-w-xs"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 text-sm">{scanError || error?.message}</p>
                {error?.details && (
                  <ul className="text-red-400/60 text-xs mt-1 list-disc list-inside">
                    {error.details.map((detail, i) => (
                      <li key={i}>{detail}</li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}

          {/* Scanner loading state */}
          {scannerSupported === null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-slate-400 text-sm mb-6"
            >
              Checking camera availability...
            </motion.div>
          )}

          {/* Main content area */}
          {!showManualInput ? (
            /* Camera scan mode */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="w-full max-w-xs space-y-4"
            >
              {/* Scan button */}
              <button
                onClick={handleScan}
                disabled={isScanning || scannerSupported === false}
                className="relative w-full disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-2xl blur-xl" />
                <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 hover:border-purple-400/30 transition-colors">
                  <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Camera
                      className={`w-8 h-8 text-purple-400 ${isScanning ? 'animate-pulse' : ''}`}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-medium">
                      {isScanning ? 'Scanning...' : 'Scan QR Code'}
                    </p>
                    <p className="text-purple-400/50 text-xs mt-1">
                      {isNative()
                        ? 'Tap to open camera scanner'
                        : 'Camera scanning not available on web'}
                    </p>
                  </div>
                </div>
              </button>

              {/* Toggle to manual input */}
              <button
                onClick={toggleInputMode}
                className="w-full py-3 flex items-center justify-center gap-2 text-slate-400 hover:text-slate-300 text-sm transition-colors"
              >
                <Keyboard className="w-4 h-4" />
                <span>Enter QR data manually</span>
              </button>
            </motion.div>
          ) : (
            /* Manual input mode */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-xs space-y-4"
            >
              <div className="flex items-center justify-center gap-2 text-slate-400 text-sm mb-2">
                <Keyboard className="w-4 h-4" />
                <span>Manual QR Data Entry</span>
              </div>

              <textarea
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder='{"version":"1.0.0","deviceKey":"..."}'
                className="w-full h-32 bg-slate-800/50 border border-white/10 rounded-xl p-4 text-white text-sm font-mono placeholder:text-slate-600 focus:outline-none focus:border-purple-400/50 resize-none"
              />

              <button
                onClick={handleManualSubmit}
                disabled={isScanning || !manualInput.trim()}
                className="w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 disabled:bg-slate-800/50 disabled:text-slate-600 border border-purple-500/30 disabled:border-slate-700 rounded-xl text-purple-400 font-medium transition-colors"
              >
                {isScanning ? 'Validating...' : 'Validate QR'}
              </button>

              {/* Toggle back to camera (if supported) */}
              {scannerSupported && (
                <button
                  onClick={toggleInputMode}
                  className="w-full py-3 flex items-center justify-center gap-2 text-slate-400 hover:text-slate-300 text-sm transition-colors"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Use camera instead</span>
                </button>
              )}
            </motion.div>
          )}

          {/* Dev mode skip button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 w-full max-w-xs"
          >
            <button
              onClick={handleSkipQR}
              disabled={isScanning}
              className="w-full py-3 text-slate-500 hover:text-slate-400 text-sm transition-colors border border-dashed border-slate-700 rounded-xl"
            >
              Skip QR (Dev Mode)
            </button>
          </motion.div>

          {/* Help text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center text-xs text-slate-500 max-w-xs"
          >
            Scan your registered QR code to verify device authorization and continue using the app.
          </motion.p>
        </>
      )}
    </div>
  );
};

/**
 * Model Download Prompt
 * First-launch modal prompting user to download the local AI model
 * Shows on Android devices that haven't yet downloaded Kreativium 4B
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Wifi, WifiOff, HardDrive, Cpu, Shield, Key, ExternalLink, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useModel } from '../contexts/ModelContext';
import { setHfToken, validateHfToken, formatDuration, formatBytes } from '../services/localModel';

export function ModelDownloadPrompt() {
    const { t } = useTranslation();
    const {
        showDownloadPrompt,
        markPromptShown,
        startDownload,
        status,
        modelSizeDisplay
    } = useModel();

    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hfToken, setHfTokenValue] = useState('');
    const [showTokenInput, setShowTokenInput] = useState(false);
    const [tokenError, setTokenError] = useState<string | null>(null);

    const handleSkip = useCallback(() => {
        markPromptShown(); // This already dismisses the prompt
    }, [markPromptShown]);

    // Handle ESC key to dismiss modal (only when not downloading)
    useEffect(() => {
        if (!showDownloadPrompt) return;

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isDownloading) {
                handleSkip();
            }
        };

        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [showDownloadPrompt, isDownloading, handleSkip]);

    if (!showDownloadPrompt) return null;

    const handleDownload = async () => {
        setError(null);
        setTokenError(null);

        // Validate HF token if provided
        if (hfToken.trim()) {
            const validation = validateHfToken(hfToken);
            if (!validation.isValid) {
                setTokenError(validation.error || 'Invalid token format');
                return;
            }
        }

        setIsDownloading(true);

        try {
            // Save HF token if provided, then clear it from state
            if (hfToken.trim()) {
                await setHfToken(hfToken.trim());
                setHfTokenValue(''); // Clear token from state immediately after saving
            }

            await startDownload();
            markPromptShown();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Download failed';
            // Check if it's a 404/403 error (gated model without token)
            if (errorMessage.includes('404') || errorMessage.includes('403') ||
                errorMessage.includes('401') || errorMessage.includes('Access denied') ||
                errorMessage.includes('Authentication required')) {
                setError(t('model.errorGatedModel', 'This model requires a Hugging Face token. Click "Need token?" for instructions.'));
                setShowTokenInput(true);
            } else {
                setError(errorMessage);
            }
            setIsDownloading(false);
        }
    };

    const progressPercent = Math.round(status.downloadProgress * 100);

    return (
        <AnimatePresence>
            <motion.div
                key="model-download-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                role="presentation"
            >
                <motion.div
                    key="model-download-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="model-download-title"
                    aria-describedby="model-download-description"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="w-full max-w-md bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="relative p-6 pb-4 bg-gradient-to-b from-cyan-500/10 to-transparent">
                        <button
                            onClick={handleSkip}
                            disabled={isDownloading}
                            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white disabled:opacity-50"
                            aria-label={t('common.close', 'Close')}
                        >
                            <X size={20} />
                        </button>

                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-3 rounded-xl bg-cyan-500/20">
                                <Cpu size={24} className="text-cyan-400" />
                            </div>
                            <div>
                                <h2 id="model-download-title" className="text-xl font-bold text-white">
                                    {t('model.downloadPromptTitle', 'On-device AI analysis')}
                                </h2>
                                <p id="model-download-description" className="text-sm text-slate-400">
                                    {t('model.downloadPromptSubtitle', 'Run analysis without internet')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-6 pb-6">
                        {/* Benefits */}
                        <div className="space-y-3 mb-6">
                            <div className="flex items-center gap-3 text-sm">
                                <WifiOff size={18} className="text-green-400 flex-shrink-0" />
                                <span className="text-slate-300">
                                    {t('model.benefitOffline', 'Works completely offline')}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <Shield size={18} className="text-blue-400 flex-shrink-0" />
                                <span className="text-slate-300">
                                    {t('model.benefitPrivacy', 'Data never leaves device')}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <HardDrive size={18} className="text-purple-400 flex-shrink-0" />
                                <span className="text-slate-300">
                                    {t('model.benefitSize', 'Requires {{size}} storage', { size: modelSizeDisplay })}
                                </span>
                            </div>
                        </div>

                        {/* Download Progress */}
                        {isDownloading && (
                            <div className="mb-6" aria-live="polite">
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-slate-400">
                                        {t('model.downloading', 'Downloading...')}
                                    </span>
                                    <span className="text-cyan-400 font-medium">
                                        {progressPercent}%
                                    </span>
                                </div>
                                <div
                                    className="h-2 bg-slate-700 rounded-full overflow-hidden"
                                    role="progressbar"
                                    aria-valuenow={progressPercent}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-label={t('model.downloadProgress', 'Download progress')}
                                >
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progressPercent}%` }}
                                        transition={{ duration: 0.3 }}
                                    />
                                </div>
                                <div className="flex justify-between items-center text-xs text-slate-500 mt-2">
                                    <span>
                                        {status.speedBytesPerSec
                                            ? `${formatBytes(status.speedBytesPerSec)}/s`
                                            : t('model.downloadTip', 'Ensure stable WiFi connection')}
                                    </span>
                                    {status.etaSeconds !== undefined && status.etaSeconds > 0 && (
                                        <span className="text-cyan-400">
                                            {t('model.etaRemaining', '~{{time}} remaining', {
                                                time: formatDuration(status.etaSeconds)
                                            })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div
                                role="alert"
                                aria-live="assertive"
                                className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30"
                            >
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}

                        {/* HF Token Input */}
                        {showTokenInput && (
                            <div className="mb-4 p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30 space-y-3">
                                <div className="flex items-start gap-2">
                                    <Key size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <h4 className="text-sm font-medium text-cyan-400 mb-1">
                                            {t('model.tokenRequired', 'Hugging Face Token Required')}
                                        </h4>
                                        <p className="text-xs text-slate-300 mb-2">
                                            {t('model.tokenInstructions', 'Kreativium 4B is a gated model. Follow these steps to get access:')}
                                        </p>
                                        <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside mb-2">
                                            <li>
                                                <a
                                                    href="https://huggingface.co/litert-community/Gemma3-4B-IT"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-1"
                                                >
                                                    {t('model.acceptLicense', 'Accept the model license')}
                                                    <ExternalLink size={10} />
                                                </a>
                                            </li>
                                            <li>
                                                <a
                                                    href="https://huggingface.co/settings/tokens"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-1"
                                                >
                                                    {t('model.createToken', 'Create a token with "read" permission')}
                                                    <ExternalLink size={10} />
                                                </a>
                                            </li>
                                            <li>{t('model.tokenStep3', 'Paste your token below')}</li>
                                        </ol>
                                        <input
                                            type="password"
                                            value={hfToken}
                                            onChange={(e) => {
                                                setHfTokenValue(e.target.value);
                                                setTokenError(null); // Clear error on input change
                                            }}
                                            placeholder="hf_..."
                                            className={`w-full px-3 py-2 rounded-lg bg-slate-900/50 border text-white text-sm placeholder:text-slate-500 focus:outline-none ${
                                                tokenError
                                                    ? 'border-red-500 focus:border-red-500'
                                                    : 'border-slate-600 focus:border-cyan-500'
                                            }`}
                                            disabled={isDownloading}
                                            aria-label={t('model.tokenInputLabel', 'Hugging Face token')}
                                            aria-invalid={!!tokenError}
                                            aria-describedby={tokenError ? 'token-error' : undefined}
                                        />
                                        {tokenError && (
                                            <div
                                                id="token-error"
                                                className="flex items-start gap-1.5 mt-2 text-xs text-red-400"
                                                role="alert"
                                            >
                                                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                                                <span>{tokenError}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="space-y-3">
                            <button
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isDownloading ? (
                                    <>
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                        >
                                            <Download size={20} />
                                        </motion.div>
                                        {t('model.downloadingButton', 'Downloading...')}
                                    </>
                                ) : (
                                    <>
                                        <Download size={20} />
                                        {t('model.downloadButton', 'Download AI model')}
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleSkip}
                                disabled={isDownloading}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 text-slate-300 font-medium transition-colors hover:bg-slate-700 disabled:opacity-50"
                            >
                                <Wifi size={18} />
                                {t('model.skipButton', 'Use cloud API (requires internet)')}
                            </button>

                            {!showTokenInput && (
                                <button
                                    onClick={() => setShowTokenInput(true)}
                                    disabled={isDownloading}
                                    className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
                                >
                                    <Key size={16} />
                                    {t('model.needToken', 'Need token?')}
                                </button>
                            )}
                        </div>

                        <p className="text-xs text-slate-500 text-center mt-4">
                            {t('model.settingsHint', 'You can download the model later from Settings')}
                        </p>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default ModelDownloadPrompt;

/**
 * Model Manager Component
 * Settings section for managing the local AI model
 * Shows status, allows download/delete, and displays storage info
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Trash2, CheckCircle, HardDrive, Cpu, RefreshCw, AlertCircle, Key, ExternalLink, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useModel } from '../contexts/ModelContext';
import { setHfToken, validateHfToken, formatDuration, formatBytes } from '../services/localModel';

interface ModelManagerProps {
    className?: string;
}

export function ModelManager({ className = '' }: ModelManagerProps) {
    const { t } = useTranslation();
    const {
        status,
        isChecking,
        isExtracting,
        refreshStatus,
        startDownload,
        cancelModelDownload,
        deleteLocalModel,
        modelSizeDisplay,
        isNativeDevice
    } = useModel();

    const [isDeleting, setIsDeleting] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hfToken, setHfTokenValue] = useState('');
    const [showTokenInput, setShowTokenInput] = useState(false);
    const [tokenError, setTokenError] = useState<string | null>(null);

    // Track mounted state to prevent state updates after unmount
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Don't show on web
    if (!isNativeDevice) {
        return null;
    }

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

        try {
            // Save HF token if provided, then clear it from state
            if (hfToken.trim()) {
                await setHfToken(hfToken.trim());
                if (isMountedRef.current) {
                    setHfTokenValue(''); // Clear token from state immediately after saving
                }
            }

            await startDownload();
        } catch (err) {
            if (!isMountedRef.current) return;
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
        }
    };

    const handleCancel = async () => {
        setIsCancelling(true);
        try {
            await cancelModelDownload();
        } finally {
            if (isMountedRef.current) {
                setIsCancelling(false);
            }
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        setError(null);
        try {
            await deleteLocalModel();
            if (isMountedRef.current) {
                setShowDeleteConfirm(false);
            }
        } catch (err) {
            if (isMountedRef.current) {
                setError(err instanceof Error ? err.message : 'Delete failed');
            }
        } finally {
            if (isMountedRef.current) {
                setIsDeleting(false);
            }
        }
    };

    const progressPercent = Math.round(status.downloadProgress * 100);

    return (
        <div className={`rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden ${className}`}>
            {/* Header */}
            <div className="p-4 border-b border-slate-700/50 bg-slate-800/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-cyan-500/20">
                            <Cpu size={20} className="text-cyan-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">
                                {t('model.settingsTitle', 'Local AI model')}
                            </h3>
                            <p className="text-xs text-slate-400">
                                {t('model.modelName', 'Kreativium 4B')}
                            </p>
                        </div>
                    </div>

                    {/* Status Badge */}
                    {status.downloaded ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                            <CheckCircle size={14} />
                            {t('model.statusDownloaded', 'Downloaded')}
                        </span>
                    ) : status.downloading ? (
                        <span
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium"
                            aria-live="polite"
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            >
                                <RefreshCw size={14} />
                            </motion.div>
                            {progressPercent}%
                        </span>
                    ) : isExtracting ? (
                        <span
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-medium"
                            aria-live="polite"
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            >
                                <RefreshCw size={14} />
                            </motion.div>
                            {t('model.statusExtracting', 'Extracting...')}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-600/50 text-slate-400 text-xs font-medium">
                            <HardDrive size={14} />
                            {t('model.statusNotDownloaded', 'Not downloaded')}
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {/* Info */}
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                        {t('model.storageRequired', 'Storage space')}
                    </span>
                    <span className="text-white font-medium">
                        {status.downloaded && status.modelSize
                            ? formatBytes(status.modelSize)
                            : modelSizeDisplay}
                    </span>
                </div>

                {/* Download/Extraction Progress */}
                {(status.downloading || isExtracting) && (
                    <div aria-live="polite">
                        <div
                            className="h-2 bg-slate-700 rounded-full overflow-hidden mb-2"
                            role="progressbar"
                            aria-valuenow={progressPercent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={isExtracting
                                ? t('model.extractionProgress', 'Extraction progress')
                                : t('model.downloadProgress', 'Download progress')}
                        >
                            <motion.div
                                className={`h-full ${isExtracting
                                    ? 'bg-gradient-to-r from-cyan-400 to-cyan-600'
                                    : 'bg-gradient-to-r from-cyan-500 to-blue-500'}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-500">
                            <span>
                                {isExtracting
                                    ? t('model.extractingProgress', 'Extracting... {{percent}}%', { percent: progressPercent })
                                    : status.speedBytesPerSec
                                        ? `${formatBytes(status.speedBytesPerSec)}/s`
                                        : t('model.downloadingProgress', 'Downloading... {{percent}}%', { percent: progressPercent })}
                            </span>
                            {!isExtracting && status.etaSeconds !== undefined && status.etaSeconds > 0 && (
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
                        className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30"
                    >
                        <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* HF Token Input */}
                {showTokenInput && !status.downloaded && (
                    <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 space-y-2">
                        <div className="flex items-start gap-2">
                            <Key size={14} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h4 className="text-xs font-medium text-cyan-400 mb-1">
                                    {t('model.tokenRequired', 'Hugging Face Token Required')}
                                </h4>
                                <p className="text-[11px] text-slate-300 mb-1.5">
                                    {t('model.tokenInstructions', 'Kreativium 4B is a gated model. Follow these steps:')}
                                </p>
                                <ol className="text-[11px] text-slate-300 space-y-0.5 list-decimal list-inside mb-2">
                                    <li>
                                        <a
                                            href="https://huggingface.co/litert-community/Gemma3-4B-IT"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-0.5"
                                        >
                                            {t('model.acceptLicense', 'Accept license')}
                                            <ExternalLink size={9} />
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href="https://huggingface.co/settings/tokens"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-0.5"
                                        >
                                            {t('model.createToken', 'Create read token')}
                                            <ExternalLink size={9} />
                                        </a>
                                    </li>
                                </ol>
                                <input
                                    type="password"
                                    value={hfToken}
                                    onChange={(e) => {
                                        setHfTokenValue(e.target.value);
                                        setTokenError(null); // Clear error on input change
                                    }}
                                    placeholder="hf_..."
                                    className={`w-full px-2.5 py-1.5 rounded-lg bg-slate-900/50 border text-white text-xs placeholder:text-slate-500 focus:outline-none ${
                                        tokenError
                                            ? 'border-red-500 focus:border-red-500'
                                            : 'border-slate-600 focus:border-cyan-500'
                                    }`}
                                    disabled={status.downloading}
                                    aria-label={t('model.tokenInputLabel', 'Hugging Face token')}
                                    aria-invalid={!!tokenError}
                                    aria-describedby={tokenError ? 'manager-token-error' : undefined}
                                />
                                {tokenError && (
                                    <div
                                        id="manager-token-error"
                                        className="flex items-start gap-1 mt-1.5 text-[10px] text-red-400"
                                        role="alert"
                                    >
                                        <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                                        <span>{tokenError}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation */}
                {showDeleteConfirm && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                        <p className="text-sm text-slate-300 mb-3">
                            {t('model.deleteConfirm', 'Are you sure you want to delete the model? You\'ll need to re-download it to use local analysis.')}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex-1 py-2 px-3 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                            >
                                {isDeleting ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-2 px-3 rounded-lg bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Actions */}
                {!showDeleteConfirm && (
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            {status.downloaded ? (
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
                                >
                                    <Trash2 size={16} />
                                    {t('model.deleteButton', 'Delete model')}
                                </button>
                            ) : status.downloading ? (
                                <button
                                    onClick={handleCancel}
                                    disabled={isCancelling}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors disabled:opacity-50"
                                >
                                    {isCancelling ? (
                                        <>
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                            >
                                                <XCircle size={16} />
                                            </motion.div>
                                            {t('common.cancelling', 'Cancelling...')}
                                        </>
                                    ) : (
                                        <>
                                            <XCircle size={16} />
                                            {t('common.cancel', 'Cancel')}
                                        </>
                                    )}
                                </button>
                            ) : isExtracting ? (
                                <div className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-cyan-500/20 text-cyan-400 text-sm font-medium">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    >
                                        <Cpu size={16} />
                                    </motion.div>
                                    {t('model.extractingModel', 'Extracting model...')}
                                </div>
                            ) : (
                                <button
                                    onClick={handleDownload}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-medium hover:brightness-110 transition-all"
                                >
                                    <Download size={16} />
                                    {t('model.downloadButton', 'Download')}
                                </button>
                            )}

                            <button
                                onClick={() => refreshStatus()}
                                disabled={isChecking || status.downloading || isExtracting}
                                className="p-2.5 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors disabled:opacity-50"
                                aria-label={t('common.refresh', 'Refresh')}
                            >
                                <RefreshCw size={16} className={isChecking ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        {/* Token Toggle Button */}
                        {!status.downloaded && !status.downloading && !isExtracting && !showTokenInput && (
                            <button
                                onClick={() => setShowTokenInput(true)}
                                className="w-full flex items-center justify-center gap-2 py-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                                <Key size={14} />
                                {t('model.needToken', 'Need token?')}
                            </button>
                        )}
                    </div>
                )}

                {/* Description */}
                <p className="text-xs text-slate-500">
                    {status.downloaded
                        ? t('model.descriptionDownloaded', 'Analysis runs locally on device. Data is never sent to external servers.')
                        : t('model.descriptionNotDownloaded', 'Download Kreativium 4B to run analysis offline. Requires WiFi for download.')}
                </p>
            </div>
        </div>
    );
}

export default ModelManager;

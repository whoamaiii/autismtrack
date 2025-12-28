/**
 * Model Loader Component
 * First-time setup screen for downloading the local AI model
 * Shows progress, handles errors, and provides skip option
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, AlertTriangle, CheckCircle, Cpu, Wifi, WifiOff, X, Sparkles } from 'lucide-react';
import { useModel } from '../contexts/ModelContext';
import { useTranslation } from 'react-i18next';

// =============================================================================
// TYPES
// =============================================================================

interface ModelLoaderProps {
    onSkip?: () => void;
    onComplete?: () => void;
    showSkip?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const ModelLoader: React.FC<ModelLoaderProps> = ({
    onSkip,
    onComplete,
    showSkip = true
}) => {
    const { t } = useTranslation();
    const {
        isLoaded,
        isLoading,
        loadProgress,
        progressText,
        error,
        webGPUSupported,
        webGPUError,
        modelInfo,
        loadModel,
    } = useModel();

    // Call onComplete when model is loaded
    React.useEffect(() => {
        if (isLoaded && onComplete) {
            onComplete();
        }
    }, [isLoaded, onComplete]);

    // Handle download click
    const handleDownload = async () => {
        try {
            await loadModel();
        } catch {
            // Error is handled by context
        }
    };

    // WebGPU not supported
    if (webGPUSupported === false) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="liquid-glass-card p-8 max-w-md w-full text-center"
                >
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                    </div>

                    <h2 className="text-xl font-bold text-white mb-3">
                        {t('modelLoader.browserNotSupported')}
                    </h2>

                    <p className="text-gray-400 mb-6">
                        {webGPUError || t('modelLoader.webGPUNotAvailable')}
                    </p>

                    {showSkip && onSkip && (
                        <button
                            onClick={onSkip}
                            className="liquid-glass-active px-6 py-3 rounded-xl text-white font-medium"
                        >
                            {t('modelLoader.continueWithoutAI')}
                        </button>
                    )}
                </motion.div>
            </div>
        );
    }

    // Model already loaded
    if (isLoaded) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="liquid-glass-card p-8 max-w-md w-full text-center"
                >
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-green-400" />
                    </div>

                    <h2 className="text-xl font-bold text-white mb-3">
                        {t('modelLoader.modelReady')}
                    </h2>

                    <p className="text-gray-400 mb-6">
                        {t('modelLoader.localAnalysisEnabled')}
                    </p>

                    <button
                        onClick={onComplete}
                        className="liquid-glass-active px-6 py-3 rounded-xl text-white font-medium"
                    >
                        {t('modelLoader.continueToApp')}
                    </button>
                </motion.div>
            </div>
        );
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="liquid-glass-card p-8 max-w-md w-full"
                >
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            >
                                <Cpu className="w-8 h-8 text-cyan-400" />
                            </motion.div>
                        </div>

                        <h2 className="text-xl font-bold text-white mb-2">
                            {t('modelLoader.loadingModel')}
                        </h2>

                        <p className="text-gray-400 text-sm">
                            {progressText || t('modelLoader.initializing')}
                        </p>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-6">
                        <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${loadProgress}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-sm">
                            <span className="text-gray-500">{loadProgress}%</span>
                            <span className="text-gray-500">~{modelInfo.vramRequired}</span>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                        <Wifi className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                        <p className="text-sm text-gray-400">
                            {t('modelLoader.downloadingModel')}
                        </p>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Initial state - prompt to download
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="liquid-glass-card p-8 max-w-md w-full relative"
            >
                {/* Skip button */}
                {showSkip && onSkip && (
                    <button
                        onClick={onSkip}
                        className="absolute top-4 right-4 p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label={t('modelLoader.skip')}
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                        <Sparkles className="w-10 h-10 text-cyan-400" />
                    </div>

                    <h1 className="text-2xl font-bold text-white mb-3">
                        {t('modelLoader.downloadAIModel')}
                    </h1>

                    <p className="text-gray-400">
                        {t('modelLoader.offlineAnalysis')}
                    </p>
                </div>

                {/* Error message */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20"
                        >
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-red-400 font-medium">{t('modelLoader.downloadFailed')}</p>
                                    <p className="text-red-400/70 text-sm mt-1">{error}</p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Model info */}
                <div className="space-y-3 mb-8">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <span className="text-gray-400 text-sm">{t('modelLoader.modelInfo.model')}</span>
                        <span className="text-white text-sm font-medium">{t('modelLoader.modelInfo.modelName')}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <span className="text-gray-400 text-sm">{t('modelLoader.modelInfo.size')}</span>
                        <span className="text-white text-sm font-medium">{t('modelLoader.modelInfo.sizeValue')}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <span className="text-gray-400 text-sm">{t('modelLoader.modelInfo.vramRequired')}</span>
                        <span className="text-white text-sm font-medium">{modelInfo.vramRequired}</span>
                    </div>
                </div>

                {/* Features */}
                <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
                    <h3 className="text-white font-medium mb-3">{t('modelLoader.benefits.title')}</h3>
                    <ul className="space-y-2">
                        <li className="flex items-center gap-2 text-sm text-gray-300">
                            <WifiOff className="w-4 h-4 text-cyan-400" />
                            {t('modelLoader.benefits.offline')}
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-300">
                            <CheckCircle className="w-4 h-4 text-cyan-400" />
                            {t('modelLoader.benefits.privacy')}
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-300">
                            <Sparkles className="w-4 h-4 text-cyan-400" />
                            {t('modelLoader.benefits.optimized')}
                        </li>
                    </ul>
                </div>

                {/* Download button */}
                <button
                    onClick={handleDownload}
                    disabled={isLoading}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold flex items-center justify-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    <Download className="w-5 h-5" />
                    {t('modelLoader.downloadButton')}
                </button>

                {/* Skip link */}
                {showSkip && onSkip && (
                    <button
                        onClick={onSkip}
                        className="w-full mt-4 py-3 text-gray-500 hover:text-gray-300 text-sm transition-colors"
                    >
                        {t('modelLoader.skipForNow')}
                    </button>
                )}
            </motion.div>
        </div>
    );
};

export default ModelLoader;

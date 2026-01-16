/**
 * OfflineBanner Component
 *
 * Displays a persistent banner when the user loses internet connection.
 * Automatically hides when connection is restored.
 * Animations respect prefers-reduced-motion via MotionConfig in App.tsx.
 */

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useTranslation } from 'react-i18next';

export const OfflineBanner: React.FC = () => {
    const isOnline = useOnlineStatus();
    const { t } = useTranslation();

    const handleRetry = () => {
        // Force a network check by reloading
        window.location.reload();
    };

    return (
        <AnimatePresence>
            {!isOnline && (
                <motion.div
                    initial={{ opacity: 0, y: -50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -50 }}
                    transition={{ duration: 0.3 }}
                    className="fixed top-0 left-0 right-0 z-[100] bg-amber-600 text-white px-4 py-3 shadow-lg"
                    role="alert"
                    aria-live="assertive"
                >
                    <div className="flex items-center justify-center gap-3 max-w-md mx-auto">
                        <WifiOff size={20} className="shrink-0" aria-hidden="true" />
                        <span className="text-sm font-medium">
                            {t('offline.message', 'You\'re offline. Some features may not work.')}
                        </span>
                        <button
                            onClick={handleRetry}
                            className="flex items-center gap-1.5 px-3 py-2.5 bg-white/20 hover:bg-white/30 rounded-full text-xs font-semibold transition-colors min-w-[44px] min-h-[44px] justify-center"
                            aria-label={t('offline.retry', 'Retry connection')}
                        >
                            <RefreshCw size={14} aria-hidden="true" />
                            <span className="hidden sm:inline">{t('offline.retry', 'Retry')}</span>
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default OfflineBanner;

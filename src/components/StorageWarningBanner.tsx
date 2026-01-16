/**
 * StorageWarningBanner Component
 *
 * Displays a warning banner when localStorage usage exceeds warning threshold (70%).
 * Shows critical alert when usage exceeds 90%.
 * Provides quick action to export data.
 */

import React from 'react';
import { HardDrive, Download, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useStorageHealth } from '../hooks/useStorageHealth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useTranslation } from 'react-i18next';

export const StorageWarningBanner: React.FC = () => {
    const { health, isDismissed, dismiss } = useStorageHealth();
    const isOnline = useOnlineStatus();
    const { t } = useTranslation();
    const navigate = useNavigate();

    // Only show for warning or critical status, and not dismissed
    const shouldShow = (health.status === 'warning' || health.status === 'critical') && !isDismissed;

    // Position below OfflineBanner when it's visible (offline state)
    // OfflineBanner height is approximately 52px (py-3 = 12px * 2 + content)
    const topOffset = !isOnline ? 'top-[52px]' : 'top-0';

    const handleExport = () => {
        // Navigate to settings where export functionality exists
        navigate('/settings');
        dismiss();
    };

    const isCritical = health.status === 'critical';

    return (
        <AnimatePresence>
            {shouldShow && (
                <motion.div
                    initial={{ opacity: 0, y: -50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -50 }}
                    transition={{ duration: 0.3 }}
                    className={`fixed ${topOffset} left-0 right-0 z-[99] ${
                        isCritical
                            ? 'bg-red-600 text-white'
                            : 'bg-amber-500 text-white'
                    } px-4 py-3 shadow-lg transition-[top] duration-300`}
                    role="alert"
                    aria-live="polite"
                >
                    <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            {isCritical ? (
                                <AlertTriangle size={20} className="shrink-0" aria-hidden="true" />
                            ) : (
                                <HardDrive size={20} className="shrink-0" aria-hidden="true" />
                            )}
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold truncate">
                                    {t('storage.warningTitle', 'Storage Almost Full')}
                                </span>
                                <span className="text-xs opacity-90 truncate">
                                    {t('storage.warningMessage', {
                                        percent: health.usage.usagePercent,
                                        defaultValue: `Using ${health.usage.usagePercent}% of storage`
                                    })}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={handleExport}
                                className={`flex items-center gap-1 px-3 py-1.5 ${
                                    isCritical
                                        ? 'bg-white/20 hover:bg-white/30'
                                        : 'bg-white/20 hover:bg-white/30'
                                } rounded-full text-xs font-semibold transition-colors min-w-[44px] min-h-[44px] justify-center`}
                                aria-label={t('storage.exportButton', 'Export Data')}
                            >
                                <Download size={14} aria-hidden="true" />
                                <span className="hidden sm:inline">
                                    {t('storage.exportButton', 'Export')}
                                </span>
                            </button>

                            {!isCritical && (
                                <button
                                    onClick={dismiss}
                                    className="p-2 hover:bg-white/20 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                                    aria-label={t('storage.dismissButton', 'Dismiss')}
                                >
                                    <X size={16} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Progress bar showing usage */}
                    <div className="max-w-md mx-auto mt-2">
                        <div className="h-1 bg-white/30 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${health.usage.usagePercent}%` }}
                                transition={{ duration: 0.5 }}
                                className={`h-full ${
                                    isCritical ? 'bg-white' : 'bg-white/80'
                                }`}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] opacity-75 mt-1">
                            <span>{health.usage.usedFormatted}</span>
                            <span>{health.usage.quotaFormatted}</span>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default StorageWarningBanner;

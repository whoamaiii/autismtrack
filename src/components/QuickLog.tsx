/**
 * Quick Log Component - Traffic Light Quick Entry
 * Provides a simple 3-button interface for fast logging during stressful moments
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
    Smile,
    Meh,
    Frown,
    ChevronDown,
    ChevronUp,
    Check,
    Clock,
    MapPin
} from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useLogs, useAppContext } from '../store';
import type { ContextType } from '../types';
import { isNative } from '../utils/platform';

// =============================================================================
// TYPES
// =============================================================================

type QuickLogLevel = 'good' | 'struggling' | 'crisis';

interface QuickLogMapping {
    arousal: { min: number; max: number; default: number };
    valence: { min: number; max: number; default: number };
    energy: { min: number; max: number; default: number };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const QUICK_LOG_MAPPINGS: Record<QuickLogLevel, QuickLogMapping> = {
    good: {
        arousal: { min: 1, max: 3, default: 2 },
        valence: { min: 7, max: 10, default: 8 },
        energy: { min: 6, max: 10, default: 7 }
    },
    struggling: {
        arousal: { min: 4, max: 6, default: 5 },
        valence: { min: 4, max: 6, default: 5 },
        energy: { min: 3, max: 6, default: 4 }
    },
    crisis: {
        arousal: { min: 7, max: 10, default: 8 },
        valence: { min: 1, max: 3, default: 2 },
        energy: { min: 1, max: 3, default: 2 }
    }
};

// School hours configuration
const SCHOOL_HOURS = {
    start: 8,  // 8 AM
    end: 15    // 3 PM
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Auto-detect context based on current time
 * Returns 'school' during school hours on weekdays, 'home' otherwise
 */
function detectContext(): ContextType {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    // Weekend = home
    if (day === 0 || day === 6) {
        return 'home';
    }

    // Weekday school hours
    if (hour >= SCHOOL_HOURS.start && hour < SCHOOL_HOURS.end) {
        return 'school';
    }

    return 'home';
}

/**
 * Trigger haptic feedback using Capacitor Haptics (native) or Web Vibration API (fallback)
 */
async function triggerHapticFeedback(pattern: 'light' | 'medium' | 'heavy' = 'medium') {
    try {
        if (isNative()) {
            // Use Capacitor Haptics for native apps
            const impactStyles: Record<string, ImpactStyle> = {
                light: ImpactStyle.Light,
                medium: ImpactStyle.Medium,
                heavy: ImpactStyle.Heavy
            };
            await Haptics.impact({ style: impactStyles[pattern] });
        } else if ('vibrate' in navigator) {
            // Fallback to Web Vibration API for PWA/browser
            const patterns: Record<string, number | number[]> = {
                light: 10,
                medium: 30,
                heavy: [50, 30, 50]
            };
            navigator.vibrate(patterns[pattern]);
        }
    } catch (error) {
        // Haptics not available, silently ignore
        if (import.meta.env.DEV) {
            console.warn('[QuickLog] Haptic feedback not available:', error);
        }
    }
}

/**
 * Get random value within a range (for natural variation)
 */
function getValueInRange(min: number, max: number, defaultVal: number): number {
    // 70% chance of default value, 30% chance of random variation
    if (Math.random() < 0.7) {
        return defaultVal;
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// =============================================================================
// COMPONENT
// =============================================================================

interface QuickLogProps {
    /** Callback when log is successfully added */
    onLogAdded?: () => void;
    /** Whether to show as compact mode */
    compact?: boolean;
}

export const QuickLog: React.FC<QuickLogProps> = ({ onLogAdded, compact = false }) => {
    const { t } = useTranslation();
    const { addLog } = useLogs();
    const { currentContext, setCurrentContext } = useAppContext();

    const [showDetails, setShowDetails] = useState(false);
    const [selectedLevel, setSelectedLevel] = useState<QuickLogLevel | null>(null);
    const [note, setNote] = useState('');
    const [successLevel, setSuccessLevel] = useState<QuickLogLevel | null>(null);
    const [isSaving, setIsSaving] = useState(false); // Prevent double taps
    const [detectedContext] = useState<ContextType>(() => detectContext());

    // Use detected context if current context isn't explicitly set
    const effectiveContext = useMemo(() => {
        return currentContext || detectedContext;
    }, [currentContext, detectedContext]);

    const handleQuickLog = useCallback((level: QuickLogLevel) => {
        // Always trigger haptic feedback for user feedback, even when blocked
        triggerHapticFeedback(level === 'crisis' ? 'heavy' : level === 'struggling' ? 'medium' : 'light');

        // Prevent double taps from creating duplicate logs
        if (isSaving) return;
        setIsSaving(true);

        const mapping = QUICK_LOG_MAPPINGS[level];
        const now = new Date();

        const logEntry = {
            id: crypto.randomUUID(),
            timestamp: now.toISOString(),
            context: effectiveContext,
            arousal: getValueInRange(mapping.arousal.min, mapping.arousal.max, mapping.arousal.default),
            valence: getValueInRange(mapping.valence.min, mapping.valence.max, mapping.valence.default),
            energy: getValueInRange(mapping.energy.min, mapping.energy.max, mapping.energy.default),
            sensoryTriggers: [],
            contextTriggers: [],
            strategies: [],
            duration: 30, // Default 30 minutes
            note: note.trim(),
            quickLogLevel: level // Store the quick log level for reference
        };

        const success = addLog(logEntry);

        if (success) {
            setSuccessLevel(level);
            setNote('');
            setShowDetails(false);
            setSelectedLevel(null);
            onLogAdded?.();

            // Clear success indicator and re-enable after animation
            setTimeout(() => {
                setSuccessLevel(null);
                setIsSaving(false);
            }, 1500);
        } else {
            // Re-enable on failure
            setIsSaving(false);
        }
    }, [addLog, effectiveContext, note, onLogAdded, isSaving]);

    const handleButtonClick = useCallback((level: QuickLogLevel) => {
        if (showDetails && selectedLevel === level) {
            // If details are open for this level, submit it
            handleQuickLog(level);
        } else if (showDetails) {
            // If details are open for different level, switch to new level
            setSelectedLevel(level);
        } else {
            // No details open - do quick log immediately
            handleQuickLog(level);
        }
    }, [showDetails, selectedLevel, handleQuickLog]);

    const handleToggleDetails = useCallback((level: QuickLogLevel) => {
        if (showDetails && selectedLevel === level) {
            setShowDetails(false);
            setSelectedLevel(null);
        } else {
            setShowDetails(true);
            setSelectedLevel(level);
        }
    }, [showDetails, selectedLevel]);

    const buttonConfig: Array<{
        level: QuickLogLevel;
        icon: typeof Smile;
        label: string;
        colors: string;
        ringColor: string;
    }> = [
        {
            level: 'good',
            icon: Smile,
            label: t('quickLog.good', 'Bra'),
            colors: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/40',
            ringColor: 'ring-emerald-500'
        },
        {
            level: 'struggling',
            icon: Meh,
            label: t('quickLog.struggling', 'Sliter'),
            colors: 'from-amber-500/20 to-amber-600/20 border-amber-500/40',
            ringColor: 'ring-amber-500'
        },
        {
            level: 'crisis',
            icon: Frown,
            label: t('quickLog.crisis', 'Krise'),
            colors: 'from-red-500/20 to-red-600/20 border-red-500/40',
            ringColor: 'ring-red-500'
        }
    ];

    return (
        <div className={`${compact ? 'p-2' : 'p-4'}`}>
            {/* Header with context indicator */}
            {!compact && (
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white/90">
                        {t('quickLog.title', 'Hurtiglogg')}
                    </h2>
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-white/50" />
                        <span className="text-sm text-white/50">
                            {new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                            onClick={() => setCurrentContext(effectiveContext === 'home' ? 'school' : 'home')}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                            title={t('quickLog.changeContext', 'Bytt kontekst')}
                        >
                            <MapPin className="w-4 h-4 text-white/50" />
                            <span className="text-sm text-white/70">
                                {effectiveContext === 'home'
                                    ? t('quickLog.home', 'Hjemme')
                                    : t('quickLog.school', 'Skole')}
                            </span>
                        </button>
                    </div>
                </div>
            )}

            {/* Traffic Light Buttons */}
            <div className={`grid ${compact ? 'grid-cols-3 gap-2' : 'grid-cols-1 gap-3'}`}>
                {buttonConfig.map(({ level, icon: Icon, label, colors, ringColor }) => (
                    <motion.div
                        key={level}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2, delay: buttonConfig.findIndex(b => b.level === level) * 0.05 }}
                    >
                        <div className="relative">
                            {/* Main button */}
                            <motion.button
                                whileHover={isSaving ? {} : { scale: 1.02 }}
                                whileTap={isSaving ? {} : { scale: 0.98 }}
                                onClick={() => handleButtonClick(level)}
                                onDoubleClick={() => handleToggleDetails(level)}
                                className={`
                                    w-full ${compact ? 'p-3' : 'p-4'}
                                    bg-gradient-to-br ${colors}
                                    border rounded-xl
                                    flex ${compact ? 'flex-col' : 'flex-row'} items-center ${compact ? '' : 'justify-between'} gap-2
                                    transition-all duration-200
                                    ${selectedLevel === level ? `ring-2 ${ringColor}` : ''}
                                    ${successLevel === level ? 'ring-2 ring-green-500' : ''}
                                    ${isSaving ? 'opacity-60' : 'active:scale-95'}
                                `}
                                aria-label={`${label} - ${t('quickLog.tapToLog', 'Trykk for å logge')}`}
                                aria-busy={isSaving}
                                aria-disabled={isSaving}
                            >
                                <div className={`flex items-center gap-3 ${compact ? 'flex-col' : ''}`}>
                                    <Icon className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} text-white`} />
                                    <span className={`${compact ? 'text-xs' : 'text-lg'} font-medium text-white`}>
                                        {label}
                                    </span>
                                </div>

                                {!compact && (
                                    <div className="flex items-center gap-2">
                                        {successLevel === level ? (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="flex items-center gap-1 text-green-400"
                                            >
                                                <Check className="w-5 h-5" />
                                                <span className="text-sm">{t('quickLog.logged', 'Logget!')}</span>
                                            </motion.div>
                                        ) : (
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleDetails(level);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        handleToggleDetails(level);
                                                    }
                                                }}
                                                className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                                                aria-label={t('quickLog.addDetails', 'Legg til detaljer')}
                                            >
                                                {showDetails && selectedLevel === level ? (
                                                    <ChevronUp className="w-5 h-5 text-white/60" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 text-white/60" />
                                                )}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </motion.button>

                            {/* Success animation overlay */}
                            <AnimatePresence>
                                {successLevel === level && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 bg-green-500/20 rounded-xl pointer-events-none"
                                    />
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Details Panel */}
            <AnimatePresence>
                {showDetails && selectedLevel && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-4 overflow-hidden"
                    >
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                            <h3 className="text-sm font-medium text-white/80">
                                {t('quickLog.addNote', 'Legg til et notat (valgfritt)')}
                            </h3>

                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder={t('quickLog.notePlaceholder', 'Hva skjer akkurat nå?')}
                                className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                rows={3}
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowDetails(false);
                                        setSelectedLevel(null);
                                        setNote('');
                                    }}
                                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
                                >
                                    {t('quickLog.cancel', 'Avbryt')}
                                </button>
                                <button
                                    onClick={() => handleQuickLog(selectedLevel)}
                                    className="flex-1 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white font-medium transition-colors"
                                >
                                    {t('quickLog.save', 'Lagre logg')}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Help text */}
            {!compact && (
                <p className="mt-4 text-xs text-white/40 text-center">
                    {t('quickLog.hint', 'Trykk én gang for å logge raskt. Dobbelttrykk for å legge til detaljer.')}
                </p>
            )}
        </div>
    );
};

export default QuickLog;

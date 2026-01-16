import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isNative } from '../utils/platform';

interface BreathingCountdownProps {
    /** Called when countdown completes */
    onComplete: () => void;
    /** Duration of countdown in seconds (default: 3) */
    duration?: number;
    /** Allow skipping the countdown */
    allowSkip?: boolean;
}

/**
 * A calming breathing countdown shown before starting the crisis timer.
 * Helps caregivers transition from panic mode to observation mode.
 */
export const BreathingCountdown: React.FC<BreathingCountdownProps> = ({
    onComplete,
    duration = 3,
    allowSkip = true
}) => {
    const { t } = useTranslation();
    const [countdown, setCountdown] = useState(duration);
    const [breathPhase, setBreathPhase] = useState<'in' | 'out'>('in');

    // Haptic feedback
    const triggerHaptic = useCallback(async () => {
        if (isNative()) {
            try {
                await Haptics.impact({ style: ImpactStyle.Light });
            } catch {
                // Haptics not available
            }
        } else if (navigator.vibrate) {
            navigator.vibrate(30);
        }
    }, []);

    // Countdown timer
    useEffect(() => {
        if (countdown <= 0) {
            onComplete();
            return;
        }

        const timer = setInterval(() => {
            setCountdown(prev => {
                const next = prev - 1;
                if (next > 0) {
                    void triggerHaptic();
                }
                return next;
            });
            setBreathPhase(prev => prev === 'in' ? 'out' : 'in');
        }, 1000);

        // Initial haptic
        void triggerHaptic();

        return () => clearInterval(timer);
    }, [countdown, onComplete, triggerHaptic]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-xl">
            <AnimatePresence mode="wait">
                {countdown > 0 && (
                    <motion.div
                        key="breathing"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        className="flex flex-col items-center gap-8 px-8 text-center"
                    >
                        {/* Breathing Circle */}
                        <motion.div
                            className="relative w-48 h-48 flex items-center justify-center"
                        >
                            {/* Outer glow */}
                            <motion.div
                                className="absolute inset-0 rounded-full bg-cyan-500/20"
                                animate={{
                                    scale: breathPhase === 'in' ? [1, 1.3] : [1.3, 1],
                                    opacity: breathPhase === 'in' ? [0.2, 0.5] : [0.5, 0.2]
                                }}
                                transition={{ duration: 1, ease: 'easeInOut' }}
                            />

                            {/* Inner circle */}
                            <motion.div
                                className="absolute w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600"
                                animate={{
                                    scale: breathPhase === 'in' ? [0.8, 1.1] : [1.1, 0.8]
                                }}
                                transition={{ duration: 1, ease: 'easeInOut' }}
                            />

                            {/* Countdown number */}
                            <motion.span
                                key={countdown}
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.5 }}
                                transition={{ duration: 0.3 }}
                                className="relative text-5xl font-bold text-white z-10"
                            >
                                {countdown}
                            </motion.span>
                        </motion.div>

                        {/* Breathing instruction */}
                        <motion.p
                            key={breathPhase}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="text-xl text-slate-300 font-medium"
                        >
                            {breathPhase === 'in'
                                ? t('crisis.breathing.breatheIn', 'Breathe in...')
                                : t('crisis.breathing.breatheOut', 'Breathe out...')}
                        </motion.p>

                        {/* Message */}
                        <p className="text-slate-500 text-sm max-w-[250px]">
                            {t('crisis.breathing.message', 'Take a moment to center yourself')}
                        </p>

                        {/* Skip button */}
                        {allowSkip && (
                            <button
                                onClick={onComplete}
                                className="text-slate-500 hover:text-slate-400 text-sm underline underline-offset-2 transition-colors mt-4"
                            >
                                {t('crisis.breathing.skip', 'Skip')}
                            </button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

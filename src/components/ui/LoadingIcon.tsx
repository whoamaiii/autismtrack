import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Sparkles } from 'lucide-react';

/**
 * Kreativium Loading Icon
 *
 * Animated brand loader using the brain/sparkle motif.
 * Respects user's reduced motion preferences.
 */

export interface LoadingIconProps {
    /** Size of the icon in pixels */
    size?: number;
    /** Show text label below */
    showLabel?: boolean;
    /** Custom label text */
    label?: string;
    /** Additional CSS classes */
    className?: string;
}

export const LoadingIcon: React.FC<LoadingIconProps> = ({
    size = 48,
    showLabel = false,
    label = 'Loading...',
    className = '',
}) => {
    const prefersReducedMotion = typeof window !== 'undefined'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Animation variants for the brain icon
    const brainVariants = {
        animate: prefersReducedMotion
            ? {}
            : {
                scale: [1, 1.05, 1],
                transition: {
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut' as const,
                },
            },
    };

    // Animation variants for the sparkles
    const sparkleVariants = {
        animate: prefersReducedMotion
            ? {}
            : {
                opacity: [0.5, 1, 0.5],
                scale: [0.8, 1.1, 0.8],
                rotate: [0, 180, 360],
                transition: {
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut' as const,
                },
            },
    };

    // Positions for the decorative sparkles around the brain
    const sparklePositions = [
        { top: '-8px', right: '-4px', delay: 0 },
        { top: '50%', left: '-8px', delay: 0.5 },
        { bottom: '-4px', right: '25%', delay: 1 },
    ];

    return (
        <div className={`flex flex-col items-center gap-3 ${className}`}>
            <div className="relative" style={{ width: size, height: size }}>
                {/* Central brain icon */}
                <motion.div
                    variants={brainVariants}
                    animate="animate"
                    className="absolute inset-0 flex items-center justify-center"
                >
                    <Brain
                        size={size * 0.7}
                        className="text-primary"
                        strokeWidth={1.5}
                    />
                </motion.div>

                {/* Decorative sparkles */}
                {sparklePositions.map((pos, i) => (
                    <motion.div
                        key={i}
                        className="absolute"
                        style={{
                            top: pos.top,
                            right: pos.right,
                            bottom: pos.bottom,
                            left: pos.left,
                        }}
                        variants={sparkleVariants}
                        animate="animate"
                        transition={{
                            delay: pos.delay,
                        }}
                    >
                        <Sparkles
                            size={size * 0.25}
                            className="text-cyan-400"
                            strokeWidth={2}
                        />
                    </motion.div>
                ))}

                {/* Pulsing glow effect */}
                {!prefersReducedMotion && (
                    <motion.div
                        className="absolute inset-0 rounded-full bg-primary/20"
                        animate={{
                            scale: [1, 1.3, 1],
                            opacity: [0.5, 0, 0.5],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    />
                )}
            </div>

            {/* Optional label */}
            {showLabel && (
                <motion.span
                    className="text-sm text-slate-400 font-medium"
                    animate={
                        prefersReducedMotion
                            ? {}
                            : {
                                opacity: [0.5, 1, 0.5],
                            }
                    }
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                >
                    {label}
                </motion.span>
            )}
        </div>
    );
};

/**
 * Full-screen loading overlay
 */
export interface LoadingOverlayProps {
    /** Whether the overlay is visible */
    visible?: boolean;
    /** Loading message */
    message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    visible = true,
    message = 'Loading...',
}) => {
    if (!visible) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background-dark/90 backdrop-blur-sm"
        >
            <LoadingIcon size={64} showLabel label={message} />
        </motion.div>
    );
};

/**
 * Inline loading spinner (smaller, for buttons/inline elements)
 */
export interface LoadingSpinnerProps {
    /** Size in pixels */
    size?: number;
    /** Additional CSS classes */
    className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 20,
    className = '',
}) => {
    const prefersReducedMotion = typeof window !== 'undefined'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return (
        <motion.div
            className={`inline-block ${className}`}
            animate={
                prefersReducedMotion
                    ? {}
                    : { rotate: 360 }
            }
            transition={{
                duration: 1,
                repeat: Infinity,
                ease: 'linear',
            }}
        >
            <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
            >
                <circle
                    cx="12"
                    cy="12"
                    r="10"
                    strokeOpacity="0.25"
                />
                <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="currentColor"
                />
            </svg>
        </motion.div>
    );
};

export default LoadingIcon;

import React from 'react';
import { motion } from 'framer-motion';

/**
 * Skeleton Loading Components
 *
 * Provides shimmer animation placeholders that match the app's design system.
 * Use these to prevent layout shift while content loads.
 */

interface SkeletonBaseProps {
    /** Additional CSS classes */
    className?: string;
    /** Disable animation (respects reduced motion) */
    noAnimation?: boolean;
}

// Shimmer animation for skeleton elements
const shimmerVariants = {
    initial: { backgroundPosition: '-200% 0' },
    animate: {
        backgroundPosition: '200% 0',
        transition: {
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear' as const,
        },
    },
};

/**
 * Base skeleton element with shimmer animation
 */
export const SkeletonBase: React.FC<SkeletonBaseProps & { children?: React.ReactNode }> = ({
    className = '',
    noAnimation = false,
    children,
}) => {
    const prefersReducedMotion = typeof window !== 'undefined'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const shouldAnimate = !noAnimation && !prefersReducedMotion;

    return (
        <motion.div
            className={`
                bg-gradient-to-r from-white/5 via-white/10 to-white/5
                bg-[length:200%_100%]
                rounded-lg
                ${className}
            `.trim().replace(/\s+/g, ' ')}
            variants={shouldAnimate ? shimmerVariants : undefined}
            initial={shouldAnimate ? 'initial' : undefined}
            animate={shouldAnimate ? 'animate' : undefined}
        >
            {children}
        </motion.div>
    );
};

/**
 * Skeleton text line placeholder
 */
interface SkeletonTextProps extends SkeletonBaseProps {
    /** Number of text lines to show */
    lines?: number;
    /** Width of each line (last line is typically shorter) */
    lineWidth?: 'full' | 'varied';
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
    lines = 1,
    lineWidth = 'varied',
    className = '',
    noAnimation = false,
}) => {
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => {
                // Last line is shorter for natural text appearance
                const isLast = i === lines - 1 && lines > 1;
                const width = lineWidth === 'varied' && isLast ? 'w-3/4' : 'w-full';
                return (
                    <SkeletonBase
                        key={i}
                        noAnimation={noAnimation}
                        className={`h-4 ${width}`}
                    />
                );
            })}
        </div>
    );
};

/**
 * Skeleton card placeholder - matches the liquid-glass-card styling
 */
interface SkeletonCardProps extends SkeletonBaseProps {
    /** Show header area */
    showHeader?: boolean;
    /** Show content lines */
    contentLines?: number;
    /** Card height (auto or fixed) */
    height?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
    showHeader = true,
    contentLines = 3,
    height,
    className = '',
    noAnimation = false,
}) => {
    return (
        <div
            className={`liquid-glass-card p-5 rounded-2xl ${className}`}
            style={height ? { height } : undefined}
        >
            {showHeader && (
                <div className="flex items-center gap-3 mb-4">
                    <SkeletonBase noAnimation={noAnimation} className="w-10 h-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                        <SkeletonBase noAnimation={noAnimation} className="h-4 w-32" />
                        <SkeletonBase noAnimation={noAnimation} className="h-3 w-24" />
                    </div>
                </div>
            )}
            <SkeletonText lines={contentLines} noAnimation={noAnimation} />
        </div>
    );
};

/**
 * Skeleton chart placeholder
 */
interface SkeletonChartProps extends SkeletonBaseProps {
    /** Chart height */
    height?: number;
    /** Show title area */
    showTitle?: boolean;
}

export const SkeletonChart: React.FC<SkeletonChartProps> = ({
    height = 180,
    showTitle = true,
    className = '',
    noAnimation = false,
}) => {
    return (
        <div className={`liquid-glass-card p-6 rounded-3xl ${className}`}>
            {showTitle && (
                <SkeletonBase noAnimation={noAnimation} className="h-4 w-32 mb-4" />
            )}
            <div className="relative" style={{ height }}>
                {/* Simulated chart area */}
                <SkeletonBase
                    noAnimation={noAnimation}
                    className="absolute inset-0 rounded-lg"
                />
                {/* Simulated Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between py-2">
                    {[0, 1, 2, 3].map((i) => (
                        <SkeletonBase
                            key={i}
                            noAnimation={noAnimation}
                            className="h-3 w-6"
                        />
                    ))}
                </div>
                {/* Simulated X-axis labels */}
                <div className="absolute bottom-0 left-12 right-0 flex justify-between">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <SkeletonBase
                            key={i}
                            noAnimation={noAnimation}
                            className="h-3 w-8"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

/**
 * Skeleton stat card (for Dashboard metrics)
 */
interface SkeletonStatCardProps extends SkeletonBaseProps {
    /** Show icon area */
    showIcon?: boolean;
}

export const SkeletonStatCard: React.FC<SkeletonStatCardProps> = ({
    showIcon = true,
    className = '',
    noAnimation = false,
}) => {
    return (
        <div className={`liquid-glass-card p-4 rounded-2xl ${className}`}>
            <div className="flex items-center gap-3">
                {showIcon && (
                    <SkeletonBase noAnimation={noAnimation} className="w-10 h-10 rounded-xl" />
                )}
                <div className="flex-1 space-y-2">
                    <SkeletonBase noAnimation={noAnimation} className="h-6 w-12" />
                    <SkeletonBase noAnimation={noAnimation} className="h-3 w-16" />
                </div>
            </div>
        </div>
    );
};

/**
 * Skeleton tag/chip placeholder
 */
export const SkeletonTag: React.FC<SkeletonBaseProps> = ({
    className = '',
    noAnimation = false,
}) => {
    return (
        <SkeletonBase
            noAnimation={noAnimation}
            className={`h-6 w-16 rounded-md ${className}`}
        />
    );
};

/**
 * Skeleton radar/sensory profile chart
 */
export const SkeletonRadarChart: React.FC<SkeletonBaseProps> = ({
    className = '',
    noAnimation = false,
}) => {
    return (
        <div className={`flex flex-col items-center ${className}`}>
            {/* Circular radar placeholder */}
            <SkeletonBase
                noAnimation={noAnimation}
                className="w-48 h-48 rounded-full mb-4"
            />
            {/* Legend placeholder */}
            <div className="flex flex-wrap justify-center gap-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                        <SkeletonBase noAnimation={noAnimation} className="w-3 h-3 rounded-full" />
                        <SkeletonBase noAnimation={noAnimation} className="h-3 w-12" />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default {
    Base: SkeletonBase,
    Text: SkeletonText,
    Card: SkeletonCard,
    Chart: SkeletonChart,
    StatCard: SkeletonStatCard,
    Tag: SkeletonTag,
    RadarChart: SkeletonRadarChart,
};

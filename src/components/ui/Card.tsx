import React from 'react';
import { motion, type HTMLMotionProps, useReducedMotion } from 'framer-motion';

/**
 * Card Variants:
 * - primary: Standard liquid glass card for most content
 * - info: Cyan-accented card for informational banners
 * - warning: Orange-accented card for warnings
 * - danger: Red-accented card for alerts and destructive actions
 * - success: Green-accented card for positive feedback
 * - highlight: Gradient background for featured/promoted content
 */
export type CardVariant = 'primary' | 'info' | 'warning' | 'danger' | 'success' | 'highlight';

/**
 * Card Sizes:
 * - sm: Compact padding (p-3), smaller radius (rounded-xl)
 * - md: Standard padding (p-4), medium radius (rounded-2xl)
 * - lg: Large padding (p-5-6), large radius (rounded-3xl)
 */
export type CardSize = 'sm' | 'md' | 'lg';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
    /** Visual style variant */
    variant?: CardVariant;
    /** Padding and border-radius size */
    size?: CardSize;
    /** Enable hover/press animations */
    interactive?: boolean;
    /** Card contents */
    children: React.ReactNode;
    /** Additional className */
    className?: string;
}

const variantClasses: Record<CardVariant, string> = {
    primary: 'liquid-glass-card',
    info: 'liquid-glass-blue',
    warning: 'liquid-glass-orange',
    danger: 'liquid-glass-red',
    success: `
        bg-gradient-to-br from-green-500/20 to-emerald-500/10
        backdrop-blur-[40px] saturate-[180%]
        border border-green-500/30
        shadow-[0_8px_32px_rgba(34,197,94,0.4),0_0_20px_rgba(34,197,94,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]
    `,
    highlight: `
        bg-gradient-to-br from-primary/20 via-purple-500/10 to-blue-500/20
        backdrop-blur-[40px] saturate-[180%]
        border border-primary/30
        shadow-[0_8px_32px_rgba(0,122,255,0.4),0_0_20px_rgba(0,122,255,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]
    `
};

const sizeClasses: Record<CardSize, string> = {
    sm: 'p-3 rounded-xl',
    md: 'p-4 rounded-2xl',
    lg: 'p-5 rounded-3xl sm:p-6'
};

/**
 * A unified Card component providing consistent styling across the app.
 * Supports multiple visual variants, sizes, and optional interactivity.
 *
 * @example
 * // Basic usage
 * <Card>Content here</Card>
 *
 * @example
 * // Info banner
 * <Card variant="info" size="md">
 *   <Info /> Important information
 * </Card>
 *
 * @example
 * // Interactive card with animation
 * <Card variant="primary" interactive>
 *   Clickable content
 * </Card>
 */
const CardBase: React.FC<CardProps> = ({
    variant = 'primary',
    size = 'md',
    interactive = false,
    children,
    className = '',
    ...motionProps
}) => {
    const prefersReducedMotion = useReducedMotion();

    const baseClasses = `${variantClasses[variant]} ${sizeClasses[size]}`;
    const interactiveClasses = interactive
        ? 'transition-all hover:bg-white/10 active:scale-[0.98] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900'
        : '';

    const interactiveMotionProps = interactive && !prefersReducedMotion
        ? {
            whileHover: { y: -2, transition: { duration: 0.15 } },
            whileTap: { scale: 0.98 }
        }
        : {};

    return (
        <motion.div
            className={`${baseClasses} ${interactiveClasses} ${className}`.trim()}
            {...interactiveMotionProps}
            {...motionProps}
        >
            {children}
        </motion.div>
    );
};

/**
 * Card.Header - Optional header section with icon and title
 */
interface CardHeaderProps {
    /** Icon component to display */
    icon?: React.ReactNode;
    /** Icon background color class */
    iconBgColor?: string;
    /** Card title */
    title: string;
    /** Optional subtitle */
    subtitle?: string;
    /** Right-side content (e.g., badge, button) */
    action?: React.ReactNode;
    /** Additional className */
    className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
    icon,
    iconBgColor = 'bg-primary/20',
    title,
    subtitle,
    action,
    className = ''
}) => (
    <div className={`flex items-center justify-between ${className}`}>
        <div className="flex items-center gap-3">
            {icon && (
                <div className={`${iconBgColor} p-2 rounded-xl`}>
                    {icon}
                </div>
            )}
            <div>
                <h3 className="text-slate-900 dark:text-white font-bold text-lg">{title}</h3>
                {subtitle && (
                    <p className="text-slate-500 dark:text-slate-400 text-xs">{subtitle}</p>
                )}
            </div>
        </div>
        {action && <div>{action}</div>}
    </div>
);

/**
 * Card.Content - Main content area with optional spacing
 */
interface CardContentProps {
    children: React.ReactNode;
    /** Additional className */
    className?: string;
}

export const CardContent: React.FC<CardContentProps> = ({
    children,
    className = ''
}) => (
    <div className={`mt-4 ${className}`}>
        {children}
    </div>
);

/**
 * Card.Footer - Optional footer with actions or metadata
 */
interface CardFooterProps {
    children: React.ReactNode;
    /** Additional className */
    className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({
    children,
    className = ''
}) => (
    <div className={`mt-4 pt-4 border-t border-white/10 ${className}`}>
        {children}
    </div>
);

// Compound component pattern for flexible composition
type CardComponent = typeof CardBase & {
    Header: typeof CardHeader;
    Content: typeof CardContent;
    Footer: typeof CardFooter;
};

export const Card = CardBase as CardComponent;
Card.Header = CardHeader;
Card.Content = CardContent;
Card.Footer = CardFooter;

export default Card;

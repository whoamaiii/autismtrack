import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, type LucideIcon } from 'lucide-react';

interface InteractiveCardProps {
    /** Navigation destination */
    to: string;
    /** Card title */
    title: string;
    /** Card subtitle/description */
    subtitle?: string;
    /** Icon component from Lucide */
    icon: LucideIcon;
    /** Background color class for the icon container */
    iconBgColor?: string;
    /** Text color class for the icon */
    iconColor?: string;
    /** Whether to show the arrow indicator (default: false for grid cards) */
    showArrow?: boolean;
    /** Whether this is a compact grid card or full-width list card */
    variant?: 'grid' | 'list';
    /** Additional className */
    className?: string;
    /** Children for custom content */
    children?: React.ReactNode;
}

/**
 * A reusable interactive card component with consistent hover/press states,
 * focus rings for accessibility, and motion preferences support.
 */
export const InteractiveCard: React.FC<InteractiveCardProps> = ({
    to,
    title,
    subtitle,
    icon: Icon,
    iconBgColor = 'bg-primary/10',
    iconColor = 'text-primary',
    showArrow = false,
    variant = 'grid',
    className = '',
    children
}) => {
    const prefersReducedMotion = useReducedMotion();

    const baseClasses = `
        liquid-glass-card rounded-2xl transition-all
        hover:bg-white/10 active:scale-[0.98]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
    `;

    const motionProps = prefersReducedMotion ? {} : {
        whileHover: { y: -2, transition: { duration: 0.15 } },
        whileTap: { scale: 0.98 }
    };

    if (variant === 'list') {
        return (
            <motion.div {...motionProps}>
                <Link
                    to={to}
                    className={`${baseClasses} p-4 flex items-center gap-4 group ${className}`}
                >
                    <div className={`${iconBgColor} w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0`}>
                        <Icon className={iconColor} size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-slate-900 dark:text-white font-bold truncate">{title}</h3>
                        {subtitle && (
                            <p className="text-slate-500 dark:text-slate-400 text-xs truncate">{subtitle}</p>
                        )}
                    </div>
                    {showArrow && (
                        <motion.div
                            className="text-slate-400 flex-shrink-0"
                            animate={prefersReducedMotion ? {} : undefined}
                            whileHover={prefersReducedMotion ? {} : { x: 4 }}
                            transition={{ duration: 0.15 }}
                        >
                            <ArrowRight size={18} />
                        </motion.div>
                    )}
                    {children}
                </Link>
            </motion.div>
        );
    }

    // Grid variant
    return (
        <motion.div {...motionProps}>
            <Link
                to={to}
                className={`${baseClasses} p-4 block h-full group ${className}`}
            >
                <div className={`${iconBgColor} w-10 h-10 rounded-xl flex items-center justify-center mb-3`}>
                    <Icon className={iconColor} size={20} />
                </div>
                <h3 className="text-slate-900 dark:text-white font-bold">{title}</h3>
                {subtitle && (
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{subtitle}</p>
                )}
                {children}
            </Link>
        </motion.div>
    );
};

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { type LucideIcon, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
    title: string;
    description: string;
    icon: LucideIcon;
    actionLabel?: string;
    actionLink?: string;
    onAction?: () => void;
    /** Custom icon for the action button/link. Defaults to Plus */
    actionIcon?: LucideIcon;
    /** If true, renders a compact version without glass background */
    compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    icon: Icon,
    actionLabel,
    actionLink,
    onAction,
    actionIcon: ActionIcon = Plus,
    compact = false
}) => {
    const prefersReducedMotion = useReducedMotion();

    return (
        <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.3 }}
            className={compact
                ? "flex flex-col items-center justify-center text-center py-6"
                : "flex flex-col items-center justify-center text-center p-8 md:p-12 rounded-3xl liquid-glass border border-white/10"
            }
        >
            <div className={`bg-primary/10 rounded-full relative ${compact ? 'p-3 mb-4' : 'p-4 mb-6'}`}>
                {!prefersReducedMotion && (
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                )}
                <Icon size={compact ? 32 : 48} className="text-primary relative z-10" />
            </div>

            <h3 className={`font-bold text-slate-900 dark:text-white mb-2 max-w-md ${compact ? 'text-base' : 'text-xl md:text-2xl'}`}>
                {title}
            </h3>

            <p className={`text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed ${compact ? 'text-sm mb-4' : 'mb-8'}`}>
                {description}
            </p>

            {actionLabel && actionLink && (
                <Link
                    to={actionLink}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-medium transition-all hover:scale-105 shadow-lg shadow-primary/25"
                >
                    <ActionIcon size={20} />
                    {actionLabel}
                </Link>
            )}
            {actionLabel && !actionLink && onAction && (
                <button
                    onClick={onAction}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-medium transition-all hover:scale-105 shadow-lg shadow-primary/25"
                >
                    <ActionIcon size={20} />
                    {actionLabel}
                </button>
            )}
        </motion.div>
    );
};

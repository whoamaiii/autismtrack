import React from 'react';
import { Check, AlertTriangle, Eye, MapPin, type LucideIcon } from 'lucide-react';

/**
 * Tag categories with semantic color coding:
 * - sensory: Red/orange tones for sensory triggers (visual, auditory, tactile)
 * - context: Purple/blue tones for contextual triggers (environment, people, events)
 * - strategy: Green tones for coping strategies that were used
 * - success: Bright green for strategies that worked well
 * - neutral: Muted gray for general tags without specific categorization
 */
export type TagCategory = 'sensory' | 'context' | 'strategy' | 'success' | 'neutral';

export type TagSize = 'sm' | 'md' | 'lg';

export interface TagProps {
    /** The text content of the tag */
    children: React.ReactNode;
    /** Category determines the color scheme */
    category?: TagCategory;
    /** Size variant */
    size?: TagSize;
    /** Optional icon to show before text */
    icon?: LucideIcon;
    /** Show default category icon if no custom icon provided */
    showCategoryIcon?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Click handler for interactive tags */
    onClick?: () => void;
}

// Style mappings for each category
const categoryStyles: Record<TagCategory, {
    bg: string;
    text: string;
    border: string;
    icon: LucideIcon;
}> = {
    sensory: {
        bg: 'bg-orange-500/10',
        text: 'text-orange-300',
        border: 'border-orange-500/20',
        icon: Eye,
    },
    context: {
        bg: 'bg-purple-500/10',
        text: 'text-purple-300',
        border: 'border-purple-500/20',
        icon: MapPin,
    },
    strategy: {
        bg: 'bg-cyan-500/10',
        text: 'text-cyan-300',
        border: 'border-cyan-500/20',
        icon: Check,
    },
    success: {
        bg: 'bg-green-500/10',
        text: 'text-green-300',
        border: 'border-green-500/20',
        icon: Check,
    },
    neutral: {
        bg: 'bg-slate-500/10',
        text: 'text-slate-300',
        border: 'border-slate-500/20',
        icon: AlertTriangle,
    },
};

// Size mappings
const sizeStyles: Record<TagSize, {
    padding: string;
    text: string;
    iconSize: number;
    gap: string;
}> = {
    sm: {
        padding: 'px-2 py-0.5',
        text: 'text-[10px]',
        iconSize: 8,
        gap: 'gap-1',
    },
    md: {
        padding: 'px-2.5 py-1',
        text: 'text-xs',
        iconSize: 10,
        gap: 'gap-1.5',
    },
    lg: {
        padding: 'px-3 py-1.5',
        text: 'text-sm',
        iconSize: 12,
        gap: 'gap-2',
    },
};

export const Tag: React.FC<TagProps> = ({
    children,
    category = 'neutral',
    size = 'md',
    icon,
    showCategoryIcon = false,
    className = '',
    onClick,
}) => {
    const catStyle = categoryStyles[category];
    const sizeStyle = sizeStyles[size];

    // Determine which icon to show (custom icon takes priority)
    const IconComponent = icon ?? (showCategoryIcon ? catStyle.icon : null);

    const baseClasses = `
        inline-flex items-center ${sizeStyle.gap}
        ${sizeStyle.padding} ${sizeStyle.text}
        rounded-md border
        ${catStyle.bg} ${catStyle.text} ${catStyle.border}
        font-medium
        ${onClick ? 'cursor-pointer hover:brightness-110 active:scale-95 transition-all' : ''}
    `.trim().replace(/\s+/g, ' ');

    const TagElement = onClick ? 'button' : 'span';

    return (
        <TagElement
            className={`${baseClasses} ${className}`}
            onClick={onClick}
            type={onClick ? 'button' : undefined}
        >
            {IconComponent && (
                <IconComponent size={sizeStyle.iconSize} aria-hidden="true" />
            )}
            {children}
        </TagElement>
    );
};

export default Tag;

/**
 * BackButton Component
 * A consistent, accessible back navigation button for secondary pages
 * Includes proper touch target sizing (44px minimum) and visual feedback
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface BackButtonProps {
    /** Optional custom label (defaults to translated "Back") */
    label?: string;
    /** Optional custom destination (defaults to navigate(-1)) */
    to?: string;
    /** Show label text alongside icon */
    showLabel?: boolean;
    /** Additional CSS classes */
    className?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({
    label,
    to,
    showLabel = false,
    className = ''
}) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const buttonLabel = label || t('common.back', 'Back');

    const handleClick = () => {
        if (to) {
            navigate(to);
        } else if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/', { replace: true });
        }
    };

    return (
        <button
            onClick={handleClick}
            className={`
                flex items-center justify-center gap-2
                min-w-[44px] min-h-[44px]
                rounded-full
                hover:bg-white/10 active:bg-white/20
                transition-colors
                text-white
                ${showLabel ? 'px-4' : ''}
                ${className}
            `}
            aria-label={buttonLabel}
        >
            <ArrowLeft size={20} aria-hidden="true" />
            {showLabel && (
                <span className="text-sm font-medium">{buttonLabel}</span>
            )}
        </button>
    );
};

export default BackButton;

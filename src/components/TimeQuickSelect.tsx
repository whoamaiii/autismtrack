import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * TimeQuickSelect Component
 *
 * Provides quick time selection chips for common scenarios:
 * "Now", "5 min ago", "30 min ago", "1 hour ago"
 *
 * Useful for logging events that happened in the recent past.
 */

export interface TimeQuickSelectProps {
    /** Current selected timestamp (ISO string or datetime-local format) */
    value: string;
    /** Called when a quick option is selected */
    onChange: (timestamp: string) => void;
    /** Additional CSS classes */
    className?: string;
}

// Quick select options with their minute offsets
interface QuickOption {
    key: string;
    labelKey: string;
    fallbackLabel: string;
    minutesAgo: number;
}

const QUICK_OPTIONS: QuickOption[] = [
    { key: 'now', labelKey: 'timeQuickSelect.now', fallbackLabel: 'Now', minutesAgo: 0 },
    { key: '5min', labelKey: 'timeQuickSelect.5min', fallbackLabel: '5 min ago', minutesAgo: 5 },
    { key: '30min', labelKey: 'timeQuickSelect.30min', fallbackLabel: '30 min ago', minutesAgo: 30 },
    { key: '1hour', labelKey: 'timeQuickSelect.1hour', fallbackLabel: '1 hour ago', minutesAgo: 60 },
];

/**
 * Format a Date to datetime-local format (YYYY-MM-DDTHH:mm)
 */
function formatDateTimeLocal(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Check if the given timestamp matches a quick option (within 1 minute tolerance)
 */
function isOptionSelected(timestamp: string, minutesAgo: number): boolean {
    try {
        const selectedTime = new Date(timestamp).getTime();
        const optionTime = Date.now() - (minutesAgo * 60 * 1000);
        // Allow 1 minute tolerance
        return Math.abs(selectedTime - optionTime) < 60 * 1000;
    } catch {
        return false;
    }
}

export const TimeQuickSelect: React.FC<TimeQuickSelectProps> = ({
    value,
    onChange,
    className = '',
}) => {
    const { t } = useTranslation();

    const handleOptionClick = useCallback((minutesAgo: number) => {
        const now = Date.now();
        const date = new Date(now - (minutesAgo * 60 * 1000));
        onChange(formatDateTimeLocal(date));
    }, [onChange]);

    return (
        <div className={`flex flex-wrap gap-2 ${className}`}>
            {QUICK_OPTIONS.map((option) => {
                const isSelected = isOptionSelected(value, option.minutesAgo);

                return (
                    <motion.button
                        key={option.key}
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleOptionClick(option.minutesAgo)}
                        className={`
                            inline-flex items-center gap-1.5
                            px-3 py-1.5 rounded-lg
                            text-xs font-medium
                            transition-all duration-200
                            ${isSelected
                                ? 'bg-primary/20 text-primary border border-primary/30'
                                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-300'
                            }
                        `}
                        aria-pressed={isSelected}
                    >
                        {isSelected ? (
                            <Check size={12} className="text-primary" />
                        ) : (
                            <Clock size={12} className="opacity-60" />
                        )}
                        {t(option.labelKey, option.fallbackLabel)}
                    </motion.button>
                );
            })}
        </div>
    );
};

export default TimeQuickSelect;

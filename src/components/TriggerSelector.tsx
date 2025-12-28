import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { translateTrigger, translateStrategy, translateWarningSign } from '../utils/translateDomain';

interface TriggerSelectorProps {
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    label: string;
    /** Type of options for translation: 'trigger', 'strategy', or 'warningSign' */
    type?: 'trigger' | 'strategy' | 'warningSign';
}

export const TriggerSelector: React.FC<TriggerSelectorProps> = ({ options, selected, onChange, label, type = 'trigger' }) => {
    const toggleOption = (option: string) => {
        if (selected.includes(option)) {
            onChange(selected.filter(item => item !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    // Get the appropriate translation function
    const getTranslateFunction = () => {
        switch (type) {
            case 'strategy': return translateStrategy;
            case 'warningSign': return translateWarningSign;
            default: return translateTrigger;
        }
    };
    const translate = getTranslateFunction();

    return (
        <div className="flex flex-col gap-3">
            <h3 className="text-slate-900 dark:text-white text-base font-medium leading-normal">{label}</h3>
            <div className="flex flex-wrap gap-2">
                {options.map(option => (
                    <button
                        key={option}
                        type="button"
                        onClick={() => toggleOption(option)}
                        className={twMerge(
                            clsx(
                                "rounded-full px-4 py-2 text-sm font-semibold border backdrop-blur-md transition-all duration-200 max-w-[180px] truncate",
                                selected.includes(option)
                                    ? "bg-primary/20 border-primary text-primary shadow-[0_0_12px_0_rgba(76,141,255,0.5)]"
                                    : "bg-white/5 border-slate-200 dark:border-white/20 text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10"
                            )
                        )}
                        title={translate(option)}
                    >
                        {translate(option)}
                    </button>
                ))}
            </div>
        </div>
    );
};

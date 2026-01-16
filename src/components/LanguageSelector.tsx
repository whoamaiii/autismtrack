import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from './Toast';

interface Language {
    code: string;
    name: string;
    nativeName: string;
    flag: string;
}

const AVAILABLE_LANGUAGES: Language[] = [
    { code: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴' },
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
];

interface LanguageSelectorProps {
    /** Compact mode shows just the globe icon */
    compact?: boolean;
    /** Custom class for the trigger button */
    className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
    compact = true,
    className = ''
}) => {
    const { t, i18n } = useTranslation();
    const { showSuccess } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const currentLanguage = AVAILABLE_LANGUAGES.find(lang => lang.code === i18n.language)
        || AVAILABLE_LANGUAGES[0];

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen]);

    const handleLanguageChange = (langCode: string) => {
        if (langCode !== i18n.language) {
            i18n.changeLanguage(langCode);
            const selectedLang = AVAILABLE_LANGUAGES.find(l => l.code === langCode);
            if (selectedLang) {
                showSuccess(t('languages.changed', { language: selectedLang.nativeName }));
            }
        }
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center justify-center gap-2 transition-all
                    ${compact
                        ? 'p-2.5 bg-white/5 hover:bg-white/10 rounded-full min-w-[44px] min-h-[44px] backdrop-blur-sm'
                        : 'px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl min-h-[44px] backdrop-blur-sm'
                    }
                    ${isOpen ? 'bg-white/15' : ''}
                    ${className}
                `}
                aria-label={t('home.switchLanguage')}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                {compact ? (
                    <Globe className="text-slate-400 dark:text-slate-300" size={20} aria-hidden="true" />
                ) : (
                    <>
                        <span className="text-lg" aria-hidden="true">{currentLanguage.flag}</span>
                        <span className="text-slate-300 text-sm font-medium">{currentLanguage.nativeName}</span>
                        <ChevronDown
                            size={16}
                            className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                    </>
                )}
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute top-full right-0 mt-2 z-50 min-w-[180px]"
                        role="listbox"
                        aria-label={t('languages.selectLanguage', 'Select language')}
                    >
                        <div className="liquid-glass-card rounded-2xl overflow-hidden shadow-xl border border-white/10">
                            <div className="p-2">
                                <p className="px-3 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    {t('languages.selectLanguage', 'Select language')}
                                </p>
                                {AVAILABLE_LANGUAGES.map((lang) => {
                                    const isSelected = lang.code === i18n.language;
                                    return (
                                        <button
                                            key={lang.code}
                                            onClick={() => handleLanguageChange(lang.code)}
                                            role="option"
                                            aria-selected={isSelected}
                                            className={`
                                                w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all
                                                ${isSelected
                                                    ? 'bg-primary/20 text-white'
                                                    : 'hover:bg-white/10 text-slate-300'
                                                }
                                            `}
                                        >
                                            <span className="text-2xl" aria-hidden="true">{lang.flag}</span>
                                            <div className="flex-1 text-left">
                                                <p className="font-medium">{lang.nativeName}</p>
                                                {lang.nativeName !== lang.name && (
                                                    <p className="text-xs text-slate-500">{lang.name}</p>
                                                )}
                                            </div>
                                            {isSelected && (
                                                <Check size={18} className="text-primary" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

import React, { type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Navigation } from './Navigation';
import { motion } from 'framer-motion';
import { useAppContext } from '../store';
import { useTranslation } from 'react-i18next';
import { Home as HomeIcon, GraduationCap } from 'lucide-react';

interface LayoutProps {
    children?: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { currentContext, setCurrentContext } = useAppContext();
    const { t } = useTranslation();

    return (
        <div className="relative min-h-screen w-full overflow-x-hidden font-display selection:bg-primary selection:text-white">
            {/* Background Shader is handled in App.tsx */}

            {/* Content */}
            <main className="relative z-10 w-full max-w-md md:max-w-2xl lg:max-w-6xl mx-auto min-h-screen px-4 pt-2 pb-32">
                {/* Context Toggle - Enhanced with icons and larger touch targets */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-2"
                >
                    <div className="bg-white/10 dark:bg-black/20 backdrop-blur-md p-1.5 rounded-full flex gap-1 border border-white/10 relative">
                        <motion.div
                            className="absolute top-1.5 bottom-1.5 rounded-full bg-white dark:bg-slate-700 shadow-sm"
                            initial={false}
                            animate={{
                                left: currentContext === 'home' ? 6 : '50%',
                                width: currentContext === 'home' ? 'calc(50% - 8px)' : 'calc(50% - 8px)'
                            }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                        <button
                            onClick={() => setCurrentContext('home')}
                            className={`relative z-10 px-5 py-2.5 rounded-full text-sm font-bold transition-colors flex items-center gap-2 min-h-[44px] ${currentContext === 'home'
                                ? 'text-slate-900 dark:text-white'
                                : 'text-slate-500 dark:text-slate-400'
                                }`}
                            aria-pressed={currentContext === 'home'}
                        >
                            <HomeIcon size={16} />
                            {t('layout.home')}
                        </button>
                        <button
                            onClick={() => setCurrentContext('school')}
                            className={`relative z-10 px-5 py-2.5 rounded-full text-sm font-bold transition-colors flex items-center gap-2 min-h-[44px] ${currentContext === 'school'
                                ? 'text-slate-900 dark:text-white'
                                : 'text-slate-500 dark:text-slate-400'
                                }`}
                            aria-pressed={currentContext === 'school'}
                        >
                            <GraduationCap size={16} />
                            {t('layout.school')}
                        </button>
                    </div>

                    {/* Context Indicator */}
                    <motion.div
                        key={currentContext}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`
                            flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                            ${currentContext === 'home'
                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }
                        `}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${currentContext === 'home' ? 'bg-orange-400' : 'bg-blue-400'}`} />
                        {t('layout.loggingAt', { context: currentContext === 'home' ? t('layout.home') : t('layout.school') })}
                    </motion.div>
                </motion.div>
                {children ?? <Outlet />}
            </main>

            <Navigation />
        </div>
    );
};

import React, { type ReactNode } from 'react';
import { Navigation } from './Navigation';
import { motion } from 'framer-motion';
import { useAppContext } from '../store';
import { useTranslation } from 'react-i18next';

interface LayoutProps {
    children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { currentContext, setCurrentContext } = useAppContext();
    const { t } = useTranslation();

    return (
        <div className="relative min-h-screen w-full overflow-x-hidden font-display selection:bg-primary selection:text-white">
            {/* Background Shader is handled in App.tsx */}

            {/* Content */}
            <main className="relative z-10 max-w-md mx-auto min-h-screen p-4 pb-32">
                {/* Context Toggle */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center mb-4"
                >
                    <div className="bg-white/10 dark:bg-black/20 backdrop-blur-md p-1 rounded-full flex gap-1 border border-white/10 relative">
                        <motion.div
                            className="absolute top-1 bottom-1 rounded-full bg-white dark:bg-slate-700 shadow-sm"
                            initial={false}
                            animate={{
                                left: currentContext === 'home' ? 4 : '50%',
                                width: currentContext === 'home' ? 'calc(50% - 6px)' : 'calc(50% - 6px)'
                            }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                        <button
                            onClick={() => setCurrentContext('home')}
                            className={`relative z-10 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${currentContext === 'home'
                                ? 'text-slate-900 dark:text-white'
                                : 'text-slate-500 dark:text-slate-400'
                                }`}
                        >
                            {t('layout.home')}
                        </button>
                        <button
                            onClick={() => setCurrentContext('school')}
                            className={`relative z-10 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${currentContext === 'school'
                                ? 'text-slate-900 dark:text-white'
                                : 'text-slate-500 dark:text-slate-400'
                                }`}
                        >
                            {t('layout.school')}
                        </button>
                    </div>
                </motion.div>
                {children}
            </main>

            <Navigation />
        </div>
    );
};

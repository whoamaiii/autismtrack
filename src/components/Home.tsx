import React, { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    Brain, Activity, Settings, Clock, Database, Check,
    Trash2, ArrowRightLeft, Sparkles, ArrowRight, Grid3X3,
    Globe
} from 'lucide-react';

import { motion, useReducedMotion } from 'framer-motion';
import { loadMockData, clearMockData } from '../utils/generateMockData';
import { useSettings } from '../store';
import { RiskForecast } from './RiskForecast';
import { useTranslation } from 'react-i18next';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.3
        }
    }
} as const;

const containerVariantsReduced = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { duration: 0.01 }
    }
} as const;

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring" as const, stiffness: 300, damping: 24 }
    }
};

const itemVariantsReduced = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { duration: 0.01 }
    }
};

export const Home: React.FC = () => {
    const { refreshData } = useSettings();
    const { t, i18n } = useTranslation();
    const prefersReducedMotion = useReducedMotion();
    const mainRef = useRef<HTMLElement>(null);
    const [mockDataLoaded, setMockDataLoaded] = useState(false);
    const [mockDataCleared, setMockDataCleared] = useState(false);

    // Select motion-safe variants based on user preference
    const activeContainerVariants = prefersReducedMotion ? containerVariantsReduced : containerVariants;
    const activeItemVariants = prefersReducedMotion ? itemVariantsReduced : itemVariants;

    const handleLoadMockData = useCallback(() => {
        loadMockData();
        setMockDataLoaded(true);
        setMockDataCleared(false);
        refreshData();
        setTimeout(() => setMockDataLoaded(false), 2000);
    }, [refreshData]);

    const handleClearMockData = useCallback(() => {
        clearMockData();
        setMockDataCleared(true);
        setMockDataLoaded(false);
        refreshData();
        setTimeout(() => setMockDataCleared(false), 2000);
    }, [refreshData]);

    const toggleLanguage = () => {
        i18n.changeLanguage(i18n.language === 'no' ? 'en' : 'no');
    };

    return (
        <div className="flex flex-col gap-8 py-8 relative">
            {/* Skip Link for keyboard navigation */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                onClick={(e) => {
                    e.preventDefault();
                    mainRef.current?.focus();
                }}
            >
                {t('accessibility.skipToMain')}
            </a>

            <button
                onClick={toggleLanguage}
                className="absolute top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                title="Switch Language / Bytt språk"
            >
                <Globe className="text-slate-500 dark:text-slate-400" size={20} />
            </button>

            <main
                ref={mainRef}
                id="main-content"
                tabIndex={-1}
                className="focus:outline-none"
            >
                <motion.div
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.6, ease: "easeOut" }}
                className="text-center space-y-4 mt-4"
            >
                <motion.div
                    initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1 }}
                    transition={prefersReducedMotion ? { duration: 0.01 } : { type: "spring", stiffness: 400, damping: 15, delay: 0.1 }}
                    className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2"
                >
                    <Sparkles className="text-primary" size={24} />
                </motion.div>
                <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">
                        {t('home.title')}
                    </span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xs mx-auto">
                    {t('home.subtitle')}
                </p>
            </motion.div>

            {/* Crisis Mode Button */}
            <motion.div
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0.01 } : { delay: 0.2, duration: 0.5 }}
                className="px-1"
            >
                <Link
                    to="/crisis"
                    aria-label={t('home.crisisMode.ariaLabel')}
                    className="group relative overflow-hidden liquid-glass-red p-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black"
                >
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-full motion-safe:animate-pulse">
                            <Activity className="text-white" size={24} />
                        </div>
                        <div>
                            <h2 className="text-white text-lg font-bold uppercase tracking-wider">{t('home.crisisMode.title')}</h2>
                            <p className="text-red-100 text-xs font-medium">{t('home.crisisMode.subtitle')}</p>
                        </div>
                    </div>
                    <div className="relative z-10 bg-white/20 p-2 rounded-full">
                        <ArrowRight className="text-white" size={20} />
                    </div>
                </Link>
            </motion.div>

            {/* Risk Forecast Widget */}
            <div className="px-1">
                <RiskForecast />
            </div>

            <motion.div
                variants={activeContainerVariants}
                initial="hidden"
                animate="visible"
                className="grid gap-4"
            >
                <motion.div variants={activeItemVariants}>
                    <Link to="/log" className="group relative overflow-hidden liquid-glass-blue p-6 rounded-3xl shadow-lg transition-all active:scale-98 hover:shadow-primary/40 block">
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <h2 className="text-white text-2xl font-bold">{t('home.newLog.title')}</h2>
                                <p className="text-white/80 text-sm mt-1 font-medium">{t('home.newLog.subtitle')}</p>
                            </div>
                            <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                                <ArrowRight className="text-white" size={24} />
                            </div>
                        </div>
                    </Link>
                </motion.div>

                <div className="grid grid-cols-2 gap-4">
                    <motion.div variants={activeItemVariants}>
                        <Link to="/dashboard" className="liquid-glass-card p-5 rounded-3xl hover:bg-white/10 transition-colors active:scale-98 block h-full">
                            <div className="bg-teal-500/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                                <Activity className="text-teal-500" size={24} />
                            </div>
                            <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('home.dashboard.title')}</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">{t('home.dashboard.subtitle')}</p>
                        </Link>
                    </motion.div>

                    <motion.div variants={activeItemVariants}>
                        <Link to="/analysis" className="liquid-glass-card p-5 rounded-3xl hover:bg-white/10 transition-colors active:scale-98 block h-full">
                            <div className="bg-purple-500/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                                <Brain className="text-purple-500" size={24} />
                            </div>
                            <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('home.analysis.title')}</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">{t('home.analysis.subtitle')}</p>
                        </Link>
                    </motion.div>

                    <motion.div variants={activeItemVariants}>
                        <Link to="/behavior-insights" className="liquid-glass-card p-5 rounded-3xl hover:bg-white/10 transition-colors active:scale-98 block h-full">
                            <div className="bg-orange-500/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                                <Sparkles className="text-orange-500" size={24} />
                            </div>
                            <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('home.behavior.title')}</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">{t('home.behavior.subtitle')}</p>
                        </Link>
                    </motion.div>

                    <motion.div variants={activeItemVariants}>
                        <Link to="/sensory-profile" className="liquid-glass-card p-5 rounded-3xl hover:bg-white/10 transition-colors active:scale-98 block h-full">
                            <div className="bg-blue-500/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                                <Activity className="text-blue-500" size={24} />
                            </div>
                            <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('home.senses.title')}</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">{t('home.senses.subtitle')}</p>
                        </Link>
                    </motion.div>

                    <motion.div variants={activeItemVariants}>
                        <Link to="/heatmap" className="liquid-glass-card p-5 rounded-3xl hover:bg-white/10 transition-colors active:scale-98 block h-full">
                            <div className="bg-rose-500/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                                <Grid3X3 className="text-rose-500" size={24} />
                            </div>
                            <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('home.heatmap.title')}</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">{t('home.heatmap.subtitle')}</p>
                        </Link>
                    </motion.div>

                    <motion.div variants={activeItemVariants}>
                        <Link to="/energy-regulation" className="liquid-glass-card p-5 rounded-3xl hover:bg-white/10 transition-colors active:scale-98 block h-full">
                            <div className="bg-green-500/10 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                                <Activity className="text-green-500" size={24} />
                            </div>
                            <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('home.energy.title')}</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-medium">{t('home.energy.subtitle')}</p>
                        </Link>
                    </motion.div>

                    <motion.div variants={activeItemVariants} className="col-span-2">
                        <Link to="/reports" className="liquid-glass-card p-5 rounded-3xl hover:bg-white/10 transition-colors active:scale-98 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-slate-500/10 w-12 h-12 rounded-2xl flex items-center justify-center">
                                    <Activity className="text-slate-500" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('home.reports.title')}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">{t('home.reports.subtitle')}</p>
                                </div>
                            </div>
                            <ArrowRight className="text-slate-400" size={20} />
                        </Link>
                    </motion.div>

                    <motion.div variants={activeItemVariants} className="col-span-2">
                        <Link to="/schedule" className="liquid-glass-card p-5 rounded-3xl hover:bg-white/10 transition-colors active:scale-98 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-teal-500/10 w-12 h-12 rounded-2xl flex items-center justify-center">
                                    <Clock className="text-teal-500" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('home.schedule.title')}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">{t('home.schedule.subtitle')}</p>
                                </div>
                            </div>
                            <ArrowRight className="text-slate-400" size={20} />
                        </Link>
                    </motion.div>

                    <motion.div variants={activeItemVariants} className="col-span-2">
                        <Link to="/goals" className="liquid-glass-card p-5 rounded-3xl hover:bg-white/10 transition-colors active:scale-98 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-indigo-500/10 w-12 h-12 rounded-2xl flex items-center justify-center">
                                    <Activity className="text-indigo-500" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('home.goals.title')}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">{t('home.goals.subtitle')}</p>
                                </div>
                            </div>
                            <ArrowRight className="text-slate-400" size={20} />
                        </Link>
                    </motion.div>

                    {/* New Transition Insights Card */}
                    <motion.div variants={activeItemVariants} className="col-span-2">
                        <Link to="/transitions" className="liquid-glass-card p-5 rounded-3xl hover:bg-white/10 transition-colors active:scale-98 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-indigo-500/10 w-12 h-12 rounded-2xl flex items-center justify-center">
                                    <ArrowRightLeft className="text-indigo-500" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('home.transitions.title')}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">{t('home.transitions.subtitle')}</p>
                                </div>
                            </div>
                            <ArrowRight className="text-slate-400" size={20} />
                        </Link>
                    </motion.div>

                    {/* Settings */}
                    <motion.div variants={activeItemVariants} className="col-span-2">
                        <Link to="/settings" className="liquid-glass-card p-5 rounded-3xl hover:bg-white/10 transition-colors active:scale-98 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-slate-500/10 w-12 h-12 rounded-2xl flex items-center justify-center">
                                    <Settings className="text-slate-400" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('home.settings.title')}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">{t('home.settings.subtitle')}</p>
                                </div>
                            </div>
                            <ArrowRight className="text-slate-400" size={20} />
                        </Link>
                    </motion.div>

                    {/* Dev Tools - Mock Data (Development only) */}
                    {import.meta.env.DEV && (
                        <motion.div variants={activeItemVariants} className="col-span-2 mt-4">
                            <div className="liquid-glass-card p-4 rounded-2xl">
                                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-3 uppercase tracking-wider">{t('home.devTools.title')}</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleLoadMockData}
                                        className="flex-1 flex items-center justify-center gap-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl py-3 px-4 transition-colors text-sm font-medium shadow-md"
                                    >
                                        {mockDataLoaded ? (
                                            <>
                                                <Check size={16} />
                                                {t('home.devTools.loaded')}
                                            </>
                                        ) : (
                                            <>
                                                <Database size={16} />
                                                {t('home.devTools.loadData')}
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={handleClearMockData}
                                        className="flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-xl py-3 px-4 transition-colors text-sm font-medium shadow-md"
                                    >
                                        {mockDataCleared ? (
                                            <Check size={16} />
                                        ) : (
                                            <Trash2 size={16} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </motion.div>
            </main>
        </div>
    );
};

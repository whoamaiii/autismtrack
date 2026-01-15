import React, { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Brain, Activity, Settings, Clock, Database, Check,
    Trash2, ArrowRightLeft, Sparkles, ArrowRight, Grid3X3,
    Globe, X, Eye, FileText, Target, Ear
} from 'lucide-react';

import { motion, useReducedMotion } from 'framer-motion';
// Note: generateMockData is now dynamically imported for bundle optimization
import { useSettings, useLogs, useCrisis, useChildProfile } from '../store';
import { RiskForecast } from './RiskForecast';
import { SimpleInsights } from './SimpleInsights';
import { CollapsibleSection } from './CollapsibleSection';
import { AnimatedLogo } from './AnimatedLogo';
import { useTranslation } from 'react-i18next';
import { useToast } from './Toast';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.04,
            delayChildren: 0.1
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
    hidden: { opacity: 0, y: 12 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring" as const, stiffness: 400, damping: 28 }
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
    const { logs } = useLogs();
    const { crisisEvents } = useCrisis();
    const { childProfile } = useChildProfile();
    const { t, i18n } = useTranslation();
    const { showSuccess } = useToast();
    const prefersReducedMotion = useReducedMotion();
    const mainRef = useRef<HTMLElement>(null);
    const [mockDataLoaded, setMockDataLoaded] = useState(false);
    const [mockDataCleared, setMockDataCleared] = useState(false);
    // Dev tools visibility - can be hidden even in dev mode for QA/demo purposes
    const [devToolsHidden, setDevToolsHidden] = useState(() => {
        return localStorage.getItem('kreativium_hideDevTools') === 'true';
    });
    const showDevTools = import.meta.env.DEV && !devToolsHidden;

    const handleHideDevTools = () => {
        localStorage.setItem('kreativium_hideDevTools', 'true');
        setDevToolsHidden(true);
    };

    const handleShowDevTools = () => {
        localStorage.removeItem('kreativium_hideDevTools');
        setDevToolsHidden(false);
    };

    // Select motion-safe variants based on user preference
    const activeContainerVariants = prefersReducedMotion ? containerVariantsReduced : containerVariants;
    const activeItemVariants = prefersReducedMotion ? itemVariantsReduced : itemVariants;

    // Get today's logs for SimpleInsights
    const todaysLogs = useMemo(() => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        return logs.filter(log => new Date(log.timestamp) >= startOfDay);
    }, [logs]);

    // Get recent crisis events (last 7 days)
    const recentCrisisEvents = useMemo(() => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return crisisEvents.filter(e => new Date(e.timestamp) >= sevenDaysAgo);
    }, [crisisEvents]);

    const handleLoadMockData = async () => {
        // Dynamic import for bundle optimization - demo data only loaded when needed
        const { loadMockData } = await import('../utils/generateMockData');
        loadMockData();
        setMockDataLoaded(true);
        setMockDataCleared(false);
        refreshData();
        showSuccess(t('home.mockDataLoaded', 'Test data loaded successfully'));
        setTimeout(() => setMockDataLoaded(false), 2000);
    };

    const handleClearMockData = async () => {
        // Dynamic import for bundle optimization
        const { clearMockData } = await import('../utils/generateMockData');
        clearMockData();
        setMockDataCleared(true);
        setMockDataLoaded(false);
        refreshData();
        showSuccess(t('home.mockDataCleared', 'Test data cleared'));
        setTimeout(() => setMockDataCleared(false), 2000);
    };

    const toggleLanguage = () => {
        i18n.changeLanguage(i18n.language === 'no' ? 'en' : 'no');
    };

    return (
        <div className="flex flex-col gap-2 pt-0 pb-28 relative">
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

            <main
                ref={mainRef}
                id="main-content"
                tabIndex={-1}
                className="focus:outline-none"
            >
                {/* Logo Area - Compact header with settings and language toggle */}
                <motion.div
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.25, ease: "easeOut" }}
                    className="text-center relative"
                >
                    {/* Settings - top left */}
                    <Link
                        to="/settings"
                        className="absolute top-2 left-0 z-50 p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center backdrop-blur-sm"
                        aria-label={t('navigation.settings')}
                    >
                        <Settings className="text-slate-400 dark:text-slate-300" size={20} aria-hidden="true" />
                    </Link>

                    {/* Language toggle - top right */}
                    <button
                        onClick={toggleLanguage}
                        className="absolute top-2 right-0 z-50 p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center backdrop-blur-sm"
                        aria-label={t('home.switchLanguage')}
                    >
                        <Globe className="text-slate-400 dark:text-slate-300" size={20} aria-hidden="true" />
                    </button>

                    <div className="flex items-center justify-center -mb-4">
                        <AnimatedLogo
                            width="100%"
                            showBackground={true}
                            isAnimating={!prefersReducedMotion}
                            className="w-full"
                        />
                    </div>
                </motion.div>

                {/* Primary Action - New Log (Above fold for easy access) */}
                <motion.div
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.05, duration: 0.25 }}
                    className="px-1"
                >
                    <Link to="/log" className="group relative overflow-hidden liquid-glass-card p-5 rounded-2xl shadow-lg transition-all active:scale-98 hover:shadow-cyan-500/30 block border border-cyan-500/30">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="bg-cyan-500/20 p-3 rounded-full">
                                    <Sparkles className="text-cyan-400" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-white text-xl font-bold">{t('home.newLog.title')}</h2>
                                    <p className="text-slate-400 text-sm mt-0.5">{t('home.newLog.subtitle')}</p>
                                </div>
                            </div>
                            <div className="bg-white/10 p-2.5 rounded-full group-hover:bg-white/20 transition-colors" aria-hidden="true">
                                <ArrowRight className="text-slate-300" size={20} />
                            </div>
                        </div>
                    </Link>
                </motion.div>

                {/* Crisis Mode Button - Enhanced with clearer text */}
                <motion.div
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.08, duration: 0.25 }}
                    className="px-1"
                >
                    <Link
                        to="/crisis"
                        aria-label={t('home.crisisMode.ariaLabel')}
                        className="group relative overflow-hidden liquid-glass-red p-4 rounded-2xl shadow-lg shadow-red-500/30 transition-all active:scale-95 flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black border border-red-400/30"
                    >
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
                        <div className="relative z-10 flex items-center gap-3">
                            <div className="bg-white/25 p-2.5 rounded-full shadow-lg shadow-red-500/20">
                                <Activity className="text-white motion-safe:animate-pulse" size={24} />
                            </div>
                            <div>
                                <h2 className="text-white text-lg font-bold uppercase tracking-wider">{t('home.crisisMode.title')}</h2>
                                <p className="text-red-100 text-sm font-medium">{t('home.crisisMode.subtitle')}</p>
                            </div>
                        </div>
                        <div className="relative z-10 bg-white/25 p-2.5 rounded-full group-hover:bg-white/35 transition-colors" aria-label="Start crisis mode">
                            <ArrowRight className="text-white" size={20} />
                        </div>
                    </Link>
                </motion.div>

                {/* Risk Forecast Widget */}
                <div className="px-1">
                    <RiskForecast />
                </div>

                {/* Simple Insights - Quick status overview for parents */}
                <div className="px-1">
                    <SimpleInsights
                        logs={todaysLogs}
                        recentCrisisEvents={recentCrisisEvents}
                        childName={childProfile?.name}
                    />
                </div>

                <motion.div
                    variants={activeContainerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                >
                    {/* Insights Section - Expanded by default */}
                    <CollapsibleSection
                        title={t('home.sections.insights', 'Insights')}
                        defaultExpanded={true}
                        itemCount={4}
                    >
                        <div className="grid grid-cols-2 gap-3">
                            <motion.div variants={activeItemVariants}>
                                <Link to="/dashboard" className="liquid-glass-card p-4 rounded-2xl hover:bg-white/10 transition-colors active:scale-98 block h-full">
                                    <div className="bg-teal-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                                        <Activity className="text-teal-500" size={20} />
                                    </div>
                                    <h3 className="text-slate-900 dark:text-white font-bold">{t('home.dashboard.title')}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{t('home.dashboard.subtitle')}</p>
                                </Link>
                            </motion.div>

                            <motion.div variants={activeItemVariants}>
                                <Link to="/analysis" className="liquid-glass-card p-4 rounded-2xl hover:bg-white/10 transition-colors active:scale-98 block h-full">
                                    <div className="bg-purple-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                                        <Brain className="text-purple-500" size={20} />
                                    </div>
                                    <h3 className="text-slate-900 dark:text-white font-bold">{t('home.analysis.title')}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{t('home.analysis.subtitle')}</p>
                                </Link>
                            </motion.div>

                            <motion.div variants={activeItemVariants}>
                                <Link to="/behavior-insights" className="liquid-glass-card p-4 rounded-2xl hover:bg-white/10 transition-colors active:scale-98 block h-full">
                                    <div className="bg-orange-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                                        <Sparkles className="text-orange-500" size={20} />
                                    </div>
                                    <h3 className="text-slate-900 dark:text-white font-bold">{t('home.behavior.title')}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{t('home.behavior.subtitle')}</p>
                                </Link>
                            </motion.div>

                            <motion.div variants={activeItemVariants}>
                                <Link to="/sensory-profile" className="liquid-glass-card p-4 rounded-2xl hover:bg-white/10 transition-colors active:scale-98 block h-full">
                                    <div className="bg-pink-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                                        <Ear className="text-pink-500" size={20} />
                                    </div>
                                    <h3 className="text-slate-900 dark:text-white font-bold">{t('home.sensory.title')}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{t('home.sensory.subtitle')}</p>
                                </Link>
                            </motion.div>
                        </div>
                    </CollapsibleSection>

                    {/* Tracking Tools Section - Collapsed by default */}
                    <CollapsibleSection
                        title={t('home.sections.tracking', 'Tracking Tools')}
                        defaultExpanded={false}
                        itemCount={3}
                    >
                        <div className="grid grid-cols-3 gap-3">
                            <Link to="/sensory-profile" className="liquid-glass-card p-4 rounded-2xl hover:bg-white/10 transition-colors active:scale-98 block h-full text-center">
                                <div className="bg-blue-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-2 mx-auto">
                                    <Activity className="text-blue-500" size={20} />
                                </div>
                                <h3 className="text-slate-900 dark:text-white font-bold text-sm">{t('home.senses.title')}</h3>
                            </Link>

                            <Link to="/heatmap" className="liquid-glass-card p-4 rounded-2xl hover:bg-white/10 transition-colors active:scale-98 block h-full text-center">
                                <div className="bg-rose-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-2 mx-auto">
                                    <Grid3X3 className="text-rose-500" size={20} />
                                </div>
                                <h3 className="text-slate-900 dark:text-white font-bold text-sm">{t('home.heatmap.title')}</h3>
                            </Link>

                            <Link to="/energy-regulation" className="liquid-glass-card p-4 rounded-2xl hover:bg-white/10 transition-colors active:scale-98 block h-full text-center">
                                <div className="bg-green-500/10 w-10 h-10 rounded-xl flex items-center justify-center mb-2 mx-auto">
                                    <Activity className="text-green-500" size={20} />
                                </div>
                                <h3 className="text-slate-900 dark:text-white font-bold text-sm">{t('home.energy.title')}</h3>
                            </Link>
                        </div>
                    </CollapsibleSection>

                    {/* Planning Section - Collapsed by default */}
                    <CollapsibleSection
                        title={t('home.sections.planning', 'Planning')}
                        defaultExpanded={false}
                        itemCount={3}
                    >
                        <div className="space-y-2">
                            <Link to="/schedule" className="liquid-glass-card p-4 rounded-2xl hover:bg-white/10 transition-colors active:scale-98 flex items-center gap-4">
                                <div className="bg-teal-500/10 w-10 h-10 rounded-xl flex items-center justify-center">
                                    <Clock className="text-teal-500" size={20} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-slate-900 dark:text-white font-bold">{t('home.schedule.title')}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs">{t('home.schedule.subtitle')}</p>
                                </div>
                                <ArrowRight className="text-slate-400" size={18} />
                            </Link>

                            <Link to="/goals" className="liquid-glass-card p-4 rounded-2xl hover:bg-white/10 transition-colors active:scale-98 flex items-center gap-4">
                                <div className="bg-indigo-500/10 w-10 h-10 rounded-xl flex items-center justify-center">
                                    <Target className="text-indigo-500" size={20} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-slate-900 dark:text-white font-bold">{t('home.goals.title')}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs">{t('home.goals.subtitle')}</p>
                                </div>
                                <ArrowRight className="text-slate-400" size={18} />
                            </Link>

                            <Link to="/transitions" className="liquid-glass-card p-4 rounded-2xl hover:bg-white/10 transition-colors active:scale-98 flex items-center gap-4">
                                <div className="bg-violet-500/10 w-10 h-10 rounded-xl flex items-center justify-center">
                                    <ArrowRightLeft className="text-violet-500" size={20} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-slate-900 dark:text-white font-bold">{t('home.transitions.title')}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs">{t('home.transitions.subtitle')}</p>
                                </div>
                                <ArrowRight className="text-slate-400" size={18} />
                            </Link>
                        </div>
                    </CollapsibleSection>

                    {/* Utilities Section - Collapsed by default */}
                    <CollapsibleSection
                        title={t('home.sections.more', 'More')}
                        defaultExpanded={false}
                        itemCount={2}
                    >
                        <div className="space-y-2">
                            <Link to="/reports" className="liquid-glass-card p-4 rounded-2xl hover:bg-white/10 transition-colors active:scale-98 flex items-center gap-4">
                                <div className="bg-slate-500/10 w-10 h-10 rounded-xl flex items-center justify-center">
                                    <FileText className="text-slate-400" size={20} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-slate-900 dark:text-white font-bold">{t('home.reports.title')}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs">{t('home.reports.subtitle')}</p>
                                </div>
                                <ArrowRight className="text-slate-400" size={18} />
                            </Link>

                            <Link to="/settings" className="liquid-glass-card p-4 rounded-2xl hover:bg-white/10 transition-colors active:scale-98 flex items-center gap-4">
                                <div className="bg-slate-500/10 w-10 h-10 rounded-xl flex items-center justify-center">
                                    <Settings className="text-slate-400" size={20} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-slate-900 dark:text-white font-bold">{t('home.settings.title')}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs">{t('home.settings.subtitle')}</p>
                                </div>
                                <ArrowRight className="text-slate-400" size={18} />
                            </Link>
                        </div>
                    </CollapsibleSection>

                    {/* Dev Tools - Mock Data (Development only, dismissible) */}
                    {showDevTools && (
                        <motion.div variants={activeItemVariants}>
                            <div className="liquid-glass-card p-4 rounded-2xl border border-amber-500/20">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-amber-500/80 text-xs font-medium uppercase tracking-wider flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                        {t('home.devTools.title')} <span className="text-slate-500">(DEV MODE)</span>
                                    </p>
                                    <button
                                        onClick={handleHideDevTools}
                                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
                                        aria-label={t('home.devTools.hide', 'Hide dev tools')}
                                        title={t('home.devTools.hideHint', 'Hide dev tools (restore in Settings)')}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
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
                                        aria-label={t('home.devTools.clearData')}
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
                    {/* Show dev tools button when hidden */}
                    {import.meta.env.DEV && devToolsHidden && (
                        <motion.div variants={activeItemVariants}>
                            <button
                                onClick={handleShowDevTools}
                                className="w-full p-3 rounded-xl border border-dashed border-slate-600 hover:border-slate-500 text-slate-500 hover:text-slate-400 text-xs flex items-center justify-center gap-2 transition-colors"
                            >
                                <Eye size={14} />
                                {t('home.devTools.show', 'Show Developer Tools')}
                            </button>
                        </motion.div>
                    )}
                </motion.div>
            </main>
        </div>
    );
};

import React, { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Brain, Activity, Settings, Clock, Database, Check,
    Trash2, Sparkles, ArrowRight,
    X, Eye, FileText, Target, Ear
} from 'lucide-react';

import { motion, useReducedMotion } from 'framer-motion';
import { InteractiveCard } from './InteractiveCard';
// Note: generateMockData is now dynamically imported for bundle optimization
import { useSettings, useLogs, useCrisis, useChildProfile } from '../store';
import { RiskForecast } from './RiskForecast';
import { SimpleInsights } from './SimpleInsights';
import { CollapsibleSection } from './CollapsibleSection';
import { AnimatedLogo } from './AnimatedLogo';
import { useTranslation } from 'react-i18next';
import { useToast } from './Toast';
import { useSecretTapGesture } from '../hooks/useSecretTapGesture';
import { LanguageSelector } from './LanguageSelector';

// App version from package.json (Vite injects this at build time)
const APP_VERSION = '1.0.0';

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
    const { t } = useTranslation();
    const { showSuccess } = useToast();
    const prefersReducedMotion = useReducedMotion();
    const mainRef = useRef<HTMLElement>(null);
    const [mockDataLoaded, setMockDataLoaded] = useState(false);
    const [mockDataCleared, setMockDataCleared] = useState(false);
    // Dev tools visibility - can be hidden even when unlocked for demo purposes
    const [devToolsHidden, setDevToolsHidden] = useState(() => {
        return localStorage.getItem('kreativium_hideDevTools') === 'true';
    });

    // Secret tap gesture to unlock dev tools (7 taps on version number)
    const { tapCount, isUnlocked: devModeUnlocked, handleTap: handleVersionTap, resetUnlock } = useSecretTapGesture({
        onUnlock: () => {
            showSuccess(t('home.devTools.unlocked', 'Developer tools unlocked! 🎉'));
        }
    });

    // Show dev tools if: (unlocked via gesture OR in dev mode) AND not manually hidden
    const showDevTools = (devModeUnlocked || import.meta.env.DEV) && !devToolsHidden;

    const handleHideDevTools = () => {
        localStorage.setItem('kreativium_hideDevTools', 'true');
        setDevToolsHidden(true);
    };

    const handleShowDevTools = () => {
        localStorage.removeItem('kreativium_hideDevTools');
        setDevToolsHidden(false);
    };

    const handleLockDevTools = () => {
        resetUnlock();
        setDevToolsHidden(true);
        localStorage.setItem('kreativium_hideDevTools', 'true');
        showSuccess(t('home.devTools.locked', 'Developer tools locked'));
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

    return (
        <div className="flex flex-col gap-1.5 pt-0 pb-28 relative">
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

                    {/* Language selector - top right */}
                    <div className="absolute top-2 right-0 z-50">
                        <LanguageSelector compact />
                    </div>

                    <div className="flex items-center justify-center -mb-6">
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
                                <InteractiveCard
                                    to="/dashboard"
                                    title={t('home.dashboard.title')}
                                    subtitle={t('home.dashboard.subtitle')}
                                    icon={Activity}
                                    iconBgColor="bg-teal-500/10"
                                    iconColor="text-teal-500"
                                    variant="grid"
                                />
                            </motion.div>

                            <motion.div variants={activeItemVariants}>
                                <InteractiveCard
                                    to="/analysis"
                                    title={t('home.analysis.title')}
                                    subtitle={t('home.analysis.subtitle')}
                                    icon={Brain}
                                    iconBgColor="bg-purple-500/10"
                                    iconColor="text-purple-500"
                                    variant="grid"
                                />
                            </motion.div>

                            <motion.div variants={activeItemVariants}>
                                <InteractiveCard
                                    to="/behavior-insights"
                                    title={t('home.behavior.title')}
                                    subtitle={t('home.behavior.subtitle')}
                                    icon={Sparkles}
                                    iconBgColor="bg-orange-500/10"
                                    iconColor="text-orange-500"
                                    variant="grid"
                                />
                            </motion.div>

                            <motion.div variants={activeItemVariants}>
                                <InteractiveCard
                                    to="/sensory-profile"
                                    title={t('home.sensory.title')}
                                    subtitle={t('home.sensory.subtitle')}
                                    icon={Ear}
                                    iconBgColor="bg-pink-500/10"
                                    iconColor="text-pink-500"
                                    variant="grid"
                                />
                            </motion.div>
                        </div>
                    </CollapsibleSection>

                    {/* Note: Tracking Tools section removed - consolidated:
                        - /heatmap now lives in BehaviorInsights
                        - /energy-regulation data shown in Dashboard
                        - /sensory-profile accessible via Insights section */}

                    {/* Planning Section - Collapsed by default */}
                    <CollapsibleSection
                        title={t('home.sections.planning', 'Planning')}
                        defaultExpanded={false}
                        itemCount={2}
                    >
                        <div className="space-y-2">
                            <InteractiveCard
                                to="/schedule"
                                title={t('home.schedule.title')}
                                subtitle={t('home.schedule.subtitle')}
                                icon={Clock}
                                iconBgColor="bg-teal-500/10"
                                iconColor="text-teal-500"
                                variant="list"
                                showArrow
                            />

                            <InteractiveCard
                                to="/goals"
                                title={t('home.goals.title')}
                                subtitle={t('home.goals.subtitle')}
                                icon={Target}
                                iconBgColor="bg-indigo-500/10"
                                iconColor="text-indigo-500"
                                variant="list"
                                showArrow
                            />
                        </div>
                    </CollapsibleSection>

                    {/* Reports Section - Collapsed by default (Settings accessible via header icon) */}
                    <CollapsibleSection
                        title={t('home.sections.more', 'More')}
                        defaultExpanded={false}
                        itemCount={1}
                    >
                        <div className="space-y-2">
                            <InteractiveCard
                                to="/reports"
                                title={t('home.reports.title')}
                                subtitle={t('home.reports.subtitle')}
                                icon={FileText}
                                iconBgColor="bg-slate-500/10"
                                iconColor="text-slate-400"
                                variant="list"
                                showArrow
                            />
                        </div>
                    </CollapsibleSection>

                    {/* Dev Tools - Mock Data (Unlocked via 7-tap gesture or dev mode) */}
                    {showDevTools && (
                        <motion.div variants={activeItemVariants}>
                            <div className="liquid-glass-card p-4 rounded-2xl border border-amber-500/20">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-amber-500/80 text-xs font-medium uppercase tracking-wider flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                        {t('home.devTools.title')}
                                        {devModeUnlocked && !import.meta.env.DEV && (
                                            <span className="text-slate-500">(UNLOCKED)</span>
                                        )}
                                        {import.meta.env.DEV && (
                                            <span className="text-slate-500">(DEV MODE)</span>
                                        )}
                                    </p>
                                    <div className="flex gap-1">
                                        {devModeUnlocked && !import.meta.env.DEV && (
                                            <button
                                                onClick={handleLockDevTools}
                                                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-amber-500/70 hover:text-amber-500 text-xs"
                                                aria-label={t('home.devTools.lock', 'Lock dev tools')}
                                                title={t('home.devTools.lockHint', 'Lock dev tools permanently')}
                                            >
                                                🔒
                                            </button>
                                        )}
                                        <button
                                            onClick={handleHideDevTools}
                                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
                                            aria-label={t('home.devTools.hide', 'Hide dev tools')}
                                            title={t('home.devTools.hideHint', 'Hide dev tools temporarily')}
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
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
                    {/* Show dev tools button when hidden (only if already unlocked) */}
                    {(devModeUnlocked || import.meta.env.DEV) && devToolsHidden && (
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

                    {/* Version number with secret tap gesture */}
                    <motion.div
                        variants={activeItemVariants}
                        className="flex flex-col items-center justify-center pt-4 pb-2"
                    >
                        <button
                            onClick={handleVersionTap}
                            className="text-slate-600 text-xs select-none touch-manipulation relative"
                            aria-label={t('home.version', 'App version')}
                        >
                            <span className={tapCount > 0 ? 'animate-pulse' : ''}>
                                Kreativium v{APP_VERSION}
                            </span>
                            {/* Tap progress indicator */}
                            {tapCount > 0 && tapCount < 7 && (
                                <span className="absolute -right-6 top-0 text-amber-500/60 text-[10px]">
                                    {tapCount}/7
                                </span>
                            )}
                        </button>
                    </motion.div>
                </motion.div>
            </main>
        </div>
    );
};

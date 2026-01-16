import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLogs, useCrisis, useChildProfile } from '../store';
import { ArousalChart } from './ArousalChart';
import { Plus, Calendar, Battery, BrainCircuit, Sparkles, Loader2, RefreshCw, AlertCircle, Zap, SearchX } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { format } from 'date-fns';
import { nb, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { analyzeLogs, analyzeLogsDeep, analyzeLogsStreaming } from '../services/ai';
import type { AnalysisResult } from '../types';
import { useToast } from './Toast';
import { getModelDisplayName } from '../utils/modelUtils';

// Extended type for deep analysis result
interface DeepAnalysisResult extends AnalysisResult {
    modelUsed?: string;
}

export const Dashboard: React.FC = () => {
    const { logs } = useLogs();
    const { crisisEvents } = useCrisis();
    const { childProfile } = useChildProfile();
    const { showError, showSuccess } = useToast();
    const prefersReducedMotion = useReducedMotion();
    const { i18n } = useTranslation();

    // Locale-aware date formatting
    const dateLocale = i18n.language === 'no' ? nb : enUS;

    // AI Analysis state
    const [analysis, setAnalysis] = useState<DeepAnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    // Streaming state for "wow factor"
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingText, setStreamingText] = useState('');

    // Elapsed time tracking for progress indication
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const analysisStartTimeRef = useRef<number | null>(null);

    // Retry visibility state
    const [retryInfo, setRetryInfo] = useState<{ attempt: number; maxRetries: number } | null>(null);

    // Get today's logs - memoized to prevent unnecessary recalculations
    const todaysLogs = useMemo(() => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        return logs.filter(log => new Date(log.timestamp) >= startOfDay);
    }, [logs]);

    // Calculate latest energy - get most recent log by timestamp
    const latestLog = useMemo(() => {
        if (todaysLogs.length === 0) return null;
        return todaysLogs.reduce((latest, log) =>
            new Date(log.timestamp) > new Date(latest.timestamp) ? log : latest
        );
    }, [todaysLogs]);
    const currentEnergy = latestLog ? latestLog.energy : 10; // Default to full battery

    // Track if deep analysis is running
    const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);

    // Track elapsed time during analysis
    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval> | null = null;

        if (isAnalyzing || isDeepAnalyzing) {
            if (!analysisStartTimeRef.current) {
                analysisStartTimeRef.current = Date.now();
            }
            intervalId = setInterval(() => {
                const elapsed = Math.floor((Date.now() - (analysisStartTimeRef.current || Date.now())) / 1000);
                setElapsedSeconds(elapsed);
            }, 1000);
        } else {
            analysisStartTimeRef.current = null;
            setElapsedSeconds(0);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isAnalyzing, isDeepAnalyzing]);

    // NO automatic analysis - only run when user clicks button
    // This saves API costs by using cached results

    // Quick analysis (FREE - Llama 4 Maverick)
    const handleQuickAnalysis = async () => {
        if (logs.length < 3 || isAnalyzing || isDeepAnalyzing || isStreaming) return;

        setIsAnalyzing(true);
        setAnalysisError(null);
        setRetryInfo(null);

        try {
            const logsToAnalyze = logs.slice(0, 30);
            const crisisToAnalyze = crisisEvents.slice(0, 10);

            const result = await analyzeLogs(logsToAnalyze, crisisToAnalyze, {
                forceRefresh: true,
                childProfile,
                onRetry: (attempt, maxRetries) => {
                    setRetryInfo({ attempt, maxRetries });
                }
            });
            setAnalysis(result);
            showSuccess('Analyse fullført', 'AI-analyse er klar til visning');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Analyse feilet';
            if (import.meta.env.DEV) {
                console.error('Analysis failed:', error);
            }
            setAnalysisError(errorMessage);
            showError('Analyse feilet', errorMessage);
        } finally {
            setIsAnalyzing(false);
            setRetryInfo(null);
        }
    };

    // Deep analysis (PREMIUM - Gemini 2.5 Pro)
    const handleDeepAnalysis = async () => {
        if (logs.length < 3 || isAnalyzing || isDeepAnalyzing || isStreaming) return;

        setIsDeepAnalyzing(true);
        setAnalysisError(null);

        try {
            const logsToAnalyze = logs.slice(0, 50); // More logs for deep analysis
            const crisisToAnalyze = crisisEvents.slice(0, 20);

            const result = await analyzeLogsDeep(logsToAnalyze, crisisToAnalyze, { childProfile });
            setAnalysis(result);
            showSuccess('Dyp analyse fullført', 'Premium AI-analyse med detaljerte innsikter');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Dyp analyse feilet';
            if (import.meta.env.DEV) {
                console.error('Deep analysis failed:', error);
            }
            setAnalysisError(errorMessage);
            showError('Dyp analyse feilet', errorMessage);
        } finally {
            setIsDeepAnalyzing(false);
        }
    };

    // Streaming analysis - Shows AI "thinking" in real-time (WOW factor for Kaggle demo)
    const handleStreamingAnalysis = async () => {
        if (logs.length < 3 || isAnalyzing || isDeepAnalyzing || isStreaming) return;

        setIsStreaming(true);
        setStreamingText('');
        setAnalysisError(null);
        setAnalysis(null);
        setRetryInfo(null);

        try {
            const logsToAnalyze = logs.slice(0, 30);
            const crisisToAnalyze = crisisEvents.slice(0, 10);

            const result = await analyzeLogsStreaming(
                logsToAnalyze,
                crisisToAnalyze,
                {
                    onChunk: (chunk) => {
                        setStreamingText(prev => prev + chunk);
                    },
                    onComplete: () => {
                        // Streaming complete
                    },
                    onError: (error) => {
                        setAnalysisError(error.message);
                        showError('Streaming feilet', error.message);
                    },
                    onRetry: (attempt, maxRetries) => {
                        setRetryInfo({ attempt, maxRetries });
                        setStreamingText(''); // Clear for retry
                    }
                },
                { childProfile }
            );
            setAnalysis(result);
            showSuccess('Streaming analyse fullført', 'AI-analyse med sanntidsvisning');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Streaming analyse feilet';
            if (import.meta.env.DEV) {
                console.error('Streaming analysis failed:', error);
            }
            setAnalysisError(errorMessage);
            showError('Streaming analyse feilet', errorMessage);
        } finally {
            setIsStreaming(false);
            setStreamingText('');
            setRetryInfo(null);
        }
    };

    // Track if we've already attempted to load cached analysis
    const hasAttemptedCacheLoad = useRef(false);

    // Track initial mount for skeleton
    const [isInitialMount, setIsInitialMount] = useState(true);

    // Brief skeleton on initial mount for perceived performance
    useEffect(() => {
        const timer = setTimeout(() => setIsInitialMount(false), 50);
        return () => clearTimeout(timer);
    }, []);

    // Load cached analysis on mount (doesn't call API if cached)
    useEffect(() => {
        let isMounted = true;

        if (!hasAttemptedCacheLoad.current && logs.length >= 3 && !analysis) {
            hasAttemptedCacheLoad.current = true;
            // Try to get cached result without forcing refresh
            analyzeLogs(logs.slice(0, 30), crisisEvents.slice(0, 10), { childProfile })
                .then((result) => {
                    if (isMounted) {
                        setAnalysis(result);
                    }
                })
                .catch((error) => {
                    if (import.meta.env.DEV) {
                        console.warn('[Dashboard] Failed to load cached analysis:', error);
                    }
                });
        }

        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- analysis intentionally excluded to prevent re-runs after setting
    }, [logs, crisisEvents, childProfile]);

    // Skeleton loading state
    if (isInitialMount && !prefersReducedMotion) {
        return (
            <div className="flex flex-col gap-6 pb-28 animate-in fade-in duration-100">
                {/* Header skeleton */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 animate-pulse" />
                        <div className="w-24 h-6 bg-white/10 rounded animate-pulse" />
                    </div>
                    <div className="w-20 h-8 bg-white/10 rounded-full animate-pulse" />
                </div>

                {/* Arousal chart skeleton */}
                <div className="liquid-glass-card p-6 rounded-3xl mb-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="w-40 h-4 bg-white/10 rounded animate-pulse mb-2" />
                            <div className="w-20 h-8 bg-white/10 rounded animate-pulse" />
                        </div>
                        <div className="w-16 h-6 bg-white/10 rounded-full animate-pulse" />
                    </div>
                    <div className="h-48 w-full bg-white/5 rounded-xl animate-pulse" />
                </div>

                {/* Energy card skeleton */}
                <div className="liquid-glass-card p-6 rounded-3xl">
                    <div className="flex justify-between mb-4">
                        <div className="w-28 h-4 bg-white/10 rounded animate-pulse" />
                        <div className="w-14 h-4 bg-white/10 rounded animate-pulse" />
                    </div>
                    <div className="h-3 bg-white/10 rounded-full animate-pulse" />
                </div>

                {/* AI insights skeleton */}
                <div className="rounded-3xl bg-white/5 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-white/10 animate-pulse" />
                        <div className="w-24 h-5 bg-white/10 rounded animate-pulse" />
                    </div>
                    <div className="space-y-2">
                        <div className="w-full h-4 bg-white/10 rounded animate-pulse" />
                        <div className="w-3/4 h-4 bg-white/10 rounded animate-pulse" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 pb-28">
            {/* Header */}
            <motion.div
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.2 }}
                className="flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <motion.div
                        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0, rotate: -180 }}
                        animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, rotate: 0 }}
                        transition={prefersReducedMotion ? { duration: 0.01 } : { type: "spring" as const, stiffness: 400, damping: 25, delay: 0.05 }}
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20"
                    >
                        <Sparkles size={20} />
                    </motion.div>
                    <h1 className="text-slate-900 dark:text-white text-xl font-bold tracking-tight">Kreativium</h1>
                </div>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-white/5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 backdrop-blur-sm">
                    <Calendar size={16} />
                    <span className="text-sm font-medium capitalize">{format(new Date(), 'MMM d', { locale: dateLocale })}</span>
                </div>
            </motion.div>

            {/* AI Insights Card - MOVED TO TOP for above-fold visibility */}
            <motion.div
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.3, delay: 0.05 }}
                className="relative overflow-hidden rounded-3xl"
            >
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-purple-500/10 to-blue-500/20 dark:from-primary/30 dark:via-purple-500/20 dark:to-blue-500/30" />
                <div className="absolute inset-0 backdrop-blur-xl" />

                <div className="relative p-6 flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/20 dark:bg-primary/30">
                                <AnimatePresence mode="wait">
                                    {isAnalyzing ? (
                                        <motion.div
                                            key="loading"
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        >
                                            <Loader2 size={24} className="text-primary" />
                                        </motion.div>
                                    ) : analysisError ? (
                                        <AlertCircle size={24} className="text-red-400" />
                                    ) : (
                                        <motion.div
                                            key="brain"
                                            initial={{ scale: 0.8 }}
                                            animate={{ scale: 1 }}
                                        >
                                            <BrainCircuit size={24} className="text-primary" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div>
                                <h3 className="text-slate-900 dark:text-white font-bold text-lg">
                                    AI Analyse
                                    {analysis?.isDeepAnalysis && (
                                        <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                                            DYP
                                        </span>
                                    )}
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 text-xs">
                                    {analysis?.isDeepAnalysis
                                        ? getModelDisplayName(analysis.modelUsed, 'Premium')
                                        : 'Kreativium-flash7B'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Analysis Content - Compact version for top placement */}
                    {isStreaming ? (
                        <div className="py-2">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="relative">
                                    <Sparkles size={16} className="text-purple-400 animate-pulse" />
                                </div>
                                <span className="text-purple-400 text-sm font-medium">
                                    {retryInfo
                                        ? `Prøver på nytt (${retryInfo.attempt}/${retryInfo.maxRetries})...`
                                        : 'AI tenker...'}
                                </span>
                            </div>
                            <div className="bg-black/20 rounded-xl p-3 font-mono text-xs text-green-400 max-h-32 overflow-y-auto">
                                <pre className="whitespace-pre-wrap break-words">
                                    {streamingText || '▌'}
                                    <span className="animate-pulse">▌</span>
                                </pre>
                            </div>
                        </div>
                    ) : (isAnalyzing || isDeepAnalyzing) ? (
                        <div className="py-4 text-center">
                            <Loader2 size={24} className="text-primary animate-spin mx-auto mb-2" />
                            <p className="text-slate-600 dark:text-slate-300 text-sm">
                                {isDeepAnalyzing ? 'Dyp analyse...' : 'Analyserer...'}
                            </p>
                            {elapsedSeconds > 0 && (
                                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-mono">
                                    {elapsedSeconds}s
                                </p>
                            )}
                        </div>
                    ) : analysis ? (
                        <div className="space-y-3">
                            {/* Main Recommendation - Compact */}
                            {analysis.recommendations && analysis.recommendations.length > 0 && (
                                <div className="bg-white/50 dark:bg-white/5 rounded-xl p-3 border border-white/50 dark:border-white/10">
                                    <p className="text-slate-800 dark:text-white text-sm leading-relaxed">
                                        {analysis.recommendations[0]}
                                    </p>
                                </div>
                            )}

                            {/* Quick action row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <div className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
                                    <span>{logs.length} logger</span>
                                </div>
                                <Link
                                    to="/behavior-insights"
                                    className="flex items-center gap-1 text-primary text-sm font-medium hover:underline"
                                >
                                    Mer →
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="py-2">
                            <EmptyState
                                title={logs.length < 3 ? "Samle data" : "Start analyse"}
                                description={logs.length < 3
                                    ? "Logg minst 3 ganger for AI-innsikt"
                                    : "Trykk for å analysere mønstre"}
                                icon={logs.length < 3 ? SearchX : BrainCircuit}
                                actionLabel={logs.length < 3 ? "Logg" : undefined}
                                actionLink={logs.length < 3 ? "/log" : undefined}
                                compact
                            />
                        </div>
                    )}

                    {/* Analysis Buttons - Compact row */}
                    {logs.length >= 3 && !isAnalyzing && !isDeepAnalyzing && !isStreaming && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleQuickAnalysis}
                                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/50 dark:bg-white/10 hover:bg-white/70 dark:hover:bg-white/20 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200"
                            >
                                <RefreshCw size={14} />
                                Rask
                            </button>
                            <button
                                onClick={handleDeepAnalysis}
                                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 transition-colors text-sm font-medium text-white shadow-lg shadow-purple-500/25"
                            >
                                <Zap size={14} />
                                Dyp
                            </button>
                            <button
                                onClick={handleStreamingAnalysis}
                                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 transition-colors text-sm font-medium text-white shadow-lg shadow-green-500/25"
                            >
                                <Sparkles size={14} />
                                Live
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Arousal Curve Card */}
                <motion.div
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.3, delay: 0.05 }}
                    className="flex flex-col gap-4 liquid-glass-card p-6 rounded-3xl"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-slate-500 dark:text-slate-400 font-medium text-sm uppercase tracking-wider">Dagens Spenningskurve</h2>
                            <p className="text-slate-900 dark:text-white text-3xl font-bold mt-1">
                                {latestLog ? (latestLog.arousal <= 3 ? 'Rolig' : latestLog.arousal <= 7 ? 'Økt' : 'Høy') : 'Ingen Data'}
                            </p>
                        </div>
                        {latestLog && (
                            <motion.div
                                initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0 }}
                                animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1 }}
                                transition={prefersReducedMotion ? { duration: 0.01 } : { type: "spring" as const, stiffness: 500, damping: 20, delay: 0.15 }}
                                className={`px-3 py-1 rounded-full text-sm font-bold ${latestLog.arousal <= 3 ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                                    latestLog.arousal <= 7 ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                                        'bg-red-500/20 text-red-600 dark:text-red-400'
                                    }`}
                                aria-label={`Spenningsnivå ${latestLog.arousal} av 10, ${latestLog.arousal <= 3 ? 'rolig' :
                                    latestLog.arousal <= 7 ? 'økt' : 'høy'
                                    }`}
                                role="status"
                            >
                                Nivå {latestLog.arousal}
                            </motion.div>
                        )}
                    </div>

                    <div className="h-48 w-full mt-2">
                        <ArousalChart logs={todaysLogs} />
                    </div>
                </motion.div>

                {/* Energy Card */}
                <motion.div
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.3, delay: 0.1 }}
                    className="liquid-glass-card p-6 rounded-3xl flex flex-col gap-4"
                >
                    <div className="flex justify-between items-center">
                        <h3 className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                            <Battery size={18} /> Daglig Energi
                        </h3>
                        <span className="text-slate-900 dark:text-white font-bold">{currentEnergy} / 10</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700/30 rounded-full h-3 overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${currentEnergy * 10}%` }}
                            transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.5, delay: 0.15, ease: "easeOut" }}
                            className="bg-gradient-to-r from-primary to-blue-400 h-3 rounded-full"
                        />
                    </div>
                    <p className="text-slate-400 text-sm">Energi Igjen</p>
                </motion.div>
            </div>

            {/* Floating Action Button */}
            <motion.div
                initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1 }}
                transition={prefersReducedMotion ? { duration: 0.01 } : { type: "spring", stiffness: 500, damping: 20, delay: 0.2 }}
                className="fixed bottom-24 right-6 z-40 md:hidden"
            >
                <Link
                    to="/log"
                    className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-full w-14 h-14 shadow-lg shadow-primary/30 transition-transform active:scale-95"
                    aria-label="Ny logg"
                >
                    <Plus size={24} />
                </Link>
            </motion.div>
        </div>
    );
};

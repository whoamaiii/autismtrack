import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useLogs, useCrisis } from '../store';
import { ArousalChart } from './ArousalChart';
import { Plus, Calendar, Battery, BrainCircuit, Sparkles, Loader2, RefreshCw, AlertCircle, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeLogs, analyzeLogsDeep, analyzeLogsStreaming } from '../services/ai';
import type { AnalysisResult } from '../types';

// Extended type for deep analysis result
interface DeepAnalysisResult extends AnalysisResult {
    modelUsed?: string;
}

export const Dashboard: React.FC = () => {
    const { logs } = useLogs();
    const { crisisEvents } = useCrisis();

    // AI Analysis state
    const [analysis, setAnalysis] = useState<DeepAnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    // Streaming state for "wow factor"
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingText, setStreamingText] = useState('');

    // Get today's logs (avoiding date mutation)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todaysLogs = logs.filter(log => new Date(log.timestamp) >= startOfDay);

    // Calculate latest energy
    const latestLog = todaysLogs.length > 0 ? todaysLogs[todaysLogs.length - 1] : null;
    const currentEnergy = latestLog ? latestLog.energy : 10; // Default to full battery

    // Track if deep analysis is running
    const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);

    // NO automatic analysis - only run when user clicks button
    // This saves API costs by using cached results

    // Quick analysis (FREE - Llama 4 Maverick)
    const handleQuickAnalysis = async () => {
        if (logs.length < 3 || isAnalyzing || isDeepAnalyzing) return;

        setIsAnalyzing(true);
        setAnalysisError(null);

        try {
            const logsToAnalyze = logs.slice(0, 30);
            const crisisToAnalyze = crisisEvents.slice(0, 10);

            const result = await analyzeLogs(logsToAnalyze, crisisToAnalyze, { forceRefresh: true });
            setAnalysis(result);
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Analysis failed:', error);
            }
            setAnalysisError(error instanceof Error ? error.message : 'Analyse feilet');
        } finally {
            setIsAnalyzing(false);
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

            const result = await analyzeLogsDeep(logsToAnalyze, crisisToAnalyze);
            setAnalysis(result);
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Deep analysis failed:', error);
            }
            setAnalysisError(error instanceof Error ? error.message : 'Dyp analyse feilet');
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
                    }
                }
            );
            setAnalysis(result);
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Streaming analysis failed:', error);
            }
            setAnalysisError(error instanceof Error ? error.message : 'Streaming analyse feilet');
        } finally {
            setIsStreaming(false);
            setStreamingText('');
        }
    };

    // Track if we've already attempted to load cached analysis
    const hasAttemptedCacheLoad = useRef(false);

    // Load cached analysis on mount (doesn't call API if cached)
    useEffect(() => {
        if (hasAttemptedCacheLoad.current) return;
        if (logs.length >= 3 && !analysis) {
            hasAttemptedCacheLoad.current = true;
            let isMounted = true;
            // Try to get cached result without forcing refresh
            analyzeLogs(logs.slice(0, 30), crisisEvents.slice(0, 10))
                .then((result) => {
                    if (isMounted) {
                        setAnalysis(result);
                    }
                })
                .catch(() => { /* Ignore - user can manually trigger */ });
            return () => {
                isMounted = false;
            };
        }
    }, [logs, crisisEvents, analysis]);

    return (
        <div className="flex flex-col gap-6 pb-24">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex items-center justify-between mb-8"
            >
                <div className="flex items-center gap-3">
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring" as const, stiffness: 300, damping: 20, delay: 0.1 }}
                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20"
                    >
                        <Sparkles size={20} />
                    </motion.div>
                    <h1 className="text-slate-900 dark:text-white text-xl font-bold tracking-tight">Kreativium</h1>
                </div>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-white/5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 backdrop-blur-sm">
                    <Calendar size={16} />
                    <span className="text-sm font-medium capitalize">{format(new Date(), 'MMM d', { locale: nb })}</span>
                </div>
            </motion.div>

            {/* Arousal Curve Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="flex flex-col gap-4 liquid-glass-card p-6 rounded-3xl mb-6"
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
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring" as const, stiffness: 400, damping: 15, delay: 0.3 }}
                            className={`px-3 py-1 rounded-full text-sm font-bold ${latestLog.arousal <= 3 ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                                latestLog.arousal <= 7 ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                                    'bg-red-500/20 text-red-600 dark:text-red-400'
                                }`}>
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
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
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
                        transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                        className="bg-gradient-to-r from-primary to-blue-400 h-3 rounded-full"
                    />
                </div>
                <p className="text-slate-400 text-sm">Energi Igjen</p>
            </motion.div>

            {/* AI Insights Card - Full Width, Enhanced */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
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
                                        ? (analysis.modelUsed?.split('/')[1] || 'Premium')
                                        : 'Gemini Flash (billig)'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Analysis Content */}
                    {isStreaming ? (
                        <div className="py-4">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="relative">
                                    <Sparkles size={20} className="text-purple-400 animate-pulse" />
                                    <div className="absolute inset-0 bg-purple-400/30 blur-lg animate-pulse" />
                                </div>
                                <span className="text-purple-400 text-sm font-medium">AI tenker i sanntid...</span>
                            </div>
                            <div className="bg-black/20 rounded-xl p-4 font-mono text-sm text-green-400 max-h-48 overflow-y-auto">
                                <pre className="whitespace-pre-wrap break-words">
                                    {streamingText || '▌'}
                                    <span className="animate-pulse">▌</span>
                                </pre>
                            </div>
                            <p className="text-slate-500 text-xs mt-2 text-center">
                                Gemini 3 Pro streaming respons
                            </p>
                        </div>
                    ) : (isAnalyzing || isDeepAnalyzing) ? (
                        <div className="py-6 text-center">
                            <Loader2 size={32} className="text-primary animate-spin mx-auto mb-3" />
                            <p className="text-slate-600 dark:text-slate-300 text-sm">
                                {isDeepAnalyzing ? 'Kjører dyp analyse...' : 'Analyserer logger...'}
                            </p>
                            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                                {isDeepAnalyzing ? 'Dette kan ta opptil 30 sekunder' : 'Bruker gratis modell'}
                            </p>
                        </div>
                    ) : analysis ? (
                        <div className="space-y-4">
                            {/* Main Recommendation */}
                            {analysis.recommendations && analysis.recommendations.length > 0 && (
                                <div className="bg-white/50 dark:bg-white/5 rounded-2xl p-4 border border-white/50 dark:border-white/10">
                                    <p className="text-xs font-medium text-primary uppercase tracking-wider mb-2">
                                        Hovedanbefaling
                                    </p>
                                    <p className="text-slate-800 dark:text-white text-base leading-relaxed">
                                        {analysis.recommendations[0]}
                                    </p>
                                </div>
                            )}

                            {/* Additional Insights */}
                            {analysis.recommendations && analysis.recommendations.length > 1 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Flere innsikter
                                    </p>
                                    <ul className="space-y-2">
                                        {analysis.recommendations.slice(1, 3).map((rec, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                <span className="text-primary mt-0.5">•</span>
                                                <span>{rec}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Status and Link */}
                            <div className="flex items-center justify-between pt-3 border-t border-white/30 dark:border-white/10">
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span>
                                        {logs.length} logger
                                        {crisisEvents.length > 0 && ` • ${crisisEvents.length} kriser`}
                                    </span>
                                </div>
                                <Link
                                    to="/behavior-insights"
                                    className="flex items-center gap-1 text-primary text-sm font-medium hover:underline"
                                >
                                    Full analyse
                                    <span>→</span>
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="py-4 text-center">
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">
                                {analysisError || (logs.length < 3 ? 'Trenger minst 3 logger for analyse.' : 'Klikk en knapp for å starte analyse.')}
                            </p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    {logs.length >= 3 && !isAnalyzing && !isDeepAnalyzing && !isStreaming && (
                        <div className="flex flex-col gap-2 pt-2">
                            <div className="flex gap-2">
                                <button
                                    onClick={handleQuickAnalysis}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/50 dark:bg-white/10 hover:bg-white/70 dark:hover:bg-white/20 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200"
                                >
                                    <RefreshCw size={16} />
                                    Rask
                                </button>
                                <button
                                    onClick={handleDeepAnalysis}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 transition-colors text-sm font-medium text-white shadow-lg shadow-purple-500/25"
                                >
                                    <Zap size={16} />
                                    Dyp
                                </button>
                            </div>
                            {/* Streaming button - WOW factor for Kaggle demo */}
                            <button
                                onClick={handleStreamingAnalysis}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:from-green-600 hover:via-emerald-600 hover:to-teal-600 transition-colors text-sm font-medium text-white shadow-lg shadow-green-500/25 relative overflow-hidden group"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                <Sparkles size={16} className="animate-pulse" />
                                Live Streaming Analyse
                                <span className="text-xs opacity-75">(Gemini 3)</span>
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Floating Action Button */}
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" as const, stiffness: 400, damping: 15, delay: 0.5 }}
                className="fixed bottom-24 right-6 z-40 md:hidden"
            >
                <Link
                    to="/log"
                    className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-full w-14 h-14 shadow-lg shadow-primary/30 transition-transform active:scale-95"
                >
                    <Plus size={24} />
                </Link>
            </motion.div>
        </div>
    );
};

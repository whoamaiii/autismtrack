import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, AlertTriangle, Brain, Calendar, Loader2, RefreshCw, TrendingUp, Shield, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLogs, useCrisis, useChildProfile } from '../store';
import { analyzeLogs, analyzeLogsDeep } from '../services/ai';
import type { AnalysisResult, LogEntry } from '../types';

// Helper to calculate strategy effectiveness from logs
const calculateStrategyEffectiveness = (logs: LogEntry[]) => {
    const strategies: Record<string, { success: number; noChange: number; escalated: number; total: number }> = {};

    logs.forEach(log => {
        log.strategies.forEach(strategy => {
            if (!strategies[strategy]) {
                strategies[strategy] = { success: 0, noChange: 0, escalated: 0, total: 0 };
            }
            strategies[strategy].total++;

            if (log.strategyEffectiveness === 'helped') {
                strategies[strategy].success++;
            } else if (log.strategyEffectiveness === 'no_change') {
                strategies[strategy].noChange++;
            } else if (log.strategyEffectiveness === 'escalated') {
                strategies[strategy].escalated++;
            }
        });
    });

    // Convert to percentages and sort by total usage
    return Object.entries(strategies)
        .map(([name, data]) => ({
            name,
            successRate: data.total > 0 ? Math.round((data.success / data.total) * 100) : 0,
            noChangeRate: data.total > 0 ? Math.round((data.noChange / data.total) * 100) : 0,
            escalatedRate: data.total > 0 ? Math.round((data.escalated / data.total) * 100) : 0,
            total: data.total
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5); // Top 5 strategies
};

// Helper to build heatmap data
const buildHeatmapData = (logs: LogEntry[]) => {
    const heatmap: Record<string, Record<string, number[]>> = {
        morning: { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] },
        midday: { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] },
        afternoon: { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] },
        evening: { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] }
    };

    logs.forEach(log => {
        if (log.timeOfDay && log.dayOfWeek) {
            const timeKey = log.timeOfDay === 'night' ? 'evening' : log.timeOfDay;
            if (heatmap[timeKey] && heatmap[timeKey][log.dayOfWeek]) {
                heatmap[timeKey][log.dayOfWeek].push(log.arousal);
            }
        }
    });

    // Calculate averages
    const result: Record<string, Record<string, number>> = {};
    Object.entries(heatmap).forEach(([time, days]) => {
        result[time] = {};
        Object.entries(days).forEach(([day, values]) => {
            result[time][day] = values.length > 0
                ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
                : 0;
        });
    });

    return result;
};

// Helper to get color class based on arousal level
const getHeatmapColor = (level: number): string => {
    if (level === 0) return 'bg-slate-700/30';
    if (level <= 3) return 'bg-green-500/30';
    if (level <= 5) return 'bg-yellow-500/40';
    if (level <= 7) return 'bg-orange-500/60';
    return 'bg-red-500/70';
};

export const BehaviorInsights: React.FC = () => {
    const navigate = useNavigate();
    const { logs } = useLogs();
    const { crisisEvents } = useCrisis();
    const { childProfile } = useChildProfile();

    // Analysis state
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [dateRange, setDateRange] = useState<'7' | '30' | '90'>('30');

    // Filter logs by date range
    const filteredLogs = useMemo(() => {
        const now = new Date();
        const daysAgo = parseInt(dateRange);
        const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        return logs.filter(log => new Date(log.timestamp) >= startDate);
    }, [logs, dateRange]);

    const filteredCrisis = useMemo(() => {
        const now = new Date();
        const daysAgo = parseInt(dateRange);
        const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        return crisisEvents.filter(event => new Date(event.timestamp) >= startDate);
    }, [crisisEvents, dateRange]);

    // Calculate derived data
    const strategyData = useMemo(() => calculateStrategyEffectiveness(filteredLogs), [filteredLogs]);
    const heatmapData = useMemo(() => buildHeatmapData(filteredLogs), [filteredLogs]);

    // Run analysis
    const runAnalysis = useCallback(async (forceRefresh = false) => {
        if (filteredLogs.length < 3) {
            setAnalysis(null);
            return;
        }

        setIsAnalyzing(true);

        try {
            const result = await analyzeLogs(filteredLogs, filteredCrisis, {
                forceRefresh,
                childProfile
            });
            setAnalysis(result);
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Analysis failed:', error);
            }
            setAnalysis(null);
        } finally {
            setIsAnalyzing(false);
        }
    }, [filteredLogs, filteredCrisis, childProfile]);

    // Deep Analysis handler
    const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);

    const handleDeepAnalysis = useCallback(async () => {
        if (filteredLogs.length < 3) return;

        setIsDeepAnalyzing(true);
        try {
            const result = await analyzeLogsDeep(filteredLogs, filteredCrisis, { childProfile });
            setAnalysis(result);
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Deep analysis failed:', error);
            }
        } finally {
            setIsDeepAnalyzing(false);
        }
    }, [filteredLogs, filteredCrisis, childProfile]);

    // Run analysis on mount and when data changes
    useEffect(() => {
        const timeoutId = setTimeout(() => runAnalysis(), 300);
        return () => clearTimeout(timeoutId);
    }, [runAnalysis]);

    // Get most recent crisis event for timeline
    const latestCrisis = filteredCrisis.length > 0 ? filteredCrisis[0] : null;

    const days = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    return (
        <div className="flex flex-col gap-4">
            {/* TopAppBar */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky top-0 z-10 flex items-center bg-background-dark/80 p-4 pb-2 backdrop-blur-sm justify-between rounded-b-xl -mx-4 -mt-4 mb-2 border-b border-white/10"
            >
                <button onClick={() => navigate(-1)} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white" aria-label="Gå tilbake">
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Atferdsinnsikt</h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleDeepAnalysis}
                        disabled={isAnalyzing || isDeepAnalyzing}
                        className={`h-10 px-4 rounded-full flex items-center gap-2 text-sm font-bold transition-all ${isDeepAnalyzing
                            ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50'
                            : analysis?.isDeepAnalysis
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25'
                                : 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50 hover:bg-indigo-500/30'
                            }`}
                    >
                        {isDeepAnalyzing ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>Tenker...</span>
                            </>
                        ) : (
                            <>
                                <Brain size={16} />
                                <span>{analysis?.isDeepAnalysis ? 'Dyp Analyse' : 'Kjør Dyp Analyse'}</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => runAnalysis(true)}
                        disabled={isAnalyzing || isDeepAnalyzing}
                        className="size-10 flex items-center justify-center rounded-full bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        {isAnalyzing ? (
                            <Loader2 size={20} className="text-primary animate-spin" />
                        ) : (
                            <RefreshCw size={20} />
                        )}
                    </button>
                </div>
            </motion.div>

            {/* Date Range Selector */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex gap-2"
            >
                {[
                    { value: '7', label: '7 Dager' },
                    { value: '30', label: '30 Dager' },
                    { value: '90', label: '90 Dager' }
                ].map(option => (
                    <button
                        key={option.value}
                        onClick={() => setDateRange(option.value as '7' | '30' | '90')}
                        className={`flex items-center justify-center rounded-full h-10 px-4 gap-2 text-sm font-bold transition-colors ${dateRange === option.value
                            ? 'bg-primary text-white'
                            : 'bg-primary/20 text-white hover:bg-primary/30'
                            }`}
                    >
                        <Calendar size={16} />
                        <span>{option.label}</span>
                    </button>
                ))}
            </motion.div>

            {/* Loading State */}
            <AnimatePresence>
                {isAnalyzing && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center justify-center gap-3 py-4 text-primary"
                    >
                        <Loader2 size={20} className="animate-spin" />
                        <span className="text-sm font-medium">Analyserer med AI...</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AI Analysis Summary */}
            {analysis && !isAnalyzing && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                >
                    <div className="rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 p-4 ring-1 ring-primary/30">
                        <div className="flex items-center gap-2 mb-3">
                            <Brain size={20} className="text-primary" />
                            <h2 className="text-white text-lg font-bold">AI Oppsummering</h2>
                            {analysis.isDeepAnalysis && (
                                <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                    </span>
                                    <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">
                                        {analysis.modelUsed ? analysis.modelUsed.split('/')[1] : 'Deep Analysis'}
                                    </span>
                                </div>
                            )}
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                            {analysis.summary}
                        </p>

                        {/* Recommendations */}
                        {analysis.recommendations && analysis.recommendations.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <h3 className="text-white text-sm font-bold mb-2 flex items-center gap-2">
                                    <TrendingUp size={16} />
                                    Anbefalinger
                                </h3>
                                <ul className="space-y-2">
                                    {analysis.recommendations.slice(0, 3).map((rec, i) => (
                                        <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                                            <span className="text-primary">•</span>
                                            {rec}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Meltdown Anatomy Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <div className="liquid-glass-card p-6 rounded-3xl">
                    <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">Nedsmeltingsanatomi</h2>
                    <p className="text-slate-400 text-base font-normal leading-normal pt-1">
                        {latestCrisis
                            ? 'Siste krisehendelse'
                            : 'Kobling mellom Utløsere, Atferd og Utfall'}
                    </p>

                    {latestCrisis ? (
                        <div className="grid grid-cols-[40px_1fr] gap-x-2 pt-5">
                            {/* Trigger */}
                            <div className="flex flex-col items-center gap-1 pt-3">
                                <div className="text-primary flex items-center justify-center rounded-full bg-primary/20 size-8">
                                    <Play size={18} className="text-primary" />
                                </div>
                                <div className="w-[1.5px] bg-slate-700 h-2 grow"></div>
                            </div>
                            <div className="flex flex-1 flex-col py-3">
                                <p className="text-white text-base font-medium leading-normal">
                                    {latestCrisis.sensoryTriggers[0] || latestCrisis.contextTriggers[0] || 'Ukjent trigger'}
                                </p>
                                <p className="text-slate-400 text-sm font-normal leading-normal">
                                    Forvarsel: {latestCrisis.warningSignsObserved[0] || 'Ikke observert'}
                                </p>
                            </div>

                            {/* Crisis */}
                            <div className="flex flex-col items-center gap-1">
                                <div className="w-[1.5px] bg-slate-700 h-2"></div>
                                <div className="text-red-400 flex items-center justify-center rounded-full bg-red-500/20 size-8">
                                    <AlertTriangle size={18} className="text-red-400" />
                                </div>
                                <div className="w-[1.5px] bg-slate-700 h-2 grow"></div>
                            </div>
                            <div className="flex flex-1 flex-col py-3">
                                <p className="text-white text-base font-medium leading-normal">
                                    {latestCrisis.type === 'meltdown' ? 'Nedsmelting' :
                                        latestCrisis.type === 'shutdown' ? 'Shutdown' :
                                            latestCrisis.type === 'anxiety' ? 'Angst' :
                                                latestCrisis.type === 'sensory_overload' ? 'Sensorisk overbelastning' : 'Krise'}
                                </p>
                                <p className="text-slate-400 text-sm font-normal leading-normal">
                                    Intensitet: {latestCrisis.peakIntensity}/10 | Varighet: {Math.round(latestCrisis.durationSeconds / 60)} min
                                </p>
                            </div>

                            {/* Resolution */}
                            <div className="flex flex-col items-center gap-1 pb-3">
                                <div className="w-[1.5px] bg-slate-700 h-2"></div>
                                <div className="text-green-400 flex items-center justify-center rounded-full bg-green-500/20 size-8">
                                    <Brain size={18} className="text-green-400" />
                                </div>
                            </div>
                            <div className="flex flex-1 flex-col py-3">
                                <p className="text-white text-base font-medium leading-normal">
                                    {latestCrisis.strategiesUsed[0] || 'Gjenopprettet'}
                                </p>
                                <p className="text-slate-400 text-sm font-normal leading-normal">
                                    Gjenopprettingstid: {latestCrisis.recoveryTimeMinutes || '?'} min
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="py-8 text-center text-slate-500">
                            <Shield size={32} className="mx-auto mb-2 opacity-50" />
                            <p>Ingen krisehendelser i denne perioden</p>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Heatmap of Dysregulation */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <div className="liquid-glass-card p-6 rounded-3xl">
                    <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">Dysreguleringsvarme</h2>
                    <p className="text-slate-400 text-base font-normal leading-normal pt-1">Spenningsintensitet per Dag og Tid</p>
                    <div className="mt-6">
                        <div className="grid grid-cols-8 gap-1 text-center text-xs font-bold text-slate-400">
                            <div></div>
                            {days.map(day => (
                                <div key={day}>{day}</div>
                            ))}
                        </div>
                        {['morning', 'midday', 'afternoon', 'evening'].map((time, timeIdx) => (
                            <div key={time} className="grid grid-cols-8 gap-1 mt-2">
                                <div className="flex items-center justify-center text-xs font-bold text-slate-400">
                                    {time === 'morning' ? 'Morg' : time === 'midday' ? 'Form' : time === 'afternoon' ? 'Ettm' : 'Kveld'}
                                </div>
                                {dayKeys.map(day => (
                                    <motion.div
                                        key={`${time}-${day}`}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.3 + timeIdx * 0.05 }}
                                        className={`aspect-square rounded ${getHeatmapColor(heatmapData[time]?.[day] || 0)}`}
                                        title={`${time} ${day}: ${heatmapData[time]?.[day] || 0}`}
                                    />
                                ))}
                            </div>
                        ))}

                        {/* Legend */}
                        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-400">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-green-500/30" />
                                <span>Lav</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-yellow-500/40" />
                                <span>Middels</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-orange-500/60" />
                                <span>Høy</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-red-500/70" />
                                <span>Kritisk</span>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Strategy Efficacy Chart */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
            >
                <div className="liquid-glass-card p-6 rounded-3xl">
                    <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">Strategieffekt</h2>
                    <p className="text-slate-400 text-base font-normal leading-normal pt-1">
                        {analysis?.strategyEvaluation
                            ? 'Basert på AI-analyse av loggene'
                            : 'Hvilke Strategier Fungerer Best?'}
                    </p>

                    {strategyData.length > 0 ? (
                        <div className="space-y-6 mt-6">
                            {strategyData.map((strategy, i) => (
                                <motion.div
                                    key={strategy.name}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 + i * 0.1 }}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-white text-base font-medium">{strategy.name}</p>
                                        <span className="text-xs text-slate-400">Brukt {strategy.total}x</span>
                                    </div>
                                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-700">
                                        <div
                                            className="bg-green-500 transition-all duration-500"
                                            style={{ width: `${strategy.successRate}%` }}
                                        />
                                        <div
                                            className="bg-slate-500 transition-all duration-500"
                                            style={{ width: `${strategy.noChangeRate}%` }}
                                        />
                                        <div
                                            className="bg-red-500 transition-all duration-500"
                                            style={{ width: `${strategy.escalatedRate}%` }}
                                        />
                                    </div>
                                    {i === 0 && (
                                        <div className="mt-2 flex justify-between text-xs text-slate-400">
                                            <span className="flex items-center gap-1.5">
                                                <div className="size-2 rounded-full bg-green-500"></div>
                                                Suksess: {strategy.successRate}%
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <div className="size-2 rounded-full bg-slate-500"></div>
                                                Uendret: {strategy.noChangeRate}%
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <div className="size-2 rounded-full bg-red-500"></div>
                                                Eskalering: {strategy.escalatedRate}%
                                            </span>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-8 text-center text-slate-500">
                            <Zap size={32} className="mx-auto mb-2 opacity-50" />
                            <p>Ingen strategidata tilgjengelig</p>
                            <p className="text-xs mt-1">Logg strategier for å se effektivitetsdata</p>
                        </div>
                    )}

                    {/* AI Strategy Analysis */}
                    {analysis?.strategyEvaluation && (
                        <div className="mt-6 pt-4 border-t border-white/10">
                            <h3 className="text-white text-sm font-bold mb-2 flex items-center gap-2">
                                <Brain size={16} className="text-primary" />
                                AI Strategianalyse
                            </h3>
                            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                                {analysis.strategyEvaluation}
                            </p>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Correlations from AI */}
            {analysis?.correlations && analysis.correlations.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <div className="liquid-glass-card p-6 rounded-3xl">
                        <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">Oppdagede Sammenhenger</h2>
                        <p className="text-slate-400 text-base font-normal leading-normal pt-1">AI-identifiserte mønstre</p>

                        <div className="space-y-4 mt-6">
                            {analysis.correlations.map((corr, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.5 + i * 0.1 }}
                                    className={`p-3 rounded-lg ${corr.strength === 'strong'
                                        ? 'bg-red-500/10 ring-1 ring-red-500/30'
                                        : corr.strength === 'moderate'
                                            ? 'bg-yellow-500/10 ring-1 ring-yellow-500/30'
                                            : 'bg-slate-700/50 ring-1 ring-white/10'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-white font-medium text-sm">{corr.factor1}</span>
                                        <span className="text-slate-500">→</span>
                                        <span className="text-white font-medium text-sm">{corr.factor2}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${corr.strength === 'strong'
                                            ? 'bg-red-500/20 text-red-400'
                                            : corr.strength === 'moderate'
                                                ? 'bg-yellow-500/20 text-yellow-400'
                                                : 'bg-slate-600 text-slate-300'
                                            }`}>
                                            {corr.strength === 'strong' ? 'Sterk' : corr.strength === 'moderate' ? 'Moderat' : 'Svak'}
                                        </span>
                                    </div>
                                    <p className="text-slate-400 text-sm">{corr.description}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}

            <div className="h-5"></div>
        </div>
    );
};

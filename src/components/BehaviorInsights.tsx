import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Play, AlertTriangle, Brain, Calendar, Loader2, RefreshCw, TrendingUp, Shield, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLogs, useCrisis, useChildProfile } from '../store';
import { analyzeLogs, analyzeLogsDeep } from '../services/ai';
import type { AnalysisResult, LogEntry } from '../types';
import { getModelDisplayName } from '../utils/modelUtils';

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
        evening: { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] },
        night: { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] }
    };

    logs.forEach(log => {
        // Validate that arousal is a finite number before including
        if (log.timeOfDay && log.dayOfWeek && Number.isFinite(log.arousal)) {
            const timeKey = log.timeOfDay;
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
            // Filter out any invalid values as safety net
            const validValues = values.filter(v => Number.isFinite(v));
            result[time][day] = validValues.length > 0
                ? Math.round(validValues.reduce((a, b) => a + b, 0) / validValues.length)
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
    const { t } = useTranslation();
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
        const daysAgo = parseInt(dateRange, 10);
        const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        return logs.filter(log => new Date(log.timestamp) >= startDate);
    }, [logs, dateRange]);

    const filteredCrisis = useMemo(() => {
        const now = new Date();
        const daysAgo = parseInt(dateRange, 10);
        const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        return crisisEvents
            .filter(event => new Date(event.timestamp) >= startDate)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [crisisEvents, dateRange]);

    // Calculate derived data
    const strategyData = useMemo(() => calculateStrategyEffectiveness(filteredLogs), [filteredLogs]);
    const heatmapData = useMemo(() => buildHeatmapData(filteredLogs), [filteredLogs]);

    // Track mounted state for async operations
    const isMountedRef = React.useRef(true);

    React.useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

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
            // Only update state if component is still mounted
            if (isMountedRef.current) {
                setAnalysis(result);
            }
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Analysis failed:', error);
            }
            if (isMountedRef.current) {
                setAnalysis(null);
            }
        } finally {
            if (isMountedRef.current) {
                setIsAnalyzing(false);
            }
        }
    }, [filteredLogs, filteredCrisis, childProfile]);

    // Deep Analysis handler
    const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);

    const handleDeepAnalysis = useCallback(async () => {
        if (filteredLogs.length < 3) return;

        setIsDeepAnalyzing(true);
        try {
            const result = await analyzeLogsDeep(filteredLogs, filteredCrisis, { childProfile });
            // Only update state if component is still mounted
            if (isMountedRef.current) {
                setAnalysis(result);
            }
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Deep analysis failed:', error);
            }
        } finally {
            if (isMountedRef.current) {
                setIsDeepAnalyzing(false);
            }
        }
    }, [filteredLogs, filteredCrisis, childProfile]);

    // Run analysis on mount and when data changes
    useEffect(() => {
        const timeoutId = setTimeout(() => runAnalysis(), 300);
        return () => clearTimeout(timeoutId);
    }, [runAnalysis]);

    // Get most recent crisis event for timeline
    const latestCrisis = filteredCrisis.length > 0 ? filteredCrisis[0] : null;

    // Translated day labels and keys
    const dayLabels = [
        t('behaviorInsights.heatmap.days.mon'),
        t('behaviorInsights.heatmap.days.tue'),
        t('behaviorInsights.heatmap.days.wed'),
        t('behaviorInsights.heatmap.days.thu'),
        t('behaviorInsights.heatmap.days.fri'),
        t('behaviorInsights.heatmap.days.sat'),
        t('behaviorInsights.heatmap.days.sun')
    ];
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    // Time period labels and keys (including night)
    const timeKeys = ['morning', 'midday', 'afternoon', 'evening', 'night'] as const;
    const getTimeLabel = (time: string) => t(`behaviorInsights.heatmap.times.${time}`);

    return (
        <div className="flex flex-col gap-4">
            {/* TopAppBar */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky top-0 z-10 flex items-center bg-background-dark/80 p-4 pb-2 backdrop-blur-sm justify-between rounded-b-xl -mx-4 -mt-4 mb-2 border-b border-white/10"
            >
                <button onClick={() => navigate(-1)} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white" aria-label={t('behaviorInsights.goBack')}>
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">{t('behaviorInsights.title')}</h1>
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
                                <span>{t('behaviorInsights.thinking')}</span>
                            </>
                        ) : (
                            <>
                                <Brain size={16} />
                                <span>{analysis?.isDeepAnalysis ? t('behaviorInsights.deepAnalysis') : t('behaviorInsights.runDeepAnalysis')}</span>
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
                    { value: '7', label: t('behaviorInsights.dateRange.7days') },
                    { value: '30', label: t('behaviorInsights.dateRange.30days') },
                    { value: '90', label: t('behaviorInsights.dateRange.90days') }
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
                        <span className="text-sm font-medium">{t('behaviorInsights.analyzingWithAi')}</span>
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
                            <h2 className="text-white text-lg font-bold">{t('behaviorInsights.aiSummary')}</h2>
                            {analysis.isDeepAnalysis && (
                                <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                    </span>
                                    <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">
                                        {getModelDisplayName(analysis.modelUsed, 'Deep Analysis')}
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
                                    {t('behaviorInsights.recommendations')}
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
                    <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">{t('behaviorInsights.meltdownAnatomy.title')}</h2>
                    <p className="text-slate-400 text-base font-normal leading-normal pt-1">
                        {latestCrisis
                            ? t('behaviorInsights.meltdownAnatomy.lastCrisis')
                            : t('behaviorInsights.meltdownAnatomy.subtitle')}
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
                                    {latestCrisis.sensoryTriggers[0] || latestCrisis.contextTriggers[0] || t('behaviorInsights.meltdownAnatomy.unknownTrigger')}
                                </p>
                                <p className="text-slate-400 text-sm font-normal leading-normal">
                                    {t('behaviorInsights.meltdownAnatomy.warning')}: {latestCrisis.warningSignsObserved[0] || t('behaviorInsights.meltdownAnatomy.notObserved')}
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
                                    {latestCrisis.type === 'meltdown' ? t('behaviorInsights.meltdownAnatomy.meltdown') :
                                        latestCrisis.type === 'shutdown' ? t('behaviorInsights.meltdownAnatomy.shutdown') :
                                            latestCrisis.type === 'anxiety' ? t('behaviorInsights.meltdownAnatomy.anxiety') :
                                                latestCrisis.type === 'sensory_overload' ? t('behaviorInsights.meltdownAnatomy.sensoryOverload') : t('behaviorInsights.meltdownAnatomy.crisis')}
                                </p>
                                <p className="text-slate-400 text-sm font-normal leading-normal">
                                    {t('behaviorInsights.meltdownAnatomy.intensity')}: {latestCrisis.peakIntensity}/10 | {t('behaviorInsights.meltdownAnatomy.duration')}: {Math.round(latestCrisis.durationSeconds / 60)} min
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
                                    {latestCrisis.strategiesUsed[0] || t('behaviorInsights.meltdownAnatomy.recovered')}
                                </p>
                                <p className="text-slate-400 text-sm font-normal leading-normal">
                                    {t('behaviorInsights.meltdownAnatomy.recoveryTime')}: {latestCrisis.recoveryTimeMinutes || '?'} min
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="py-8 text-center text-slate-500">
                            <Shield size={32} className="mx-auto mb-2 opacity-50" />
                            <p>{t('behaviorInsights.meltdownAnatomy.noCrisisEvents')}</p>
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
                    <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">{t('behaviorInsights.heatmap.title')}</h2>
                    <p className="text-slate-400 text-base font-normal leading-normal pt-1">{t('behaviorInsights.heatmap.subtitle')}</p>

                    {/* Legend - placed before grid for better understanding */}
                    <div className="flex items-center justify-center gap-4 mt-4 mb-2 text-xs text-slate-400" role="legend" aria-label={t('behaviorInsights.heatmap.title')}>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-slate-700/30" aria-hidden="true" />
                            <span>{t('behaviorInsights.heatmap.legend.noData')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-green-500/30" aria-hidden="true" />
                            <span>{t('behaviorInsights.heatmap.legend.low')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-yellow-500/40" aria-hidden="true" />
                            <span>{t('behaviorInsights.heatmap.legend.medium')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-orange-500/60" aria-hidden="true" />
                            <span>{t('behaviorInsights.heatmap.legend.high')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded bg-red-500/70" aria-hidden="true" />
                            <span>{t('behaviorInsights.heatmap.legend.critical')}</span>
                        </div>
                    </div>

                    <div className="mt-4" role="grid" aria-label={t('behaviorInsights.heatmap.title')}>
                        {/* Day headers */}
                        <div className="grid grid-cols-8 gap-1 text-center text-xs font-bold text-slate-400" role="row">
                            <div role="columnheader" aria-hidden="true"></div>
                            {dayLabels.map((day, idx) => (
                                <div key={dayKeys[idx]} role="columnheader">{day}</div>
                            ))}
                        </div>
                        {/* Time rows with all 5 time periods including night */}
                        {timeKeys.map((time, timeIdx) => (
                            <div key={time} className="grid grid-cols-8 gap-1 mt-2" role="row">
                                <div className="flex items-center justify-center text-xs font-bold text-slate-400" role="rowheader">
                                    {getTimeLabel(time)}
                                </div>
                                {dayKeys.map((day, dayIdx) => {
                                    const level = heatmapData[time]?.[day] || 0;
                                    const dayLabel = dayLabels[dayIdx];
                                    const timeLabel = getTimeLabel(time);
                                    return (
                                        <motion.div
                                            key={`${time}-${day}`}
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.3 + timeIdx * 0.05 }}
                                            className={`aspect-square rounded ${getHeatmapColor(level)}`}
                                            role="gridcell"
                                            aria-label={t('behaviorInsights.heatmap.cellLabel', { day: dayLabel, time: timeLabel, level })}
                                            title={`${dayLabel} ${timeLabel}: ${level}`}
                                        />
                                    );
                                })}
                            </div>
                        ))}
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
                    <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">{t('behaviorInsights.strategy.title')}</h2>
                    <p className="text-slate-400 text-base font-normal leading-normal pt-1">
                        {analysis?.strategyEvaluation
                            ? t('behaviorInsights.strategy.aiBasedSubtitle')
                            : t('behaviorInsights.strategy.subtitle')}
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
                                        <span className="text-xs text-slate-400">{t('behaviorInsights.strategy.used', { count: strategy.total })}</span>
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
                                                {t('behaviorInsights.strategy.success')}: {strategy.successRate}%
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <div className="size-2 rounded-full bg-slate-500"></div>
                                                {t('behaviorInsights.strategy.noChange')}: {strategy.noChangeRate}%
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <div className="size-2 rounded-full bg-red-500"></div>
                                                {t('behaviorInsights.strategy.escalated')}: {strategy.escalatedRate}%
                                            </span>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-8 text-center text-slate-500">
                            <Zap size={32} className="mx-auto mb-2 opacity-50" />
                            <p>{t('behaviorInsights.strategy.noData')}</p>
                            <p className="text-xs mt-1">{t('behaviorInsights.strategy.noDataHint')}</p>
                        </div>
                    )}

                    {/* AI Strategy Analysis */}
                    {analysis?.strategyEvaluation && (
                        <div className="mt-6 pt-4 border-t border-white/10">
                            <h3 className="text-white text-sm font-bold mb-2 flex items-center gap-2">
                                <Brain size={16} className="text-primary" />
                                {t('behaviorInsights.strategy.aiAnalysis')}
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
                        <h2 className="text-white text-[22px] font-bold leading-tight tracking-[-0.015em]">{t('behaviorInsights.correlations.title')}</h2>
                        <p className="text-slate-400 text-base font-normal leading-normal pt-1">{t('behaviorInsights.correlations.subtitle')}</p>

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
                                            {corr.strength === 'strong' ? t('behaviorInsights.correlations.strength.strong') : corr.strength === 'moderate' ? t('behaviorInsights.correlations.strength.moderate') : t('behaviorInsights.correlations.strength.weak')}
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

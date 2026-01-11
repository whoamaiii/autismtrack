import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, Calendar, Check, Loader2, AlertCircle, ArrowLeft, Eye, X, ChevronRight } from 'lucide-react';
import { useLogs, useCrisis, useChildProfile } from '../store';
import { generatePDF } from '../services/pdfGenerator';
import { analyzeLogs } from '../services/ai';
import type { AnalysisResult } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { translateTrigger, translateStrategy } from '../utils/translateDomain';

type Period = '30_days' | '3_months' | 'this_year';

export const Reports: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { logs } = useLogs();
    const { crisisEvents } = useCrisis();
    const { childProfile } = useChildProfile();

    // State
    const [period, setPeriod] = useState<Period>('30_days');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGenerated, setIsGenerated] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Preview modal state
    const [showPreview, setShowPreview] = useState(false);
    const [previewAnalysis, setPreviewAnalysis] = useState<AnalysisResult | null>(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [previewAnalysisError, setPreviewAnalysisError] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    // Loading state for perceived performance - show skeleton briefly
    useEffect(() => {
        const timer = setTimeout(() => setIsInitialLoading(false), 300);
        return () => clearTimeout(timer);
    }, []);

    // Track mounted state for async operations
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Filter data based on selection (DST-safe date calculations)
    const { filteredLogs, filteredCrisis, startDate } = useMemo(() => {
        const now = new Date();
        // Normalize to start of day to avoid DST edge cases
        now.setHours(0, 0, 0, 0);

        let start: Date;

        switch (period) {
            case '30_days':
                // Use explicit date construction to handle month boundaries correctly
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
                break;
            case '3_months':
                // Use explicit date construction to handle year boundaries correctly
                start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                break;
            case 'this_year':
                start = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                start = new Date(now);
        }

        // Ensure start is also normalized to start of day
        start.setHours(0, 0, 0, 0);

        return {
            filteredLogs: logs.filter(l => new Date(l.timestamp) >= start),
            filteredCrisis: crisisEvents.filter(c => new Date(c.timestamp) >= start),
            startDate: start
        };
    }, [logs, crisisEvents, period]);

    // Calculate preview stats
    const stats = useMemo(() => {
        const totalIncidents = filteredCrisis.length;
        const avgDuration = filteredCrisis.length > 0
            ? Math.round(filteredCrisis.reduce((acc, c) => acc + c.durationSeconds, 0) / filteredCrisis.length / 60)
            : 0;

        // Find top trigger
        const triggers: Record<string, number> = {};
        filteredLogs.forEach(l => {
            [...l.sensoryTriggers, ...l.contextTriggers].forEach(trigger => triggers[trigger] = (triggers[trigger] || 0) + 1);
        });
        const topTriggerRaw = Object.entries(triggers).sort((a, b) => b[1] - a[1])[0]?.[0];
        const topTrigger = topTriggerRaw ? translateTrigger(topTriggerRaw) : t('reports.noData');

        // Find most effective strategy
        const strategies: Record<string, { total: number, helped: number }> = {};
        filteredLogs.forEach(l => {
            l.strategies.forEach(s => {
                if (!strategies[s]) strategies[s] = { total: 0, helped: 0 };
                strategies[s].total++;
                if (l.strategyEffectiveness === 'helped') strategies[s].helped++;
            });
        });

        const bestStrategyRaw = Object.entries(strategies)
            .filter(([, data]) => data.total >= 3) // Min 3 uses to be significant
            .sort((a, b) => (b[1].helped / b[1].total) - (a[1].helped / a[1].total))[0]?.[0];
        const bestStrategy = bestStrategyRaw ? translateStrategy(bestStrategyRaw) : t('reports.noData');

        return { totalIncidents, avgDuration, topTrigger, bestStrategy };
    }, [filteredLogs, filteredCrisis, t]);

    // Handle preview - loads AI analysis and shows modal
    const handlePreview = async () => {
        if (filteredLogs.length === 0) {
            setError(t('reports.error.noData'));
            return;
        }

        setShowPreview(true);
        setError(null);
        setPreviewAnalysisError(false);

        // Load AI analysis if we have enough data and don't already have it
        if (filteredLogs.length >= 5 && !previewAnalysis) {
            setIsLoadingPreview(true);
            try {
                const analysis = await analyzeLogs(filteredLogs, filteredCrisis, { childProfile });
                if (isMountedRef.current) {
                    setPreviewAnalysis(analysis);
                }
            } catch (e) {
                if (import.meta.env.DEV) {
                    console.warn('AI Analysis failed for preview', e);
                }
                if (isMountedRef.current) {
                    setPreviewAnalysisError(true);
                }
            } finally {
                if (isMountedRef.current) {
                    setIsLoadingPreview(false);
                }
            }
        }
    };

    // Clear preview analysis when period changes
    useEffect(() => {
        setPreviewAnalysis(null);
    }, [period]);

    const handleGenerate = async () => {
        if (filteredLogs.length === 0) {
            setError(t('reports.error.noData'));
            return;
        }

        setIsGenerating(true);
        setError(null);
        setShowPreview(false); // Close preview modal if open

        try {
            // 1. Get AI Analysis (use cached preview analysis if available, otherwise fetch fresh)
            let analysis = previewAnalysis;
            if (!analysis && filteredLogs.length >= 5) {
                try {
                    analysis = await analyzeLogs(filteredLogs, filteredCrisis, { childProfile });
                } catch (e) {
                    if (import.meta.env.DEV) {
                        console.warn('AI Analysis failed, generating report without it', e);
                    }
                }
            }

            // 2. Generate PDF (dynamic import on first use)
            await generatePDF(filteredLogs, filteredCrisis, analysis, {
                title: 'NeuroLogg Pro - Atferdsrapport',
                startDate,
                endDate: new Date()
            });

            if (isMountedRef.current) {
                setIsGenerated(true);
                setTimeout(() => {
                    if (isMountedRef.current) {
                        setIsGenerated(false);
                    }
                }, 5000); // Reset success state after 5s
            }
        } catch (e) {
            if (import.meta.env.DEV) {
                console.error(e);
            }
            if (isMountedRef.current) {
                setError(t('reports.error.failed'));
            }
        } finally {
            if (isMountedRef.current) {
                setIsGenerating(false);
            }
        }
    };

    // Loading skeleton
    if (isInitialLoading) {
        return (
            <div className="flex flex-col gap-6 px-4 py-4 min-h-screen pb-24 animate-pulse">
                <div className="sticky top-0 z-10 flex items-center p-4 pb-2 justify-between rounded-b-xl -mx-4 -mt-4 mb-2 border-b border-white/10">
                    <div className="w-10 h-10 rounded-full bg-slate-700" />
                    <div className="h-6 w-32 bg-slate-700 rounded" />
                    <div className="w-10 h-10" />
                </div>
                <div className="h-40 bg-slate-800 rounded-3xl" />
                <div className="h-48 bg-slate-800 rounded-3xl" />
                <div className="h-16 bg-slate-800 rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 px-4 py-4 min-h-screen pb-24">
            {/* Top App Bar */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky top-0 z-10 flex items-center bg-background-dark/80 p-4 pb-2 backdrop-blur-sm justify-between rounded-b-xl -mx-4 -mt-4 mb-2 border-b border-white/10"
            >
                <button onClick={() => navigate(-1)} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white" aria-label="Gå tilbake">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">{t('reports.title')}</h2>
                <div className="size-10"></div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-6"
            >
                {/* Date Selection */}
                <div className="liquid-glass-card p-6 rounded-3xl">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Calendar className="text-primary" size={20} />
                        {t('reports.period.title')}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setPeriod('30_days')}
                            className={`p-3 rounded-xl font-bold text-sm border transition-all ${period === '30_days' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'}`}
                        >
                            {t('reports.period.last30')}
                        </button>
                        <button
                            onClick={() => setPeriod('3_months')}
                            className={`p-3 rounded-xl font-bold text-sm border transition-all ${period === '3_months' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'}`}
                        >
                            {t('reports.period.last3Months')}
                        </button>
                        <button
                            onClick={() => setPeriod('this_year')}
                            className={`p-3 rounded-xl font-bold text-sm border transition-all ${period === 'this_year' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'}`}
                        >
                            {t('reports.period.thisYear')}
                        </button>
                    </div>
                </div>

                {/* Report Preview */}
                <div className="liquid-glass-card p-6 rounded-3xl">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <FileText className="text-purple-500" size={20} />
                        {t('reports.preview.title')}
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-white/10">
                            <span className="text-slate-400">{t('reports.preview.incidents')}</span>
                            <span className="font-bold text-white">{stats.totalIncidents}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/10">
                            <span className="text-slate-400">{t('reports.preview.avgDuration')}</span>
                            <span className="font-bold text-white">{stats.avgDuration} min</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/10">
                            <span className="text-slate-400">{t('reports.preview.topTrigger')}</span>
                            <span className="font-bold text-white">{stats.topTrigger}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-slate-400">{t('reports.preview.bestStrategy')}</span>
                            <span className="font-bold text-green-400">{stats.bestStrategy}</span>
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                    {/* Preview Button */}
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handlePreview}
                        disabled={isGenerating || filteredLogs.length === 0}
                        className="flex-1 h-14 rounded-xl flex items-center justify-center gap-2 font-bold text-lg transition-all bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Eye size={24} />
                        {t('reports.previewButton')}
                    </motion.button>

                    {/* Generate Button */}
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleGenerate}
                        disabled={isGenerating || isGenerated}
                        className={`flex-1 h-14 rounded-xl flex items-center justify-center gap-2 font-bold text-lg transition-all ${isGenerated
                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/25 neon-glow-green'
                            : isGenerating
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-primary text-white hover:bg-blue-600 shadow-lg shadow-primary/25 neon-glow-blue'
                            }`}
                    >
                        {isGenerated ? (
                            <>
                                <Check size={24} />
                                {t('reports.generated')}
                            </>
                        ) : isGenerating ? (
                            <>
                                <Loader2 size={24} className="animate-spin" />
                                {t('reports.generating')}
                            </>
                        ) : (
                            <>
                                <Download size={24} />
                                {t('reports.generate')}
                            </>
                        )}
                    </motion.button>
                </div>

                {isGenerated && (
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center text-sm text-slate-500"
                    >
                        {t('reports.success')}
                    </motion.p>
                )}
            </motion.div>

            {/* Preview Modal */}
            <AnimatePresence>
                {showPreview && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
                        onClick={() => setShowPreview(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="liquid-glass-card p-6 rounded-3xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Eye className="text-purple-400" size={24} />
                                    {t('reports.previewModal.title')}
                                </h3>
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                                    aria-label={t('reports.closePreview')}
                                >
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>

                            {/* Stats Summary */}
                            <div className="mb-6">
                                <h4 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">
                                    {t('reports.previewModal.stats')}
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/5 p-3 rounded-xl">
                                        <div className="text-2xl font-bold text-white">{filteredLogs.length}</div>
                                        <div className="text-xs text-slate-400">{t('reports.previewModal.totalLogs')}</div>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-xl">
                                        <div className="text-2xl font-bold text-white">{stats.totalIncidents}</div>
                                        <div className="text-xs text-slate-400">{t('reports.previewModal.incidents')}</div>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-xl">
                                        <div className="text-2xl font-bold text-white">{stats.avgDuration} min</div>
                                        <div className="text-xs text-slate-400">{t('reports.previewModal.avgDuration')}</div>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-xl">
                                        <div className="text-lg font-bold text-green-400 truncate">{stats.bestStrategy}</div>
                                        <div className="text-xs text-slate-400">{t('reports.previewModal.bestStrategy')}</div>
                                    </div>
                                </div>
                            </div>

                            {/* AI Analysis Preview */}
                            <div className="mb-6">
                                <h4 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">
                                    {t('reports.previewModal.aiAnalysis')}
                                </h4>
                                <div className="bg-white/5 p-4 rounded-xl">
                                    {isLoadingPreview ? (
                                        <div className="flex items-center justify-center gap-2 py-4 text-slate-400">
                                            <Loader2 size={20} className="animate-spin" />
                                            {t('reports.previewModal.loadingAnalysis')}
                                        </div>
                                    ) : previewAnalysisError ? (
                                        <div className="flex items-center justify-center gap-2 py-4 text-amber-400">
                                            <AlertCircle size={20} />
                                            <span className="text-sm">{t('reports.previewModal.analysisError', 'AI analysis unavailable')}</span>
                                        </div>
                                    ) : previewAnalysis ? (
                                        <div className="space-y-2">
                                            <p className="text-slate-300 text-sm line-clamp-4">
                                                {previewAnalysis.summary}
                                            </p>
                                            {previewAnalysis.recommendations && previewAnalysis.recommendations.length > 0 && (
                                                <div className="pt-2 border-t border-white/10">
                                                    <span className="text-xs text-slate-500">
                                                        {t('reports.previewModal.recommendations', { count: previewAnalysis.recommendations.length })}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ) : filteredLogs.length < 5 ? (
                                        <p className="text-slate-500 text-sm text-center py-2">
                                            {t('reports.previewModal.notEnoughData')}
                                        </p>
                                    ) : (
                                        <p className="text-slate-500 text-sm text-center py-2">
                                            {t('reports.previewModal.noAnalysis')}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Sample Data Preview */}
                            {filteredCrisis.length > 0 && (
                                <div className="mb-6">
                                    <h4 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">
                                        {t('reports.previewModal.sampleCrisis')}
                                    </h4>
                                    <div className="space-y-2">
                                        {filteredCrisis.slice(0, 3).map((crisis, idx) => (
                                            <div key={idx} className="bg-white/5 p-3 rounded-xl flex items-center gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm text-white truncate">{crisis.type}</div>
                                                    <div className="text-xs text-slate-500">
                                                        {new Date(crisis.timestamp).toLocaleDateString('nb-NO')} - {Math.round(crisis.durationSeconds / 60)} min
                                                    </div>
                                                </div>
                                                <ChevronRight size={16} className="text-slate-600" />
                                            </div>
                                        ))}
                                        {filteredCrisis.length > 3 && (
                                            <p className="text-xs text-slate-500 text-center">
                                                +{filteredCrisis.length - 3} {t('reports.previewModal.more')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Generate from Preview Button */}
                            <motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="w-full py-4 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors disabled:opacity-50"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        {t('reports.generating')}
                                    </>
                                ) : (
                                    <>
                                        <Download size={20} />
                                        {t('reports.generate')}
                                    </>
                                )}
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

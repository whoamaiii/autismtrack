import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, Calendar, Check, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useLogs, useCrisis, useChildProfile } from '../store';
import { generatePDF } from '../services/pdfGenerator';
import { analyzeLogs } from '../services/ai';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

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

    // Filter data based on selection
    const { filteredLogs, filteredCrisis, startDate } = useMemo(() => {
        const now = new Date();
        let start = new Date();

        switch (period) {
            case '30_days':
                start.setDate(now.getDate() - 30);
                break;
            case '3_months':
                start.setMonth(now.getMonth() - 3);
                break;
            case 'this_year':
                start = new Date(now.getFullYear(), 0, 1);
                break;
        }

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
            [...l.sensoryTriggers, ...l.contextTriggers].forEach(t => triggers[t] = (triggers[t] || 0) + 1);
        });
        const topTrigger = Object.entries(triggers).sort((a, b) => b[1] - a[1])[0]?.[0] || t('reports.noData');

        // Find most effective strategy
        const strategies: Record<string, { total: number, helped: number }> = {};
        filteredLogs.forEach(l => {
            l.strategies.forEach(s => {
                if (!strategies[s]) strategies[s] = { total: 0, helped: 0 };
                strategies[s].total++;
                if (l.strategyEffectiveness === 'helped') strategies[s].helped++;
            });
        });

        const bestStrategy = Object.entries(strategies)
            .filter(([, data]) => data.total >= 3) // Min 3 uses to be significant
            .sort((a, b) => (b[1].helped / b[1].total) - (a[1].helped / a[1].total))[0]?.[0] || t('reports.noData');

        return { totalIncidents, avgDuration, topTrigger, bestStrategy };
    }, [filteredLogs, filteredCrisis, t]);

    const handleGenerate = async () => {
        if (filteredLogs.length === 0) {
            setError(t('reports.error.noData'));
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            // 1. Get AI Analysis (cached or fresh)
            // We use a shortened timeout effectively by not waiting forever if it fails
            let analysis = null;
            try {
                // Only try analysis if we have meaningful data
                if (filteredLogs.length >= 5) {
                    analysis = await analyzeLogs(filteredLogs, filteredCrisis, { childProfile });
                }
            } catch (e) {
                if (import.meta.env.DEV) {
                    console.warn('AI Analysis failed, generating report without it', e);
                }
            }

            // 2. Generate PDF
            generatePDF(filteredLogs, filteredCrisis, analysis, {
                title: 'NeuroLogg Pro - Atferdsrapport',
                startDate,
                endDate: new Date()
            });

            setIsGenerated(true);
            setTimeout(() => setIsGenerated(false), 5000); // Reset success state after 5s
        } catch (e) {
            if (import.meta.env.DEV) {
                console.error(e);
            }
            setError(t('reports.error.failed'));
        } finally {
            setIsGenerating(false);
        }
    };

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

                {/* Generate Button */}
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleGenerate}
                    disabled={isGenerating || isGenerated}
                    className={`w-full h-14 rounded-xl flex items-center justify-center gap-2 font-bold text-lg transition-all ${isGenerated
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
        </div>
    );
};

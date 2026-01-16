/**
 * Context Comparison Component
 * Side-by-side comparison of Home vs School behavioral patterns
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft,
    Home,
    School,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Zap,
    Activity,
    Target,
    Info
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    BarChart,
    Bar
} from 'recharts';

import { useLogs, useCrisis } from '../store';
import { calculateContextComparison, getComparisonSummary } from '../utils/contextComparison';
import type { ContextMetrics, ContextDifference } from '../types';

interface ContextComparisonProps {
    onClose: () => void;
}

export default function ContextComparison({ onClose }: ContextComparisonProps) {
    const { t } = useTranslation();
    const { logs } = useLogs();
    const { crisisEvents } = useCrisis();

    const [activeTab, setActiveTab] = useState<'sideBySide' | 'differences'>('sideBySide');

    // Calculate comparison
    const comparison = useMemo(() =>
        calculateContextComparison(logs, crisisEvents),
        [logs, crisisEvents]
    );

    const summary = useMemo(() =>
        getComparisonSummary(comparison),
        [comparison]
    );

    // Prepare hourly chart data
    const hourlyChartData = useMemo(() => {
        if (!comparison) return [];

        const hours = Array.from({ length: 24 }, (_, i) => i);
        return hours.map(hour => {
            const homeData = comparison.home.peakArousalTimes.find(p => p.hour === hour);
            const schoolData = comparison.school.peakArousalTimes.find(p => p.hour === hour);

            return {
                hour: `${hour}:00`,
                home: homeData?.avgArousal ?? null,
                school: schoolData?.avgArousal ?? null
            };
        }).filter(d => d.home !== null || d.school !== null);
    }, [comparison]);

    // Prepare trigger comparison data
    const triggerChartData = useMemo(() => {
        if (!comparison) return [];

        const allTriggers = new Set([
            ...comparison.home.topTriggers.map(t => t.trigger),
            ...comparison.school.topTriggers.map(t => t.trigger)
        ]);

        return Array.from(allTriggers).slice(0, 6).map(trigger => {
            const homeT = comparison.home.topTriggers.find(t => t.trigger === trigger);
            const schoolT = comparison.school.topTriggers.find(t => t.trigger === trigger);

            return {
                trigger: trigger.length > 10 ? trigger.substring(0, 10) + '...' : trigger,
                fullTrigger: trigger,
                home: homeT?.percentage ?? 0,
                school: schoolT?.percentage ?? 0
            };
        });
    }, [comparison]);

    if (!comparison) {
        return (
            <motion.div
                initial={{ opacity: 0, x: '100%' }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: '100%' }}
                className="fixed inset-0 z-50 bg-background-dark overflow-y-auto"
            >
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center bg-background-dark/95 p-4 pb-2 backdrop-blur-sm justify-between border-b border-white/10">
                    <button
                        onClick={onClose}
                        className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h2 className="text-white text-lg font-bold">
                        {t('contextComparison.title', 'Hjemme vs. Skole')}
                    </h2>
                    <div className="size-11" />
                </div>

                <div className="p-4 pt-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="liquid-glass-card p-6 rounded-3xl text-center"
                    >
                        <Info size={48} className="mx-auto text-slate-400 mb-4" />
                        <p className="text-white text-lg font-medium mb-2">
                            {t('contextComparison.notEnoughData', 'Ikke nok data')}
                        </p>
                        <p className="text-slate-400 text-sm">
                            {t('contextComparison.notEnoughDataDesc', 'Logg minst 5 hendelser i både hjemme- og skolekontekst for å se sammenligning.')}
                        </p>
                    </motion.div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-background-dark overflow-y-auto"
        >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center bg-background-dark/95 p-4 pb-2 backdrop-blur-sm justify-between border-b border-white/10">
                <button
                    onClick={onClose}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white"
                >
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-white text-lg font-bold">
                    {t('contextComparison.title', 'Hjemme vs. Skole')}
                </h2>
                <div className="size-11" />
            </div>

            <div className="p-4 pb-24 flex flex-col gap-4">
                {/* Tab Navigation */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('sideBySide')}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                            activeTab === 'sideBySide'
                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                    >
                        {t('contextComparison.sideBySide', 'Side om Side')}
                    </button>
                    <button
                        onClick={() => setActiveTab('differences')}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                            activeTab === 'differences'
                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                    >
                        {t('contextComparison.differences', 'Forskjeller')}
                        {comparison.significantDifferences.length > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-red-500/30 text-red-400 rounded-full text-xs">
                                {comparison.significantDifferences.length}
                            </span>
                        )}
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'sideBySide' ? (
                        <motion.div
                            key="sideBySide"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col gap-4"
                        >
                            {/* Context Cards */}
                            <div className="grid grid-cols-2 gap-3">
                                <ContextCard
                                    context="home"
                                    metrics={comparison.home}
                                    icon={<Home size={20} />}
                                    color="cyan"
                                />
                                <ContextCard
                                    context="school"
                                    metrics={comparison.school}
                                    icon={<School size={20} />}
                                    color="purple"
                                />
                            </div>

                            {/* Hourly Arousal Chart */}
                            {hourlyChartData.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="liquid-glass-card p-4 rounded-3xl"
                                >
                                    <div className="flex items-center gap-2 mb-4">
                                        <Activity size={18} className="text-primary" />
                                        <h3 className="text-white font-medium">
                                            {t('contextComparison.arousalByHour', 'Arousal per time')}
                                        </h3>
                                    </div>
                                    <ResponsiveContainer width="100%" height={180} debounce={50}>
                                        <LineChart data={hourlyChartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                            <XAxis
                                                dataKey="hour"
                                                stroke="#64748b"
                                                fontSize={10}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                domain={[0, 10]}
                                                stroke="#64748b"
                                                fontSize={10}
                                                tickLine={false}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#1e293b',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '12px'
                                                }}
                                            />
                                            <Legend />
                                            <Line
                                                type="monotone"
                                                dataKey="home"
                                                name="Hjemme"
                                                stroke="#06b6d4"
                                                strokeWidth={2}
                                                dot={false}
                                                connectNulls
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="school"
                                                name="Skole"
                                                stroke="#a855f7"
                                                strokeWidth={2}
                                                dot={false}
                                                connectNulls
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </motion.div>
                            )}

                            {/* Trigger Comparison */}
                            {triggerChartData.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="liquid-glass-card p-4 rounded-3xl"
                                >
                                    <div className="flex items-center gap-2 mb-4">
                                        <Zap size={18} className="text-orange-400" />
                                        <h3 className="text-white font-medium">
                                            {t('contextComparison.triggerComparison', 'Triggere sammenligning')}
                                        </h3>
                                    </div>
                                    <ResponsiveContainer width="100%" height={200} debounce={50}>
                                        <BarChart data={triggerChartData} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
                                            <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={10} />
                                            <YAxis
                                                type="category"
                                                dataKey="trigger"
                                                stroke="#64748b"
                                                fontSize={10}
                                                width={80}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#1e293b',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '12px'
                                                }}
                                                formatter={(value) => [`${value ?? 0}%`]}
                                            />
                                            <Bar dataKey="home" name="Hjemme" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                                            <Bar dataKey="school" name="Skole" fill="#a855f7" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </motion.div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="differences"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col gap-4"
                        >
                            {/* Summary */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="liquid-glass-card p-4 rounded-3xl"
                            >
                                <p className="text-slate-300 text-sm whitespace-pre-line">
                                    {summary}
                                </p>
                            </motion.div>

                            {/* Difference Cards */}
                            {comparison.significantDifferences.length > 0 ? (
                                comparison.significantDifferences.map((diff, index) => (
                                    <DifferenceCard key={index} difference={diff} index={index} />
                                ))
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="liquid-glass-card p-6 rounded-3xl text-center"
                                >
                                    <Target size={40} className="mx-auto text-green-400 mb-3" />
                                    <p className="text-white font-medium">
                                        {t('contextComparison.noSignificantDiff', 'Ingen vesentlige forskjeller')}
                                    </p>
                                    <p className="text-slate-400 text-sm mt-1">
                                        {t('contextComparison.patternsMatch', 'Mønstrene er relativt like i begge kontekster')}
                                    </p>
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface ContextCardProps {
    context: 'home' | 'school';
    metrics: ContextMetrics;
    icon: React.ReactNode;
    color: 'cyan' | 'purple';
}

function ContextCard({ context, metrics, icon, color }: ContextCardProps) {
    const { t } = useTranslation();

    const colorClasses = {
        cyan: {
            bg: 'bg-cyan-500/10',
            border: 'border-cyan-500/30',
            text: 'text-cyan-400',
            icon: 'bg-cyan-500/20'
        },
        purple: {
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/30',
            text: 'text-purple-400',
            icon: 'bg-purple-500/20'
        }
    };

    const classes = colorClasses[color];

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`${classes.bg} ${classes.border} border rounded-2xl p-4`}
        >
            <div className="flex items-center gap-2 mb-3">
                <div className={`p-2 rounded-xl ${classes.icon}`}>
                    <span className={classes.text}>{icon}</span>
                </div>
                <span className="text-white font-medium text-sm">
                    {context === 'home'
                        ? t('contextComparison.home', 'Hjemme')
                        : t('contextComparison.school', 'Skole')}
                </span>
            </div>

            <div className="space-y-2">
                <MetricRow
                    label={t('contextComparison.logs', 'Logger')}
                    value={metrics.logCount.toString()}
                />
                <MetricRow
                    label={t('contextComparison.avgArousal', 'Snitt arousal')}
                    value={metrics.avgArousal.toString()}
                    highlight={metrics.avgArousal >= 6}
                />
                <MetricRow
                    label={t('contextComparison.avgEnergy', 'Snitt energi')}
                    value={metrics.avgEnergy.toString()}
                    highlight={metrics.avgEnergy <= 4}
                    reverse
                />
                <MetricRow
                    label={t('contextComparison.crises', 'Kriser')}
                    value={metrics.crisisCount.toString()}
                    highlight={metrics.crisisCount > 0}
                />
            </div>
        </motion.div>
    );
}

interface MetricRowProps {
    label: string;
    value: string;
    highlight?: boolean;
    reverse?: boolean;
}

function MetricRow({ label, value, highlight, reverse }: MetricRowProps) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-slate-400 text-xs">{label}</span>
            <span className={`text-sm font-medium ${
                highlight
                    ? (reverse ? 'text-orange-400' : 'text-red-400')
                    : 'text-white'
            }`}>
                {value}
            </span>
        </div>
    );
}

interface DifferenceCardProps {
    difference: ContextDifference;
    index: number;
}

function DifferenceCard({ difference, index }: DifferenceCardProps) {
    const significanceColors = {
        high: 'border-red-500/30 bg-red-500/10',
        medium: 'border-orange-500/30 bg-orange-500/10',
        low: 'border-blue-500/30 bg-blue-500/10'
    };

    const significanceIcons = {
        high: <AlertTriangle size={18} className="text-red-400" />,
        medium: <TrendingUp size={18} className="text-orange-400" />,
        low: <TrendingDown size={18} className="text-blue-400" />
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`border rounded-2xl p-4 ${significanceColors[difference.significance]}`}
        >
            <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-white/10">
                    {significanceIcons[difference.significance]}
                </div>
                <div className="flex-1">
                    <p className="text-white text-sm font-medium">
                        {difference.insight}
                    </p>
                    {difference.homeValue !== '-' && difference.schoolValue !== '-' && (
                        <div className="flex gap-4 mt-2">
                            <span className="text-cyan-400 text-xs">
                                Hjemme: {difference.homeValue}
                            </span>
                            <span className="text-purple-400 text-xs">
                                Skole: {difference.schoolValue}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

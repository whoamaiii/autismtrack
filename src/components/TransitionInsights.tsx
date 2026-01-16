import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingDown, TrendingUp, Activity, HelpCircle, BarChart3, Calendar } from 'lucide-react';
import { useSchedule } from '../store';
import { calculateTransitionStats } from '../utils/transitionAnalysis';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const TransitionInsights: React.FC = () => {
    const { scheduleEntries } = useSchedule();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const stats = useMemo(() => {
        try {
            return calculateTransitionStats(scheduleEntries);
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Error calculating transition stats:', error);
            }
            return {
                overallAvgDifficulty: 0,
                totalTransitions: 0,
                hardestTransitions: [],
                easiestTransitions: [],
                effectiveSupports: [],
                recentDifficulties: []
            };
        }
    }, [scheduleEntries]);

    // Empty state: no transition data exists
    if (stats.totalTransitions === 0) {
        return (
            <div className="flex flex-col gap-6 px-4 py-4 min-h-screen pb-24">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center bg-background-dark/80 p-4 pb-2 backdrop-blur-sm justify-between rounded-b-xl -mx-4 -mt-4 mb-2 border-b border-white/10">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white"
                        aria-label={t('transitions.goBack')}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1 text-center">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent inline-block">
                            {t('transitions.analysis.title')}
                        </h1>
                    </div>
                    <div className="size-11"></div>
                </div>

                {/* Empty state content */}
                <div className="flex flex-col items-center justify-center text-center py-16">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center mb-6 shadow-lg"
                    >
                        <BarChart3 className="w-10 h-10 text-slate-400" />
                    </motion.div>
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-slate-300 text-xl font-semibold mb-3"
                    >
                        {t('transitions.emptyState.noData')}
                    </motion.p>
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-sm text-slate-500 max-w-xs leading-relaxed mb-6"
                    >
                        {t('transitions.emptyState.howToStart')}
                    </motion.p>
                    <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/schedule')}
                        className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                    >
                        <Calendar size={18} />
                        {t('transitions.emptyState.goToSchedule', 'Go to Schedule')}
                    </motion.button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 px-4 py-4 min-h-screen pb-24">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center bg-background-dark/80 p-4 pb-2 backdrop-blur-sm justify-between rounded-b-xl -mx-4 -mt-4 mb-2 border-b border-white/10">
                <button
                    onClick={() => navigate(-1)}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white"
                    aria-label={t('transitions.goBack')}
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1 text-center">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent inline-block">
                        {t('transitions.analysis.title')}
                    </h1>
                </div>
                <div className="size-11"></div>
            </div>

            <div className="space-y-6">

                {/* Stats Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="liquid-glass-card p-4 rounded-2xl"
                    >
                        <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                            <Activity size={14} />
                            <span>{t('transitions.stats.avgDifficulty')}</span>
                        </div>
                        <div className={`text-3xl font-bold ${stats.overallAvgDifficulty > 6 ? 'text-red-400' :
                            stats.overallAvgDifficulty > 3 ? 'text-yellow-400' : 'text-emerald-400'
                            }`}>
                            {stats.overallAvgDifficulty}
                            <span className="text-sm text-slate-500 font-normal ml-1">/ 10</span>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="liquid-glass-card p-4 rounded-2xl"
                    >
                        <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                            <TrendingUp size={14} />
                            <span>{t('transitions.stats.totalLogged')}</span>
                        </div>
                        <div className="text-3xl font-bold text-white">
                            {stats.totalTransitions}
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="liquid-glass-card p-4 rounded-2xl col-span-2"
                    >
                        <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                            <HelpCircle size={14} />
                            <span>{t('transitions.stats.mostEffective')}</span>
                        </div>
                        {stats.effectiveSupports.length > 0 ? (
                            <>
                                <div className="text-lg font-medium text-emerald-300 truncate">
                                    {stats.effectiveSupports[0].strategy}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    {t('transitions.stats.givesAvgDifficulty')} {stats.effectiveSupports[0].avgDifficultyWhenUsed}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col">
                                <div className="text-sm font-medium text-slate-400 truncate">
                                    {t('transitions.stats.noSupportsYet', 'No strategies recorded yet')}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    {t('transitions.stats.addSupportsHint', 'Add them when completing activities')}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>

                {/* Charts */}
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Hardest Transitions */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="liquid-glass-card p-6 rounded-3xl"
                    >
                        <h3 className="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
                            <TrendingDown className="text-red-400" size={20} />
                            {t('transitions.charts.hardest')}
                        </h3>
                        <div className="h-64 w-full">
                            {stats.hardestTransitions.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
                                    <BarChart data={stats.hardestTransitions} layout="vertical" margin={{ left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                                        <XAxis type="number" domain={[0, 10]} hide />
                                        <YAxis
                                            dataKey="activityName"
                                            type="category"
                                            width={100}
                                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Bar
                                            dataKey="avgDifficulty"
                                            fill="#fb7185"
                                            radius={[0, 4, 4, 0]}
                                            barSize={20}
                                            name={t('transitions.charts.difficulty')}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-500">
                                    {t('transitions.emptyState.noChartData')}
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Progress Over Time */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className="liquid-glass-card p-6 rounded-3xl"
                    >
                        <h3 className="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
                            <Activity className="text-blue-400" size={20} />
                            {t('transitions.charts.progressTitle')}
                        </h3>
                        <div className="h-64 w-full">
                            {stats.recentDifficulties.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
                                    <LineChart data={stats.recentDifficulties}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                        <XAxis dataKey="date" hide />
                                        <YAxis domain={[0, 10]} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="difficulty"
                                            stroke="#60a5fa"
                                            strokeWidth={3}
                                            dot={{ fill: '#60a5fa', r: 4 }}
                                            activeDot={{ r: 6, fill: '#fff' }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-500">
                                    {t('transitions.emptyState.noChartData')}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>

                {/* Effective Strategies List */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-4">{t('transitions.strategies.title')}</h3>
                    <div className="grid gap-4">
                        {stats.effectiveSupports.length > 0 ? stats.effectiveSupports.map((support, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                                        {i + 1}
                                    </div>
                                    <span className="font-medium text-emerald-100">{support.strategy}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-400">{t('transitions.strategies.avgDifficulty')}</div>
                                    <div className="text-lg font-bold text-emerald-400">{support.avgDifficultyWhenUsed}</div>
                                </div>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center text-center py-8 px-4 bg-slate-800/30 border border-slate-700/30 rounded-xl">
                                <HelpCircle size={32} className="text-slate-500 mb-3" />
                                <p className="text-slate-400 font-medium mb-1">
                                    {t('transitions.emptyState.noStrategies', 'No support strategies recorded')}
                                </p>
                                <p className="text-slate-500 text-sm">
                                    {t('transitions.emptyState.strategiesHint', 'When completing activities, add strategies used to help with transitions')}
                                </p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

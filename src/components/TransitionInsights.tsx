import React, { useMemo, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingDown, TrendingUp, Activity, HelpCircle } from 'lucide-react';
import { useSchedule } from '../store';
import { calculateTransitionStats } from '../utils/transitionAnalysis';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { useNavigate } from 'react-router-dom';

// SSR-safe hook to detect client-side mounting
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export const TransitionInsights: React.FC = () => {
    const { scheduleEntries } = useSchedule();
    const navigate = useNavigate();
    const isMounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

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

    return (
        <div className="flex flex-col gap-6 px-4 py-4 min-h-screen pb-24">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center bg-background-dark/80 p-4 pb-2 backdrop-blur-sm justify-between rounded-b-xl -mx-4 -mt-4 mb-2 border-b border-white/10">
                <button
                    onClick={() => navigate(-1)}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white"
                    aria-label="Gå tilbake"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1 text-center">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent inline-block">
                        Overgangsanalyse
                    </h1>
                </div>
                <div className="size-10"></div>
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
                            <span>Snitt Vanskelighet</span>
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
                            <span>Totalt Logget</span>
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
                            <span>Mest Effektive Støtte</span>
                        </div>
                        {stats.effectiveSupports.length > 0 ? (
                            <>
                                <div className="text-lg font-medium text-emerald-300 truncate">
                                    {stats.effectiveSupports[0].strategy}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    Gir snitt vanskelighet på {stats.effectiveSupports[0].avgDifficultyWhenUsed}
                                </div>
                            </>
                        ) : (
                            <div className="text-lg font-medium text-slate-500 truncate">
                                Ingen data
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
                            Mest Krevende Overganger
                        </h3>
                        <div className="h-64 w-full">
                            {isMounted && (
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
                                            name="Vanskelighet"
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
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
                            Utvikling over tid (Siste 14)
                        </h3>
                        <div className="h-64 w-full">
                            {isMounted && (
                                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
                                    <LineChart data={stats.recentDifficulties}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                        <XAxis dataKey="date" hide />
                                        <YAxis domain={[0, 10]} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
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
                    <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-4">Anbefalte Tiltak</h3>
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
                                    <div className="text-xs text-slate-400">Snitt Vanskelighet</div>
                                    <div className="text-lg font-bold text-emerald-400">{support.avgDifficultyWhenUsed}</div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-8 text-slate-500">
                                Ingen data om effektive tiltak enda. Prøv å logge støtte ved overganger.
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

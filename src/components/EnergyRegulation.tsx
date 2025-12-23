import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLogs } from '../store';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import {
    ArrowLeft,
    Battery,
    BatteryCharging,
    Zap,
    TrendingUp,
    Plus,
    Brain
} from 'lucide-react';
import { motion } from 'framer-motion';

export const EnergyRegulation: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { logs } = useLogs();

    // 1. Get Today's Logs for Energy Curve
    const todayLogs = useMemo(() => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        return logs
            .filter(log => new Date(log.timestamp) >= startOfDay)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [logs]);

    // 2. Current Energy / Spoons Calculation
    const currentStatus = useMemo(() => {
        if (todayLogs.length === 0) return { spoons: 0, energy: 0, trend: 0 };

        const latest = todayLogs[todayLogs.length - 1];
        // Map 1-10 energy -> 12 spoons (approx 1.2 per level)
        const spoons = Math.round(latest.energy * 1.2);

        // Calculate trend (vs first log of day)
        const first = todayLogs[0];
        const trend = first.energy > 0
            ? Math.round(((latest.energy - first.energy) / first.energy) * 100)
            : 0;

        return { spoons, energy: latest.energy, trend };
    }, [todayLogs]);

    // Format data for chart - memoized to prevent unnecessary recalculations
    const chartData = useMemo(() => todayLogs.map(log => ({
        time: format(new Date(log.timestamp), 'HH:mm'),
        energy: log.energy
    })), [todayLogs]);

    return (
        <div className="flex flex-col gap-6 px-4 py-4 min-h-screen pb-24">
            {/* Top App Bar */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky top-0 z-10 flex items-center bg-background-dark/80 p-4 pb-2 backdrop-blur-sm justify-between rounded-b-xl -mx-4 -mt-4 mb-2 border-b border-white/10"
            >
                <button onClick={() => navigate(-1)} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white" aria-label={t('energyRegulation.goBack')}>
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">{t('energyRegulation.title')}</h2>
                <div className="flex w-10 items-center justify-end">
                    {/* Placeholder */}
                </div>
            </motion.div>

            <div className="flex flex-col gap-6">
                {/* Spoon Battery */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="liquid-glass-card p-6 rounded-3xl"
                >
                    <div className="flex gap-6 justify-between items-center mb-4">
                        <div className="flex items-center gap-2 text-green-400">
                            <BatteryCharging size={24} />
                            <p className="text-lg font-bold text-white">{t('energyRegulation.spoonsTitle')}</p>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30">
                            <p className="text-green-400 text-sm font-bold">
                                {todayLogs.length > 0 ? t('energyRegulation.spoonsCount', { count: currentStatus.spoons }) : t('energyRegulation.noData')}
                            </p>
                        </div>
                    </div>

                    <div className="relative h-6 bg-black/20 rounded-full overflow-hidden border border-white/10">
                        {/* Spoon segments (visual only) */}
                        <div className="absolute inset-0 z-10 flex w-full">
                            {[...Array(12)].map((_, i) => (
                                <div key={i} className="flex-1 border-r border-slate-900/30 last:border-0 h-full"></div>
                            ))}
                        </div>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(currentStatus.spoons / 12 * 100, 100)}%` }}
                            transition={{ duration: 1, type: "spring" }}
                            className={`h-full relative ${currentStatus.spoons < 4 ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-green-500 to-emerald-400'}`}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </motion.div>
                    </div>
                    <p className="text-slate-400 text-sm mt-3 flex items-center gap-2">
                        <Zap size={14} className={currentStatus.energy < 4 ? 'text-red-400' : 'text-yellow-400'} />
                        {t('energyRegulation.basedOn', { level: currentStatus.energy })}
                    </p>
                </motion.div>

                {/* Energy Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="liquid-glass-card p-6 rounded-3xl h-[360px] flex flex-col"
                >
                    <div className="flex flex-col gap-1 mb-6">
                        <div className="flex items-center gap-2 text-blue-400 mb-1">
                            <TrendingUp size={18} />
                            <span className="text-xs font-bold uppercase tracking-wider">{t('energyRegulation.energyCurve')}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <p className="text-white text-3xl font-bold leading-none tracking-tight">
                                {currentStatus.energy >= 7 ? t('energyRegulation.levelHigh') : currentStatus.energy >= 4 ? t('energyRegulation.levelModerate') : t('energyRegulation.levelLow')}
                            </p>
                            {currentStatus.trend !== 0 && (
                                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${currentStatus.trend > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    <span className="text-sm font-bold">{currentStatus.trend > 0 ? '+' : ''}{currentStatus.trend}% {t('energyRegulation.today')}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div
                        className="flex-1 w-full -ml-4"
                        role="img"
                        aria-label={t('energyRegulation.chartDescription', { count: todayLogs.length })}
                    >
                        {todayLogs.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis
                                        dataKey="time"
                                        stroke="#64748b"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: '#64748b' }}
                                    />
                                    <YAxis
                                        domain={[0, 10]}
                                        stroke="#64748b"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: '#64748b' }}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontWeight: 'bold' }}
                                        itemStyle={{ color: '#10b981' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="energy"
                                        stroke="#10b981"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorEnergy)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                                <Battery size={32} className="opacity-30" />
                                <span className="font-medium">{t('energyRegulation.noDataToday')}</span>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* AI Insights Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="liquid-glass-card p-5 rounded-3xl border border-primary/30 bg-primary/5"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-xl bg-primary/20 text-primary">
                            <Brain size={20} />
                        </div>
                        <h3 className="text-white font-bold text-lg">{t('energyRegulation.insights')}</h3>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">
                        {todayLogs.length > 0
                            ? t('energyRegulation.insightWithData')
                            : t('energyRegulation.insightNoData')}
                    </p>
                </motion.div>
            </div>

            {/* Floating Action Button */}
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate('/log')}
                className="fixed bottom-6 right-6 size-14 bg-gradient-to-br from-primary to-blue-600 rounded-full shadow-lg shadow-primary/40 flex items-center justify-center z-20 text-white"
                aria-label={t('energyRegulation.logEvent')}
            >
                <Plus size={32} />
            </motion.button>
        </div>
    );
};

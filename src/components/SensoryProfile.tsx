import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogs } from '../store';
import {
    ArrowLeft,
    Eye,
    Activity,
    AlertTriangle,
    Info,
    Brain,
    Lightbulb
} from 'lucide-react';
import { motion } from 'framer-motion';

export const SensoryProfile: React.FC = () => {
    const navigate = useNavigate();
    const { logs } = useLogs();
    const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('month');

    // Filter logs based on time range
    const filteredLogs = useMemo(() => {
        const now = new Date();
        const start = new Date();
        if (timeRange === 'today') start.setHours(0, 0, 0, 0);
        if (timeRange === 'week') start.setDate(now.getDate() - 7);
        if (timeRange === 'month') start.setMonth(now.getMonth() - 1);

        return logs.filter(log => new Date(log.timestamp) >= start);
    }, [logs, timeRange]);

    // Calculate sensory stats
    const stats = useMemo(() => {
        const triggerCounts: Record<string, number> = {};
        const arousalCorrelations: Record<string, number> = {};
        const totalLogs = filteredLogs.length;

        if (totalLogs === 0) return null;

        filteredLogs.forEach(log => {
            log.sensoryTriggers.forEach(trigger => {
                triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;

                if (log.arousal >= 7) {
                    arousalCorrelations[trigger] = (arousalCorrelations[trigger] || 0) + 1;
                }
            });
        });

        const highArousalLogs = filteredLogs.filter(l => l.arousal >= 7).length;

        return {
            triggerCounts,
            arousalCorrelations,
            totalLogs,
            highArousalLogs
        };
    }, [filteredLogs]);

    // Format data for Radar Chart
    const chartData = useMemo(() => {
        if (!stats) return { points: "150,150 150,150 150,150 150,150 150,150", values: {} };

        // Map specific Norwegian triggers to chart axes
        const axes = [
            { id: 'Visuell', triggers: ['Visuell', 'Lys'] },
            { id: 'Auditiv', triggers: ['Auditiv'] },
            { id: 'Taktil', triggers: ['Taktil', 'Temperatur'] },
            { id: 'Vestibulær', triggers: ['Vestibulær'] },
            { id: 'Interosepsjon', triggers: ['Interosepsjon', 'Sult', 'Tørst'] }
        ];

        const center = 150;
        const radius = 100; // max radius
        const maxCount = Math.max(...Object.values(stats.triggerCounts), 5); // Avoid division by zero, min scale 5

        const coordinates = axes.map((axis, i) => {
            const angle = (Math.PI * 2 * i) / 5 - (Math.PI / 2); // Start at top

            // Sum counts for triggers in this axis category
            const count = axis.triggers.reduce((sum, t) => sum + (stats.triggerCounts[t as string] || 0), 0);
            const normalizedValue = Math.min((count / maxCount), 1); // Cap at 1.0
            const distance = normalizedValue * radius;

            const x = center + Math.cos(angle) * distance;
            const y = center + Math.sin(angle) * distance;

            return { x, y, value: count, label: axis.id };
        });

        const points = coordinates.map(c => `${c.x},${c.y}`).join(' ');

        return { points, coordinates, maxCount };
    }, [stats]);

    // Derive Insights
    const insights = useMemo(() => {
        if (!stats) return [];

        const result = [];

        // 1. Most Frequent Trigger
        const topTrigger = Object.entries(stats.triggerCounts)
            .sort(([, a], [, b]) => b - a)[0];

        if (topTrigger) {
            result.push({
                icon: <Eye size={24} />,
                title: 'Hyppigste Trigger',
                text: `${topTrigger[0]} forekommer i ${Math.round(topTrigger[1] / stats.totalLogs * 100)}% av loggene.`,
                color: 'text-primary',
                bg: 'bg-primary/20',
                ring: 'ring-primary/30'
            });
        }

        // 2. High Arousal Correlation
        const topCorrelation = Object.entries(stats.arousalCorrelations)
            .sort(([, a], [, b]) => b - a)[0];

        if (topCorrelation && stats.highArousalLogs > 0) {
            const percentage = Math.round(topCorrelation[1] / stats.highArousalLogs * 100);
            if (percentage > 50) { // Only show if significant
                result.push({
                    icon: <AlertTriangle size={24} />,
                    title: 'Høy Stress-kobling',
                    text: `${topCorrelation[0]} er tilstede i ${percentage}% av tilfeller med høy arousal.`,
                    color: 'text-orange-400',
                    bg: 'bg-orange-500/20',
                    ring: 'ring-orange-500/30'
                });
            }
        }

        // 3. Fallback / General
        if (result.length < 2) {
            result.push({
                icon: <Info size={24} />,
                title: 'Logg Mer Data',
                text: 'Mer data trengs for å identifisere tydelige sensoriske mønstre.',
                color: 'text-blue-400',
                bg: 'bg-blue-500/20',
                ring: 'ring-blue-500/30'
            });
        }

        return result;
    }, [stats]);

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
                <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Sensorisk Profil</h2>
                <div className="size-10"></div>
            </motion.div>

            {/* Content */}
            <div className="flex flex-col gap-4">
                {/* Date Filter Chips */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-2"
                >
                    {[
                        { id: 'today', label: 'I Dag' },
                        { id: 'week', label: 'Denne Uken' },
                        { id: 'month', label: 'Denne Måneden' }
                    ].map(period => (
                        <button
                            key={period.id}
                            onClick={() => setTimeRange(period.id as 'today' | 'week' | 'month')}
                            className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-xl px-4 text-sm font-bold transition-all
                                ${timeRange === period.id
                                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                    : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'}`}
                        >
                            {period.label}
                        </button>
                    ))}
                </motion.div>

                {/* Radar Chart Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="liquid-glass-card rounded-3xl p-6"
                >
                    <div className="flex flex-col gap-1 mb-4">
                        <div className="flex items-center gap-2 text-primary mb-1">
                            <Activity size={18} />
                            <span className="text-xs font-bold uppercase tracking-wider">Radar</span>
                        </div>
                        <h2 className="text-white text-2xl font-bold">
                            {stats ? 'Aktive Mønstre' : 'Ingen Data'}
                        </h2>
                    </div>

                    {/* Radar Chart SVG */}
                    <div className="relative flex items-center justify-center min-h-[300px]">
                        <svg className="absolute inset-0" height="100%" viewBox="0 0 300 300" width="100%">
                            {/* Grid/Polygons */}
                            {[50, 75, 100].map((r, i) => (
                                <polygon
                                    key={i}
                                    fill="none"
                                    points="150,50 235,112 202,212 97,212 64,112" // rough pentagon
                                    stroke="rgba(255,255,255,0.1)"
                                    strokeWidth="1"
                                    transform={`scale(${r / 100})`}
                                    style={{ transformOrigin: '150px 150px' }}
                                />
                            ))}

                            {/* Axis Lines */}
                            {[0, 72, 144, 216, 288].map(deg => (
                                <line
                                    key={deg}
                                    x1="150" y1="150"
                                    x2={150 + 100 * Math.cos((deg - 90) * Math.PI / 180)}
                                    y2={150 + 100 * Math.sin((deg - 90) * Math.PI / 180)}
                                    stroke="rgba(255,255,255,0.1)"
                                    strokeWidth="1"
                                />
                            ))}

                            {/* Data Polygon */}
                            {stats && (
                                <motion.polygon
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 1, type: "spring" }}
                                    fill="rgba(43, 108, 238, 0.3)"
                                    points={chartData.points}
                                    stroke="#3b82f6"
                                    strokeWidth="2"
                                    strokeLinejoin="round"
                                />
                            )}

                            {/* Data Points */}
                            {chartData.coordinates?.map((c, i) => (
                                <motion.circle
                                    key={i}
                                    initial={{ r: 0 }}
                                    animate={{ r: 4 }}
                                    transition={{ delay: 0.5 + i * 0.1 }}
                                    cx={c.x} cy={c.y}
                                    fill="#3b82f6"
                                    stroke="white" strokeWidth="2"
                                />
                            ))}
                        </svg>

                        {/* Labels (Manually positioned for Pentagon) */}
                        <div className="absolute top-0 text-center -mt-4"><p className="text-white text-xs font-bold bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">Visuell</p></div>
                        <div className="absolute top-[30%] right-[-10px]"><p className="text-white text-xs font-bold bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">Auditiv</p></div>
                        <div className="absolute bottom-[10%] right-[5%]"><p className="text-white text-xs font-bold bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">Taktil</p></div>
                        <div className="absolute bottom-[10%] left-[5%]"><p className="text-white text-xs font-bold bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">Vestibulær</p></div>
                        <div className="absolute top-[30%] left-[-10px]"><p className="text-white text-xs font-bold bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">Interosepsjon</p></div>
                    </div>
                </motion.div>

                {/* Dynamic AI Insights Section */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 px-2 mt-2">
                        <Brain className="text-purple-400" size={20} />
                        <h3 className="text-white text-lg font-bold">Mønsterinnsikt</h3>
                    </div>

                    {insights.length > 0 ? (
                        insights.map((insight, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + idx * 0.1 }}
                                className={`flex items-start gap-4 p-5 rounded-3xl border border-white/5 backdrop-blur-xl ${insight.bg} ${insight.ring || ''} ring-1`}
                            >
                                <div className={`p-3 rounded-2xl bg-white/10 ${insight.color}`}>
                                    {insight.icon}
                                </div>
                                <div className="flex-1">
                                    <p className="text-white font-bold text-lg mb-1">{insight.title}</p>
                                    <p className="text-white/70 text-sm leading-relaxed">{insight.text}</p>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="p-8 text-center text-slate-500 bg-white/5 rounded-3xl border border-white/10 border-dashed">
                            <motion.div
                                animate={{ y: [0, -5, 0] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="inline-block mb-2"
                            >
                                <Lightbulb size={32} className="opacity-50" />
                            </motion.div>
                            <p className="font-medium">Ingen data registrert for denne perioden.</p>
                            <p className="text-xs mt-1 text-slate-600">Logg hendelser med sensoriske triggere for å se innsikt her.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

import React, { useMemo, useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useLogs } from '../store';
// Note: useNavigate removed - now using BackButton component
import {
    Eye,
    Activity,
    AlertTriangle,
    Info,
    Brain,
    Lightbulb
} from 'lucide-react';
import { BackButton } from './BackButton';
import { motion } from 'framer-motion';
import { translateTrigger } from '../utils/translateDomain';

// Constants for hexagon chart
const NUM_AXES = 6;
const CENTER = 150;
const RADIUS = 100;
const LABEL_RADIUS = 125;

// Map trigger keys to axis translation keys
const AXIS_CONFIG = [
    { key: 'visual', triggers: ['Visuell', 'Lys'] },
    { key: 'auditory', triggers: ['Auditiv'] },
    { key: 'tactile', triggers: ['Taktil', 'Temperatur', 'Trengsel'] },
    { key: 'vestibular', triggers: ['Vestibulær'] },
    { key: 'interoception', triggers: ['Interosepsjon', 'Sult', 'Tørst'] },
    { key: 'chemical', triggers: ['Lukt', 'Smak'] }
];

// Calculate position on hexagon at given index
const getHexagonPoint = (index: number, radius: number): { x: number; y: number } => {
    const angle = (2 * Math.PI * index) / NUM_AXES - Math.PI / 2;
    return {
        x: CENTER + Math.cos(angle) * radius,
        y: CENTER + Math.sin(angle) * radius
    };
};

// Generate hexagon polygon points at given scale
const getHexagonPoints = (scale: number): string => {
    return Array.from({ length: NUM_AXES }, (_, i) => {
        const { x, y } = getHexagonPoint(i, RADIUS * scale);
        return `${x},${y}`;
    }).join(' ');
};

// Get text-anchor based on position angle
const getTextAnchor = (index: number): 'start' | 'middle' | 'end' => {
    const angle = (2 * Math.PI * index) / NUM_AXES - Math.PI / 2;
    const x = Math.cos(angle);
    if (Math.abs(x) < 0.1) return 'middle'; // top or bottom
    return x > 0 ? 'start' : 'end';
};

// Get vertical alignment offset
const getDominantBaseline = (index: number): 'hanging' | 'middle' | 'auto' => {
    const angle = (2 * Math.PI * index) / NUM_AXES - Math.PI / 2;
    const y = Math.sin(angle);
    if (y < -0.5) return 'auto'; // top
    if (y > 0.5) return 'hanging'; // bottom
    return 'middle';
};

export const SensoryProfile: React.FC = () => {
    const { t } = useTranslation();
    const { logs } = useLogs();
    const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('month');
    const chartTitleId = useId();
    const chartDescId = useId();

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

    // Format data for Radar Chart (hexagon)
    const chartData = useMemo(() => {
        // Return empty state indicator when no data
        if (!stats || Object.keys(stats.triggerCounts).length === 0) {
            return { isEmpty: true, points: '', coordinates: [], maxCount: 0 };
        }

        const maxCount = Math.max(...Object.values(stats.triggerCounts), 5);

        const coordinates = AXIS_CONFIG.map((axis, i) => {
            const angle = (Math.PI * 2 * i) / NUM_AXES - (Math.PI / 2);

            // Sum counts for triggers in this axis category
            const count = axis.triggers.reduce((sum, trigger) => sum + (stats.triggerCounts[trigger] || 0), 0);
            const normalizedValue = Math.min((count / maxCount), 1);
            const distance = normalizedValue * RADIUS;

            const x = CENTER + Math.cos(angle) * distance;
            const y = CENTER + Math.sin(angle) * distance;

            return { x, y, value: count, axisKey: axis.key };
        });

        const points = coordinates.map(c => `${c.x},${c.y}`).join(' ');

        return { isEmpty: false, points, coordinates, maxCount };
    }, [stats]);

    // Derive Insights
    const insights = useMemo(() => {
        if (!stats) return [];

        const result = [];

        // 1. Most Frequent Trigger
        const topTrigger = Object.entries(stats.triggerCounts)
            .sort(([, a], [, b]) => b - a)[0];

        if (topTrigger) {
            const percentage = Math.round(topTrigger[1] / stats.totalLogs * 100);
            result.push({
                icon: <Eye size={24} />,
                title: t('sensoryProfile.insights.mostFrequent'),
                text: t('sensoryProfile.insights.mostFrequentText', { trigger: translateTrigger(topTrigger[0]), percentage }),
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
            if (percentage > 50) {
                result.push({
                    icon: <AlertTriangle size={24} />,
                    title: t('sensoryProfile.insights.highStress'),
                    text: t('sensoryProfile.insights.highStressText', { trigger: translateTrigger(topCorrelation[0]), percentage }),
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
                title: t('sensoryProfile.insights.logMoreData'),
                text: t('sensoryProfile.insights.logMoreDataText'),
                color: 'text-blue-400',
                bg: 'bg-blue-500/20',
                ring: 'ring-blue-500/30'
            });
        }

        return result;
    }, [stats, t]);

    return (
        <div className="flex flex-col gap-6 px-4 py-4 min-h-screen pb-24">
            {/* Top App Bar */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky top-0 z-10 flex items-center bg-background-dark/80 p-4 pb-2 backdrop-blur-sm justify-between rounded-b-xl -mx-4 -mt-4 mb-2 border-b border-white/10"
            >
                <BackButton className="size-10 shrink-0" />
                <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
                    {t('sensoryProfile.title')}
                </h2>
                <div className="size-10"></div>
            </motion.div>

            {/* Content */}
            <div className="flex flex-col gap-4">
                {/* Date Filter Chips */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-2"
                    role="group"
                    aria-label={t('sensoryProfile.title')}
                >
                    {[
                        { id: 'today', label: t('sensoryProfile.today') },
                        { id: 'week', label: t('sensoryProfile.thisWeek') },
                        { id: 'month', label: t('sensoryProfile.thisMonth') }
                    ].map(period => (
                        <button
                            key={period.id}
                            onClick={() => setTimeRange(period.id as 'today' | 'week' | 'month')}
                            aria-pressed={timeRange === period.id}
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
                            <span className="text-xs font-bold uppercase tracking-wider">{t('sensoryProfile.radar')}</span>
                        </div>
                        <h2 className="text-white text-2xl font-bold">
                            {stats ? t('sensoryProfile.activePatterns') : t('sensoryProfile.noData')}
                        </h2>
                    </div>

                    {/* Radar Chart SVG */}
                    <div className="relative flex items-center justify-center min-h-[300px]" aria-live="polite">
                        <svg
                            className="w-full h-full max-w-[380px] max-h-[300px]"
                            viewBox="-40 0 380 300"
                            role="img"
                            aria-labelledby={`${chartTitleId} ${chartDescId}`}
                        >
                            <title id={chartTitleId}>{t('sensoryProfile.radar')}</title>
                            <desc id={chartDescId}>{t('sensoryProfile.chartDescription')}</desc>

                            {/* Gradient definitions for filled polygon */}
                            <defs>
                                <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="#A855F7" stopOpacity="0.3" />
                                </linearGradient>
                                <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#00D4FF" />
                                    <stop offset="100%" stopColor="#A855F7" />
                                </linearGradient>
                            </defs>

                            {/* Grid Hexagons (decorative) */}
                            <g aria-hidden="true">
                                {[0.5, 0.75, 1].map((scale, i) => (
                                    <polygon
                                        key={i}
                                        fill="none"
                                        points={getHexagonPoints(scale)}
                                        stroke="rgba(255,255,255,0.1)"
                                        strokeWidth="1"
                                    />
                                ))}

                                {/* Axis Lines */}
                                {Array.from({ length: NUM_AXES }, (_, i) => {
                                    const { x, y } = getHexagonPoint(i, RADIUS);
                                    return (
                                        <line
                                            key={i}
                                            x1={CENTER}
                                            y1={CENTER}
                                            x2={x}
                                            y2={y}
                                            stroke="rgba(255,255,255,0.1)"
                                            strokeWidth="1"
                                        />
                                    );
                                })}
                            </g>

                            {/* Data Polygon with gradient fill */}
                            {!chartData.isEmpty && (
                                <motion.polygon
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 1, type: "spring" }}
                                    style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
                                    fill="url(#radarGradient)"
                                    points={chartData.points}
                                    stroke="url(#radarStroke)"
                                    strokeWidth="2"
                                    strokeLinejoin="round"
                                />
                            )}

                            {/* Data Points with gradient color */}
                            {!chartData.isEmpty && chartData.coordinates.map((c, i) => (
                                <motion.circle
                                    key={i}
                                    initial={{ r: 0 }}
                                    animate={{ r: 5 }}
                                    transition={{ delay: 0.5 + i * 0.1 }}
                                    cx={c.x}
                                    cy={c.y}
                                    fill={i < 3 ? '#00D4FF' : '#A855F7'}
                                    stroke="white"
                                    strokeWidth="2"
                                    aria-label={`${t(`sensoryProfile.axes.${c.axisKey}`)}: ${c.value}`}
                                />
                            ))}

                            {/* Labels positioned dynamically */}
                            {AXIS_CONFIG.map((axis, i) => {
                                const { x, y } = getHexagonPoint(i, LABEL_RADIUS);
                                return (
                                    <text
                                        key={axis.key}
                                        x={x}
                                        y={y}
                                        textAnchor={getTextAnchor(i)}
                                        dominantBaseline={getDominantBaseline(i)}
                                        className="fill-white text-xs font-bold"
                                        style={{
                                            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))',
                                            fontSize: '11px'
                                        }}
                                    >
                                        {t(`sensoryProfile.axes.${axis.key}`)}
                                    </text>
                                );
                            })}
                        </svg>

                        {/* Empty state overlay */}
                        {chartData.isEmpty && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <p className="text-slate-400 text-sm text-center px-8">
                                    {t('sensoryProfile.noDataForPeriod')}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Legend */}
                    {!chartData.isEmpty && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                {AXIS_CONFIG.map((axis, i) => {
                                    const count = chartData.coordinates[i]?.value ?? 0;
                                    return (
                                        <div key={axis.key} className="flex items-center gap-2">
                                            <span
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: i < 3 ? '#00D4FF' : '#A855F7' }}
                                            />
                                            <span className="text-slate-300 truncate">
                                                {t(`sensoryProfile.axes.${axis.key}`)}
                                            </span>
                                            <span className="text-slate-500 ml-auto">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Dynamic AI Insights Section */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 px-2 mt-2">
                        <Brain className="text-purple-400" size={20} />
                        <h3 className="text-white text-lg font-bold">{t('sensoryProfile.patternInsights')}</h3>
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
                            <p className="font-medium">{t('sensoryProfile.noDataForPeriod')}</p>
                            <p className="text-xs mt-1 text-slate-600">{t('sensoryProfile.logEventsHint')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

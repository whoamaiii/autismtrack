import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLogs, useCrisis } from '../store';
import { ArrowLeft, Info, AlertTriangle, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

// Time blocks for the heatmap (Norwegian labels)
const TIME_BLOCKS = [
    { id: 'morning', label: '06-09', start: 6, end: 9 },
    { id: 'late_morning', label: '09-12', start: 9, end: 12 },
    { id: 'midday', label: '12-15', start: 12, end: 15 },
    { id: 'afternoon', label: '15-18', start: 15, end: 18 },
    { id: 'evening', label: '18-21', start: 18, end: 21 },
] as const;

// Days of the week (Norwegian)
const DAYS = [
    { id: 'monday', label: 'Man', fullLabel: 'Mandag' },
    { id: 'tuesday', label: 'Tir', fullLabel: 'Tirsdag' },
    { id: 'wednesday', label: 'Ons', fullLabel: 'Onsdag' },
    { id: 'thursday', label: 'Tor', fullLabel: 'Torsdag' },
    { id: 'friday', label: 'Fre', fullLabel: 'Fredag' },
    { id: 'saturday', label: 'Lør', fullLabel: 'Lørdag' },
    { id: 'sunday', label: 'Søn', fullLabel: 'Søndag' },
] as const;

interface HeatmapCell {
    day: string;
    timeBlock: string;
    avgArousal: number;
    logCount: number;
    crisisCount: number;
    maxArousal: number;
}

// Get color based on arousal level
const getArousalColor = (arousal: number, logCount: number): string => {
    if (logCount === 0) return 'bg-slate-800/30';

    if (arousal <= 3) return 'bg-emerald-500/70';
    if (arousal <= 4) return 'bg-emerald-400/70';
    if (arousal <= 5) return 'bg-yellow-400/70';
    if (arousal <= 6) return 'bg-orange-400/70';
    if (arousal <= 7) return 'bg-orange-500/70';
    if (arousal <= 8) return 'bg-red-400/70';
    return 'bg-red-600/80';
};

// Get emoji based on arousal
const getArousalEmoji = (arousal: number, logCount: number): string => {
    if (logCount === 0) return '·';
    if (arousal <= 3) return '😊';
    if (arousal <= 5) return '😐';
    if (arousal <= 7) return '😟';
    return '😰';
};

export const DysregulationHeatmap: React.FC = () => {
    const { logs } = useLogs();
    const { crisisEvents } = useCrisis();

    // Process logs and crisis events into heatmap data
    const heatmapData = useMemo(() => {
        const cellMap = new Map<string, HeatmapCell>();

        // Initialize all cells
        DAYS.forEach(day => {
            TIME_BLOCKS.forEach(block => {
                const key = `${day.id}-${block.id}`;
                cellMap.set(key, {
                    day: day.id,
                    timeBlock: block.id,
                    avgArousal: 0,
                    logCount: 0,
                    crisisCount: 0,
                    maxArousal: 0,
                });
            });
        });

        // Process logs
        logs.forEach(log => {
            const date = new Date(log.timestamp);
            const hour = date.getHours();
            const dayOfWeek = date.getDay();

            // Map JS day (0=Sunday) to our DAYS array
            const dayId = DAYS[(dayOfWeek + 6) % 7]?.id; // Convert to Monday-first

            // Find matching time block
            const timeBlock = TIME_BLOCKS.find(b => hour >= b.start && hour < b.end);
            if (!dayId || !timeBlock) return;

            const key = `${dayId}-${timeBlock.id}`;
            const cell = cellMap.get(key);
            if (cell) {
                const totalArousal = cell.avgArousal * cell.logCount + log.arousal;
                cell.logCount += 1;
                cell.avgArousal = totalArousal / cell.logCount;
                cell.maxArousal = Math.max(cell.maxArousal, log.arousal);
            }
        });

        // Process crisis events
        crisisEvents.forEach(event => {
            const date = new Date(event.timestamp);
            const hour = date.getHours();
            const dayOfWeek = date.getDay();

            const dayId = DAYS[(dayOfWeek + 6) % 7]?.id;
            const timeBlock = TIME_BLOCKS.find(b => hour >= b.start && hour < b.end);
            if (!dayId || !timeBlock) return;

            const key = `${dayId}-${timeBlock.id}`;
            const cell = cellMap.get(key);
            if (cell) {
                cell.crisisCount += 1;
            }
        });

        return cellMap;
    }, [logs, crisisEvents]);

    // Find hotspots (highest arousal periods)
    const hotspots = useMemo(() => {
        const cells = Array.from(heatmapData.values())
            .filter(c => c.logCount >= 2)
            .sort((a, b) => b.avgArousal - a.avgArousal)
            .slice(0, 3);

        return cells.map(cell => {
            const day = DAYS.find(d => d.id === cell.day);
            const block = TIME_BLOCKS.find(b => b.id === cell.timeBlock);
            return {
                ...cell,
                dayLabel: day?.fullLabel || cell.day,
                timeLabel: block?.label || cell.timeBlock,
            };
        });
    }, [heatmapData]);

    // Overall statistics
    const stats = useMemo(() => {
        const allCells = Array.from(heatmapData.values()).filter(c => c.logCount > 0);
        if (allCells.length === 0) return null;

        const avgArousal = allCells.reduce((sum, c) => sum + c.avgArousal * c.logCount, 0) /
            allCells.reduce((sum, c) => sum + c.logCount, 0);
        const totalCrises = allCells.reduce((sum, c) => sum + c.crisisCount, 0);
        const totalLogs = allCells.reduce((sum, c) => sum + c.logCount, 0);

        return {
            avgArousal: avgArousal.toFixed(1),
            totalCrises,
            totalLogs,
        };
    }, [heatmapData]);

    return (
        <div className="flex flex-col gap-6 py-6">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center bg-background-dark/80 p-4 pb-2 backdrop-blur-sm justify-between rounded-b-xl -mx-4 -mt-4 mb-2 border-b border-white/10">
                <Link to="/" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white" aria-label="Gå tilbake">
                    <ArrowLeft size={20} />
                </Link>
                <h1 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Dysreguleringskart</h1>
                <div className="size-10"></div>
            </div>

            {/* Stats Overview */}
            {stats && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-3 gap-3"
                >
                    <div className="liquid-glass-card p-4 rounded-2xl text-center">
                        <p className="text-2xl font-bold text-white">{stats.avgArousal}</p>
                        <p className="text-xs text-slate-400">Snitt Arousal</p>
                    </div>
                    <div className="liquid-glass-card p-4 rounded-2xl text-center">
                        <p className="text-2xl font-bold text-white">{stats.totalLogs}</p>
                        <p className="text-xs text-slate-400">Logger</p>
                    </div>
                    <div className="liquid-glass-card p-4 rounded-2xl text-center">
                        <p className="text-2xl font-bold text-red-400">{stats.totalCrises}</p>
                        <p className="text-xs text-slate-400">Kriser</p>
                    </div>
                </motion.div>
            )}

            {/* Heatmap Grid */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="liquid-glass-card p-4 rounded-3xl"
            >
                <div className="flex items-center gap-2 mb-4">
                    <Info size={16} className="text-slate-400" />
                    <p className="text-slate-400 text-xs">Trykk på en celle for detaljer</p>
                </div>

                {/* Grid Header - Days */}
                <div className="grid grid-cols-8 gap-1 mb-1">
                    <div className="h-8" /> {/* Empty corner */}
                    {DAYS.map(day => (
                        <div key={day.id} className="h-8 flex items-center justify-center">
                            <span className="text-xs font-medium text-slate-300">{day.label}</span>
                        </div>
                    ))}
                </div>

                {/* Grid Rows - Time blocks */}
                {TIME_BLOCKS.map(block => (
                    <div key={block.id} className="grid grid-cols-8 gap-1 mb-1">
                        {/* Time label */}
                        <div className="h-12 flex items-center justify-end pr-2">
                            <span className="text-xs text-slate-400">{block.label}</span>
                        </div>

                        {/* Day cells */}
                        {DAYS.map(day => {
                            const key = `${day.id}-${block.id}`;
                            const cell = heatmapData.get(key);
                            const arousal = cell?.avgArousal || 0;
                            const count = cell?.logCount || 0;
                            const crises = cell?.crisisCount || 0;

                            return (
                                <motion.div
                                    key={key}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={`
                                        h-12 rounded-lg flex flex-col items-center justify-center cursor-pointer
                                        transition-all relative
                                        ${getArousalColor(arousal, count)}
                                        ${crises > 0 ? 'ring-2 ring-red-500' : ''}
                                    `}
                                    title={count > 0 ? `Snitt: ${arousal.toFixed(1)}, Logger: ${count}` : 'Ingen data'}
                                >
                                    <span className="text-sm">{getArousalEmoji(arousal, count)}</span>
                                    {count > 0 && (
                                        <span className="text-[10px] text-white/80">{arousal.toFixed(1)}</span>
                                    )}
                                    {crises > 0 && (
                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                            <span className="text-[8px] text-white font-bold">{crises}</span>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                ))}

                {/* Legend */}
                <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs text-slate-400 mb-2">Arousal-nivå:</p>
                    <div className="flex items-center gap-1">
                        <div className="flex-1 h-4 rounded bg-emerald-500/70" />
                        <div className="flex-1 h-4 rounded bg-yellow-400/70" />
                        <div className="flex-1 h-4 rounded bg-orange-500/70" />
                        <div className="flex-1 h-4 rounded bg-red-600/80" />
                    </div>
                    <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-slate-500">Lav (1-3)</span>
                        <span className="text-[10px] text-slate-500">Høy (8-10)</span>
                    </div>
                </div>
            </motion.div>

            {/* Hotspots */}
            {hotspots.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="liquid-glass-card p-4 rounded-3xl"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle size={18} className="text-orange-400" />
                        <h2 className="text-lg font-bold text-white">Sårbare Tidspunkt</h2>
                    </div>
                    <div className="space-y-3">
                        {hotspots.map((spot) => (
                            <div
                                key={`${spot.day}-${spot.timeBlock}`}
                                className="flex items-center justify-between p-3 rounded-xl bg-white/5"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`
                                        w-10 h-10 rounded-lg flex items-center justify-center
                                        ${getArousalColor(spot.avgArousal, spot.logCount)}
                                    `}>
                                        <span className="text-lg">{getArousalEmoji(spot.avgArousal, spot.logCount)}</span>
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">{spot.dayLabel} {spot.timeLabel}</p>
                                        <p className="text-slate-400 text-xs">{spot.logCount} logger</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-bold text-white">{spot.avgArousal.toFixed(1)}</p>
                                    <p className="text-xs text-slate-400">snitt arousal</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Insights */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="liquid-glass-card p-4 rounded-3xl"
            >
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={18} className="text-primary" />
                    <h2 className="text-lg font-bold text-white">Innsikt</h2>
                </div>
                <div className="space-y-3 text-sm text-slate-300">
                    {hotspots.length > 0 ? (
                        <>
                            <p>
                                <span className="text-white font-medium">Hovedfunn:</span>{' '}
                                Høyest arousal observeres på <span className="text-orange-400 font-medium">
                                    {hotspots[0]?.dayLabel} kl. {hotspots[0]?.timeLabel}
                                </span> med snitt {hotspots[0]?.avgArousal.toFixed(1)}.
                            </p>
                            {hotspots.length > 1 && (
                                <p>
                                    <span className="text-white font-medium">Tips:</span>{' '}
                                    Vurder forebyggende tiltak rundt disse tidspunktene - ekstra støtte,
                                    reduserte krav, eller planlagte pauser.
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="text-slate-400">
                            Logg flere hendelser for å se mønstre over tid. Kartet viser når arousal er høyest.
                        </p>
                    )}
                </div>
            </motion.div>

            {/* Empty State */}
            {logs.length === 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12"
                >
                    <div className="text-6xl mb-4">📊</div>
                    <h3 className="text-xl font-bold text-white mb-2">Ingen data ennå</h3>
                    <p className="text-slate-400 mb-6">Start med å logge noen hendelser for å se mønstre.</p>
                    <Link
                        to="/log"
                        className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-medium"
                    >
                        Opprett første logg
                    </Link>
                </motion.div>
            )}
        </div>
    );
};

export default DysregulationHeatmap;

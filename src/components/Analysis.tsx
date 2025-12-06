import React, { useState, useMemo } from 'react';
import { useLogs } from '../store';
import { ArousalChart } from './ArousalChart';
import {
    Trash2,
    Calendar,
    Search,
    AlertTriangle,
    ArrowLeft,
    Clock,
    Zap,
    Heart,
    MessageSquare,
    Activity,
    Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { nb, enUS } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const Analysis: React.FC = () => {
    const { logs, deleteLog } = useLogs();
    const { t, i18n } = useTranslation();

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterArousal, setFilterArousal] = useState<'all' | 'high' | 'medium' | 'low'>('all');
    const [filterContext, setFilterContext] = useState<'all' | 'home' | 'school'>('all');

    // Filter Logic
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            // Search
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                log.note.toLowerCase().includes(searchLower) ||
                log.sensoryTriggers.some(t => t.toLowerCase().includes(searchLower)) ||
                log.contextTriggers.some(t => t.toLowerCase().includes(searchLower));

            if (!matchesSearch) return false;

            // Context Filter
            if (filterContext !== 'all' && log.context !== filterContext) return false;

            // Arousal Filter
            if (filterArousal === 'high' && log.arousal < 7) return false;
            if (filterArousal === 'medium' && (log.arousal < 4 || log.arousal >= 7)) return false;
            if (filterArousal === 'low' && log.arousal >= 4) return false;

            return true;
        });
    }, [logs, searchTerm, filterArousal, filterContext]);

    // Format helpers
    const getArousalColor = (level: number) => {
        if (level <= 3) return 'text-green-400 bg-green-500/10 border-green-500/20';
        if (level <= 6) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
        return 'text-red-400 bg-red-500/10 border-red-500/20';
    };

    const dateLocale = i18n.language === 'no' ? nb : enUS;

    return (
        <div className="flex flex-col gap-6 pb-24">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link to="/" className="p-2 rounded-full hover:bg-white/10 transition-colors" aria-label="Back">
                    <ArrowLeft className="text-white" size={24} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white">{t('logExplorer.title')}</h1>
                    <p className="text-slate-400 text-sm">{t('logExplorer.subtitle')}</p>
                </div>
            </div>

            {/* Chart Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="liquid-glass-card p-6 rounded-3xl"
            >
                <h2 className="text-slate-400 font-medium mb-4 text-xs uppercase tracking-wider flex items-center gap-2">
                    <Activity size={14} />
                    {t('logExplorer.chartTitle')}
                </h2>
                <div className="h-48 w-full">
                    <ArousalChart logs={logs} />
                </div>
            </motion.div>

            {/* Filters */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col gap-4"
            >
                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder={t('logExplorer.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>

                {/* Filter Chips */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    <button
                        onClick={() => setFilterArousal('all')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filterArousal === 'all'
                            ? 'bg-white/20 text-white'
                            : 'bg-white/5 text-slate-400 hover:bg-white/10'
                            }`}
                    >
                        {t('logExplorer.filters.allLevels')}
                    </button>
                    <button
                        onClick={() => setFilterArousal('high')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${filterArousal === 'high'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-white/5 text-slate-400 hover:bg-white/10'
                            }`}
                    >
                        <AlertTriangle size={14} />
                        {t('logExplorer.filters.highArousal')}
                    </button>
                    <div className="w-px h-8 bg-white/10 mx-2 self-center" />
                    <button
                        onClick={() => setFilterContext(filterContext === 'home' ? 'all' : 'home')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filterContext === 'home'
                            ? 'bg-primary/30 text-primary-200'
                            : 'bg-white/5 text-slate-400 hover:bg-white/10'
                            }`}
                    >
                        {t('logExplorer.filters.home')}
                    </button>
                    <button
                        onClick={() => setFilterContext(filterContext === 'school' ? 'all' : 'school')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filterContext === 'school'
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-white/5 text-slate-400 hover:bg-white/10'
                            }`}
                    >
                        {t('logExplorer.filters.school')}
                    </button>
                </div>
            </motion.div>

            {/* Log List */}
            <div className="space-y-4">
                <div className="flex justify-between items-end px-2">
                    <h3 className="text-slate-400 text-sm font-medium">
                        {t('logExplorer.foundLogs', { count: filteredLogs.length })}
                    </h3>
                </div>

                <AnimatePresence mode='popLayout'>
                    {filteredLogs.length > 0 ? (
                        filteredLogs.map((log) => (
                            <motion.div
                                key={log.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="liquid-glass-card p-5 rounded-2xl group relative"
                            >
                                {/* Header Row */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${getArousalColor(log.arousal)}`}>
                                            <span className="font-bold text-lg">{log.arousal}</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
                                                <Calendar size={14} className="text-slate-500" />
                                                {format(new Date(log.timestamp), 'EEEE d. MMMM', { locale: dateLocale })}
                                                <span className="text-slate-600">•</span>
                                                <Clock size={14} className="text-slate-500" />
                                                {format(new Date(log.timestamp), 'HH:mm')}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-0.5 capitalize flex items-center gap-1">
                                                {log.context === 'home' ? `🏠 ${t('logExplorer.filters.home')}` : `🏫 ${t('logExplorer.filters.school')}`}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            if (window.confirm(t('logExplorer.deleteConfirm'))) {
                                                deleteLog(log.id);
                                            }
                                        }}
                                        className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        title={t('logExplorer.deleteTitle')}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>

                                {/* Metrics Row */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-white/5 rounded-lg p-2 flex items-center gap-2">
                                        <Heart size={14} className="text-pink-400" />
                                        <span className="text-xs text-slate-400">{t('logExplorer.valence')}</span>
                                        <span className="text-sm font-medium text-white">{log.valence}/10</span>
                                    </div>
                                    <div className="bg-white/5 rounded-lg p-2 flex items-center gap-2">
                                        <Zap size={14} className="text-yellow-400" />
                                        <span className="text-xs text-slate-400">{t('logExplorer.energy')}</span>
                                        <span className="text-sm font-medium text-white">{log.energy}/10</span>
                                    </div>
                                </div>

                                {/* Content Details */}
                                <div className="space-y-3">
                                    {(log.sensoryTriggers.length > 0 || log.contextTriggers.length > 0) && (
                                        <div className="flex flex-wrap gap-2">
                                            {[...log.sensoryTriggers, ...log.contextTriggers].map((t, i) => (
                                                <span key={i} className="text-xs px-2 py-1 rounded-md bg-red-500/10 text-red-300 border border-red-500/20">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {log.strategies.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {log.strategies.map((s, i) => (
                                                <span key={i} className="text-xs px-2 py-1 rounded-md bg-green-500/10 text-green-300 border border-green-500/20 flex items-center gap-1">
                                                    <Check size={10} /> {s}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {log.note && (
                                        <div className="flex gap-2 items-start text-sm text-slate-400 bg-black/20 p-3 rounded-xl">
                                            <MessageSquare size={14} className="mt-0.5 shrink-0 opacity-50" />
                                            <p className="italic">"{log.note}"</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="text-center py-12 text-slate-500">
                            <Search size={32} className="mx-auto mb-3 opacity-20" />
                            <p>{t('logExplorer.noLogs')}</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Analysis;

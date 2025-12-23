import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { useToast } from './Toast';
import { STORAGE_KEYS } from '../constants/storage';

// Constants
const LOGS_PER_PAGE = 20;
const FILTER_STORAGE_KEY = STORAGE_KEYS.ANALYSIS_FILTERS;

// Types
interface AnalysisFilters {
    searchTerm: string;
    filterArousal: 'all' | 'high' | 'medium' | 'low';
    filterContext: 'all' | 'home' | 'school';
}

// Helper to get initial filters from localStorage
const getInitialFilters = (): AnalysisFilters => {
    try {
        const stored = localStorage.getItem(FILTER_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                searchTerm: parsed.searchTerm ?? '',
                filterArousal: parsed.filterArousal ?? 'all',
                filterContext: parsed.filterContext ?? 'all',
            };
        }
    } catch {
        // Ignore parse errors
    }
    return { searchTerm: '', filterArousal: 'all', filterContext: 'all' };
};

export const Analysis: React.FC = () => {
    const { logs, deleteLog } = useLogs();
    const { t, i18n } = useTranslation();
    const { showSuccess } = useToast();

    // Filter State with persistence
    const [filters, setFilters] = useState<AnalysisFilters>(getInitialFilters);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(filters.searchTerm);

    // Pagination state
    const [visibleCount, setVisibleCount] = useState(LOGS_PER_PAGE);

    // Delete modal state
    const [logToDelete, setLogToDelete] = useState<string | null>(null);

    // Derived state for convenience
    const searchTerm = filters.searchTerm;
    const filterArousal = filters.filterArousal;
    const filterContext = filters.filterContext;

    // Persist filters to localStorage
    const updateFilters = useCallback((updates: Partial<AnalysisFilters>) => {
        setFilters(prev => {
            const next = { ...prev, ...updates };
            localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const setSearchTerm = (value: string) => updateFilters({ searchTerm: value });
    const setFilterArousal = (value: AnalysisFilters['filterArousal']) => updateFilters({ filterArousal: value });
    const setFilterContext = (value: AnalysisFilters['filterContext']) => updateFilters({ filterContext: value });

    // Debounce search input (300ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset pagination when filters change
    useEffect(() => {
        setVisibleCount(LOGS_PER_PAGE);
    }, [debouncedSearchTerm, filterArousal, filterContext]);

    // Filter Logic (uses debounced search for performance)
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            // Search (debounced)
            const searchLower = debouncedSearchTerm.toLowerCase();
            const matchesSearch =
                log.note.toLowerCase().includes(searchLower) ||
                log.sensoryTriggers.some(trigger => trigger.toLowerCase().includes(searchLower)) ||
                log.contextTriggers.some(trigger => trigger.toLowerCase().includes(searchLower));

            if (!matchesSearch) return false;

            // Context Filter
            if (filterContext !== 'all' && log.context !== filterContext) return false;

            // Arousal Filter
            if (filterArousal === 'high' && log.arousal < 7) return false;
            if (filterArousal === 'medium' && (log.arousal < 4 || log.arousal >= 7)) return false;
            if (filterArousal === 'low' && log.arousal >= 4) return false;

            return true;
        });
    }, [logs, debouncedSearchTerm, filterArousal, filterContext]);

    // Slice logs for pagination
    const displayedLogs = useMemo(() =>
        filteredLogs.slice(0, visibleCount),
        [filteredLogs, visibleCount]
    );

    // Clear all filters helper
    const clearFilters = () => {
        updateFilters({ searchTerm: '', filterArousal: 'all', filterContext: 'all' });
    };

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
                    {displayedLogs.length > 0 ? (
                        displayedLogs.map((log) => (
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
                                        onClick={() => setLogToDelete(log.id)}
                                        className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                                        aria-label={t('logExplorer.deleteTitle')}
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
                                            {[...log.sensoryTriggers, ...log.contextTriggers].map((trigger, i) => (
                                                <span key={i} className="text-xs px-2 py-1 rounded-md bg-red-500/10 text-red-300 border border-red-500/20">
                                                    {trigger}
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
                        // Contextual empty states
                        logs.length === 0 ? (
                            // No logs exist at all
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-12"
                            >
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Activity size={32} className="text-primary" />
                                </div>
                                <p className="text-slate-400 mb-6 max-w-xs mx-auto text-sm">
                                    {t('logExplorer.empty.noLogs')}
                                </p>
                                <Link to="/log">
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        className="bg-primary text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                                    >
                                        {t('logExplorer.empty.createFirst')}
                                    </motion.button>
                                </Link>
                            </motion.div>
                        ) : (
                            // Logs exist but filters returned nothing
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-12"
                            >
                                <Search size={32} className="mx-auto mb-3 text-slate-600" />
                                <p className="text-slate-500 mb-4">{t('logExplorer.empty.noMatch')}</p>
                                <button
                                    onClick={clearFilters}
                                    className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
                                >
                                    {t('logExplorer.empty.clearFilters')}
                                </button>
                            </motion.div>
                        )
                    )}
                </AnimatePresence>

                {/* Load More button */}
                {visibleCount < filteredLogs.length && (
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => setVisibleCount(prev => prev + LOGS_PER_PAGE)}
                        className="w-full py-3 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors font-medium"
                    >
                        {t('logExplorer.loadMore', { remaining: filteredLogs.length - visibleCount })}
                    </motion.button>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {logToDelete !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
                        onClick={() => setLogToDelete(null)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') setLogToDelete(null);
                        }}
                        tabIndex={-1}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-log-modal-title"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="w-full max-w-sm rounded-2xl p-6 liquid-glass-card"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <Trash2 size={32} className="text-red-400" />
                                </div>
                                <h2 id="delete-log-modal-title" className="text-xl font-bold text-white mb-2">
                                    {t('logExplorer.deleteModal.title')}
                                </h2>
                                <p className="text-white/60">
                                    {t('logExplorer.deleteModal.description')}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setLogToDelete(null)}
                                    className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white font-medium hover:bg-white/15 transition-colors"
                                >
                                    {t('logExplorer.deleteModal.cancel')}
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                        if (logToDelete) {
                                            deleteLog(logToDelete);
                                            setLogToDelete(null);
                                            showSuccess(t('logExplorer.deleteSuccess'));
                                        }
                                    }}
                                    className="flex-1 px-4 py-3 rounded-xl text-white font-bold"
                                    style={{
                                        background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                                        boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)'
                                    }}
                                >
                                    {t('logExplorer.deleteModal.confirm')}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Analysis;

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Clock,
    CheckCircle,
    Play,
    Pause,
    RotateCcw,
    Plus,
    X,
    Pencil,
    Trash2,
    Copy
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Types
export interface Activity {
    id: string;
    time: string;
    endTime: string;
    title: string;
    status: 'completed' | 'current' | 'upcoming';
    icon: string;
    durationMinutes?: number;
    color?: string;
}

interface CurrentActivityCardProps {
    activity: Activity;
    onComplete: () => void;
    timerActive: boolean;
    timeRemaining: number;
    progress: number;
    onStartTimer: () => void;
    onPauseTimer: () => void;
    onResetTimer: () => void;
    formatTime: (seconds: number) => string;
    timerStarted: boolean;
}

interface TimelineItemProps {
    activity: Activity;
    isLast: boolean;
    onEdit: (id: string) => void;
    onComplete: (id: string) => void;
}

interface NewActivityModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (activity: Omit<Activity, 'id' | 'status'>) => void;
    editActivity?: Activity | null;
    onDelete?: () => void;
    onDuplicate?: () => void;
}

// Icon picker options
const ACTIVITY_ICONS = [
    '☀️', '📚', '🔢', '📖', '✏️', '🎨', '🎵', '⚽', '🍎', '🥪',
    '🧘', '💤', '🚿', '👕', '🚌', '🏠', '💊', '🎮', '📺', '🧹'
];

// Current Activity Card Component (Liquid Glass Style)
export const CurrentActivityCard: React.FC<CurrentActivityCardProps> = ({
    activity,
    onComplete,
    timerActive,
    timeRemaining,
    progress,
    onStartTimer,
    onPauseTimer,
    onResetTimer,
    formatTime,
    timerStarted
}) => {
    const { t } = useTranslation();

    return (
        <motion.div
            key={activity.id}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative overflow-hidden rounded-3xl liquid-glass-active"
            role="region"
            aria-label={`${t('visualSchedule.currentActivity')}: ${activity.title}`}
        >
            {/* Animated gradient background */}
            <motion.div
                className="absolute inset-0 opacity-30"
                animate={{
                    background: [
                        'linear-gradient(135deg, rgba(0, 212, 255, 0.3) 0%, rgba(168, 85, 247, 0.2) 100%)',
                        'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(0, 212, 255, 0.2) 100%)',
                        'linear-gradient(135deg, rgba(0, 212, 255, 0.3) 0%, rgba(168, 85, 247, 0.2) 100%)',
                    ]
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            />

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                <motion.div
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 progress-glow"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                />
            </div>

            {/* Large icon background decoration */}
            <div className="absolute -right-4 -top-4 text-[120px] opacity-10 select-none pointer-events-none">
                {activity.icon}
            </div>

            <div className="relative z-10 p-6">
                {/* Status Badge */}
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
                    style={{
                        background: 'rgba(0, 212, 255, 0.2)',
                        border: '1px solid rgba(0, 212, 255, 0.4)'
                    }}
                >
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-cyan-300 text-xs font-semibold uppercase tracking-wider">{t('visualSchedule.now')}</span>
                </motion.div>

                {/* Activity Icon & Title */}
                <div className="flex items-start gap-4 mb-4">
                    <motion.div
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl liquid-glass-card"
                        aria-hidden="true"
                    >
                        {activity.icon}
                    </motion.div>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-white mb-1">{activity.title}</h1>
                        <p className="text-white/60 text-lg">{activity.time} - {activity.endTime}</p>
                    </div>
                </div>

                {/* Timer Display */}
                <AnimatePresence>
                    {timerStarted && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-6"
                        >
                            <div className="rounded-2xl p-4 liquid-glass-card">
                                <p className="text-white/50 text-sm font-medium mb-1 uppercase tracking-wider">{t('visualSchedule.timeRemaining')}</p>
                                <p
                                    className={`text-5xl font-bold tabular-nums ${timeRemaining <= 60 ? 'neon-text-blue animate-pulse' : 'text-white'}`}
                                    aria-live="polite"
                                    aria-atomic="true"
                                >
                                    {formatTime(timeRemaining)}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Action Buttons */}
                <div className="flex gap-3" role="group" aria-label="Controllers">
                    {!timerStarted ? (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onStartTimer}
                            className="flex-1 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 neon-glow-blue"
                            style={{ background: 'linear-gradient(135deg, #00D4FF 0%, #007AFF 100%)' }}
                        >
                            <Play size={20} aria-hidden="true" />
                            {t('visualSchedule.startTimer')}
                        </motion.button>
                    ) : (
                        <>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={timerActive ? onPauseTimer : onStartTimer}
                                className="flex-1 text-white px-4 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-colors liquid-glass-card"
                            >
                                {timerActive ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
                                {timerActive ? t('visualSchedule.pauseTimer') : t('visualSchedule.resumeTimer')}
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={onResetTimer}
                                className="text-white/70 px-4 py-4 rounded-2xl flex items-center justify-center hover:bg-white/10 transition-colors liquid-glass-card"
                                aria-label={t('visualSchedule.resetTimer')}
                            >
                                <RotateCcw size={20} aria-hidden="true" />
                            </motion.button>
                        </>
                    )}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onComplete}
                        className="flex-1 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 neon-glow-green"
                        style={{ background: 'linear-gradient(135deg, #22C55E 0%, #10B981 100%)' }}
                    >
                        <CheckCircle size={20} aria-hidden="true" />
                        {t('visualSchedule.complete')}
                    </motion.button>
                </div>
            </div>
        </motion.div>
    );
};

// Timeline Item Component (Liquid Glass Style)
export const TimelineItem: React.FC<TimelineItemProps> = ({
    activity,
    isLast,
    onEdit,
    onComplete
}) => {
    const getStatusStyles = () => {
        switch (activity.status) {
            case 'completed':
                return {
                    dot: { background: '#22C55E', border: '2px solid #22C55E', boxShadow: '0 0 20px rgba(34, 197, 94, 0.5)' },
                    card: { opacity: 0.6 },
                    connector: 'bg-green-500/50'
                };
            case 'current':
                return {
                    dot: { background: '#00D4FF', border: '2px solid #00D4FF', boxShadow: '0 0 20px rgba(0, 212, 255, 0.5), 0 0 0 4px rgba(0, 212, 255, 0.2)' },
                    card: {
                        background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%)',
                        border: '1px solid rgba(0, 212, 255, 0.3)',
                        transform: 'scale(1.02)'
                    },
                    connector: 'bg-gradient-to-b from-cyan-500/50 to-purple-500/30'
                };
            default:
                return {
                    dot: { background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.3)' },
                    card: {
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                        border: '1px solid rgba(255, 255, 255, 0.18)',
                        opacity: 0.7
                    },
                    connector: 'bg-white/20'
                };
        }
    };

    const styles = getStatusStyles();

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative flex gap-4"
        >
            {/* Timeline connector line */}
            <div className="flex flex-col items-center">
                {/* Dot */}
                <motion.div
                    whileHover={{ scale: 1.2 }}
                    className="w-4 h-4 rounded-full z-10 transition-all flex items-center justify-center"
                    style={styles.dot}
                >
                    {activity.status === 'completed' && (
                        <CheckCircle size={10} className="text-white" />
                    )}
                </motion.div>
                {/* Connector line */}
                {!isLast && (
                    <div className={`w-0.5 flex-1 min-h-[60px] ${styles.connector}`} />
                )}
            </div>

            {/* Activity Card */}
            <motion.div
                whileHover={{ scale: activity.status !== 'current' ? 1.02 : 1 }}
                className={`flex-1 rounded-2xl p-4 mb-3 transition-all cursor-pointer group ${activity.status === 'current' ? 'liquid-glass-active' : 'liquid-glass-card'
                    }`}
                style={styles.card}
                onClick={() => onEdit(activity.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onEdit(activity.id);
                    }
                }}
            >
                <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl shrink-0">
                        {activity.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <h4 className={`font-bold truncate ${activity.status === 'current' ? 'text-white' : 'text-white/80'}`}>
                            {activity.title}
                        </h4>
                        <p className="text-white/50 text-sm">{activity.time} - {activity.endTime}</p>
                    </div>

                    {/* Status indicator */}
                    {activity.status === 'completed' && (
                        <CheckCircle size={20} className="text-green-400 shrink-0" />
                    )}
                    {activity.status === 'current' && (
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onComplete(activity.id);
                            }}
                            className="p-2 rounded-lg shrink-0"
                            style={{
                                background: 'linear-gradient(135deg, #22C55E 0%, #10B981 100%)',
                                boxShadow: '0 0 10px rgba(34, 197, 94, 0.4)'
                            }}
                        >
                            <CheckCircle size={16} className="text-white" />
                        </motion.button>
                    )}

                    {/* Edit button on hover */}
                    {activity.status !== 'current' && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileHover={{ scale: 1.1 }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg bg-white/10 hover:bg-white/20"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(activity.id);
                            }}
                        >
                            <Pencil size={14} className="text-white/70" />
                        </motion.button>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

// Up Next Card Component
export const UpNextCard: React.FC<{ activity: Activity }> = ({ activity }) => {
    const { t } = useTranslation();
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl p-4 liquid-glass-card"
            role="region"
            aria-label={`${t('visualSchedule.next')}: ${activity.title}`}
        >
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center text-3xl">
                    {activity.icon}
                </div>
                <div className="flex-1">
                    <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1">{t('visualSchedule.next')}</p>
                    <h3 className="text-white font-bold text-lg">{activity.title}</h3>
                    <p className="text-white/50 text-sm">{activity.time} - {activity.endTime}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                    <Clock size={20} className="text-white/40" />
                </div>
            </div>
        </motion.div>
    );
};

// New/Edit Activity Modal (Liquid Glass Style)
export const NewActivityModal: React.FC<NewActivityModalProps> = ({
    isOpen,
    onClose,
    onSave,
    editActivity,
    onDelete,
    onDuplicate
}) => {
    const { t } = useTranslation();
    const [title, setTitle] = useState(editActivity?.title || '');
    const [icon, setIcon] = useState(editActivity?.icon || '📚');
    const [startTime, setStartTime] = useState(editActivity?.time || '09:00');
    const [duration, setDuration] = useState(editActivity?.durationMinutes || 30);
    const [validationError, setValidationError] = useState<string | null>(null);

    // Reset form when modal opens with new/edit activity
    React.useEffect(() => {
        if (isOpen) {
            setTitle(editActivity?.title || '');
            setIcon(editActivity?.icon || '📚');
            setStartTime(editActivity?.time || '09:00');
            setDuration(editActivity?.durationMinutes || 30);
            setValidationError(null);
        }
    }, [isOpen, editActivity]);

    const calculateEndTime = (start: string, mins: number) => {
        const [h, m] = start.split(':').map(Number);
        const totalMins = h * 60 + m + mins;
        const endH = Math.floor(totalMins / 60) % 24;
        const endM = totalMins % 60;
        return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
    };

    const validateForm = (): boolean => {
        if (!title.trim()) {
            setValidationError(t('visualSchedule.modal.validation.titleRequired'));
            return false;
        }
        if (duration <= 0) {
            setValidationError(t('visualSchedule.modal.validation.durationInvalid'));
            return false;
        }
        setValidationError(null);
        return true;
    };

    const handleSave = () => {
        if (!validateForm()) return;
        onSave({
            title: title.trim(),
            icon,
            time: startTime,
            endTime: calculateEndTime(startTime, duration),
            durationMinutes: duration
        });
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
                    onClick={onClose}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="activity-modal-title"
                >
                    <motion.div
                        initial={{ opacity: 0, y: 100, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 100, scale: 0.95 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="w-full max-w-md rounded-3xl overflow-hidden liquid-glass-card"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <h2 id="activity-modal-title" className="text-xl font-bold text-white">
                                {editActivity ? t('visualSchedule.modal.editTitle') : t('visualSchedule.modal.newTitle')}
                            </h2>
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={onClose}
                                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                                aria-label={t('visualSchedule.modal.cancel')}
                            >
                                <X size={20} className="text-white/70" aria-hidden="true" />
                            </motion.button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6">
                            {/* Validation Error */}
                            {validationError && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-3 rounded-xl bg-red-500/20 border border-red-400/30 text-red-300 text-sm"
                                    role="alert"
                                >
                                    {validationError}
                                </motion.div>
                            )}

                            {/* Title Input */}
                            <div>
                                <label htmlFor="activity-title" className="block text-white/60 text-sm font-medium mb-2">{t('visualSchedule.modal.titleLabel')}</label>
                                <input
                                    id="activity-title"
                                    type="text"
                                    value={title}
                                    onChange={e => {
                                        setTitle(e.target.value);
                                        if (validationError) setValidationError(null);
                                    }}
                                    placeholder={t('visualSchedule.modal.titlePlaceholder')}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                                    aria-required="true"
                                    aria-invalid={validationError ? 'true' : 'false'}
                                />
                            </div>

                            {/* Icon Picker */}
                            <div>
                                <label className="block text-white/60 text-sm font-medium mb-2">{t('visualSchedule.modal.iconLabel')}</label>
                                <div className="flex flex-wrap gap-2">
                                    {ACTIVITY_ICONS.map(emoji => (
                                        <motion.button
                                            key={emoji}
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => setIcon(emoji)}
                                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${icon === emoji
                                                ? 'bg-cyan-500/30 border-2 border-cyan-400/50'
                                                : 'bg-white/10 border border-white/10 hover:bg-white/20'
                                                }`}
                                            style={icon === emoji ? { boxShadow: '0 0 20px rgba(0, 212, 255, 0.5)' } : {}}
                                        >
                                            {emoji}
                                        </motion.button>
                                    ))}
                                </div>
                            </div>

                            {/* Time & Duration */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-white/60 text-sm font-medium mb-2">{t('visualSchedule.modal.startTime')}</label>
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={e => setStartTime(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-white/60 text-sm font-medium mb-2">{t('visualSchedule.modal.duration')}</label>
                                    <select
                                        value={duration}
                                        onChange={e => setDuration(Number(e.target.value))}
                                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                                    >
                                        <option value={15}>15 {t('settings.minutes', { defaultValue: 'min' })}</option>
                                        <option value={30}>30 {t('settings.minutes', { defaultValue: 'min' })}</option>
                                        <option value={45}>45 {t('settings.minutes', { defaultValue: 'min' })}</option>
                                        <option value={60}>1 {t('settings.hour', { defaultValue: 'time' })}</option>
                                        <option value={90}>1.5 {t('settings.hours', { defaultValue: 'timer' })}</option>
                                        <option value={120}>2 {t('settings.hours', { defaultValue: 'timer' })}</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 pt-0 flex gap-3">
                            {editActivity && (
                                <>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={onDelete}
                                        className="px-4 py-3 rounded-xl bg-red-500/20 border border-red-400/30 text-red-400 font-medium flex items-center justify-center gap-2 hover:bg-red-500/30 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={onDuplicate}
                                        className="px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
                                    >
                                        <Copy size={18} />
                                    </motion.button>
                                </>
                            )}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onClose}
                                className="flex-1 px-6 py-3 rounded-xl bg-white/10 border border-white/10 text-white/70 font-medium hover:bg-white/15 transition-colors"
                            >
                                {t('visualSchedule.modal.cancel')}
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleSave}
                                disabled={!title.trim()}
                                className="flex-1 px-6 py-3 rounded-xl text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    background: 'linear-gradient(135deg, #00D4FF 0%, #007AFF 100%)',
                                    boxShadow: '0 0 20px rgba(0, 212, 255, 0.5), 0 0 40px rgba(0, 212, 255, 0.2)'
                                }}
                            >
                                {editActivity ? t('visualSchedule.modal.save') : t('visualSchedule.modal.add')}
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// Floating Add Button (Liquid Glass Style)
export const FloatingAddButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    const { t } = useTranslation();
    return (
        <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClick}
            className="fixed bottom-24 right-6 w-14 h-14 rounded-full text-white flex items-center justify-center z-40 neon-glow-blue"
            style={{ background: 'linear-gradient(135deg, #00D4FF 0%, #007AFF 100%)' }}
            aria-label={t('visualSchedule.modal.add')}
        >
            <Plus size={28} aria-hidden="true" />
        </motion.button>
    );
};

// All Done Card (Liquid Glass Style)
export const AllDoneCard: React.FC = () => {
    const { t } = useTranslation();
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl p-8 text-center liquid-glass-card"
            role="status"
            aria-label={t('visualSchedule.allDone.title')}
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center neon-glow-green"
                style={{ background: 'linear-gradient(135deg, #22C55E 0%, #10B981 100%)' }}
                aria-hidden="true"
            >
                <CheckCircle size={40} className="text-white" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('visualSchedule.allDone.title')}</h2>
            <p className="text-white/60">{t('visualSchedule.allDone.subtitle')}</p>
        </motion.div>
    );
};

// Sticky Header Component (Liquid Glass Style)
export const StickyHeader: React.FC<{
    title: string;
    onBack: () => void;
    rightAction?: React.ReactNode;
}> = ({ title, onBack, rightAction }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky top-0 z-20 flex items-center bg-background-dark/80 p-4 pb-2 backdrop-blur-sm justify-between rounded-b-xl -mx-4 -mt-4 mb-2 border-b border-white/10"
        >
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onBack}
                aria-label="Back"
                className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white"
            >
                <ArrowLeft size={20} />
            </motion.button>
            <h1 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">{title}</h1>
            <div className="flex size-10 items-center justify-center">
                {rightAction}
            </div>
        </motion.div>
    );
};

// Confirm Delete Modal Component
interface ConfirmDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    activityTitle: string;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    activityTitle
}) => {
    const { t } = useTranslation();
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
                    onClick={onClose}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-modal-title"
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
                            <h2 id="delete-modal-title" className="text-xl font-bold text-white mb-2">
                                {t('visualSchedule.deleteModal.title')}
                            </h2>
                            <p className="text-white/60">
                                {t('visualSchedule.deleteModal.description', { title: activityTitle })}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onClose}
                                className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white font-medium hover:bg-white/15 transition-colors"
                            >
                                {t('visualSchedule.modal.cancel')}
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onConfirm}
                                className="flex-1 px-4 py-3 rounded-xl text-white font-bold neon-glow-green"
                                style={{
                                    background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                                }}
                            >
                                {t('visualSchedule.modal.delete')}
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

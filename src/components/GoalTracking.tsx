import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, TrendingUp, CheckCircle2, Plus, ArrowLeft, X, Clock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { useGoals, useAppContext } from '../store';
import { type Goal, type GoalCategory, type GoalStatus, GOAL_CATEGORIES } from '../types';
import { useTranslation } from 'react-i18next';

export const GoalTracking: React.FC = () => {
    const navigate = useNavigate();
    const { goals, addGoal, addGoalProgress, getOverallProgress } = useGoals();
    const { currentContext } = useAppContext();
    const { t } = useTranslation();

    const [showAddGoal, setShowAddGoal] = useState(false);
    const [showProgressModal, setShowProgressModal] = useState<string | null>(null);
    const [progressValue, setProgressValue] = useState(0);
    const [progressNote, setProgressNote] = useState('');

    // New goal form state
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newCategory, setNewCategory] = useState<GoalCategory>('regulation');
    const [newTargetValue, setNewTargetValue] = useState(10);
    const [newTargetUnit, setNewTargetUnit] = useState('ganger');
    const [newTargetDirection, setNewTargetDirection] = useState<'increase' | 'decrease'>('increase');

    // Validation state
    const [validationErrors, setValidationErrors] = useState<{ title?: string; targetValue?: string }>({});

    const overallProgress = getOverallProgress();

    const getProgressPercent = (goal: Goal) => {
        if (goal.targetValue < 0) return 0;
        // Allow targetValue of 0 for decrease goals (e.g., "reduce incidents to 0")
        if (goal.targetDirection === 'increase' && goal.targetValue === 0) return 0;

        if (goal.targetDirection === 'decrease') {
            // For decrease goals: measure progress from baseline toward target
            // Use first progress entry as baseline, or currentValue if no history yet
            const baseline = goal.progressHistory.length > 0
                ? goal.progressHistory[0].value
                : goal.currentValue;

            // If currentValue already at or below target, goal achieved
            if (goal.currentValue <= goal.targetValue) return 100;

            // If baseline is at or below target, the goal was already met at start
            // Return 100 if still at/below target, calculate regression otherwise
            if (baseline <= goal.targetValue) {
                // Started at/below target but regressed - show as 0% progress
                return 0;
            }

            const range = baseline - goal.targetValue;
            const reduction = baseline - goal.currentValue;

            // Handle regression (current > baseline) - show 0% rather than negative
            if (reduction < 0) return 0;

            return Math.min(100, Math.max(0, (reduction / range) * 100));
        }

        // Increase goals: simple ratio of current to target
        return Math.min(100, Math.max(0, (goal.currentValue / goal.targetValue) * 100));
    };

    const getStatusColor = (goal: Goal) => {
        if (goal.targetValue <= 0) return 'bg-slate-500';

        const progress = getProgressPercent(goal);

        if (progress >= 80) return 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]';
        if (progress >= 50) return 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]';
        return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
    };

    const getDeadlineInfo = (goal: Goal): { daysLeft: number; label: string; urgent: boolean; overdue: boolean } => {
        const now = new Date();
        const target = new Date(goal.targetDate);
        const diffTime = target.getTime() - now.getTime();
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) {
            return { daysLeft, label: t('goals.deadline.overdue', { days: Math.abs(daysLeft) }), urgent: true, overdue: true };
        }
        if (daysLeft === 0) {
            return { daysLeft, label: t('goals.deadline.today'), urgent: true, overdue: false };
        }
        if (daysLeft <= 7) {
            return { daysLeft, label: t('goals.deadline.daysLeft', { days: daysLeft }), urgent: true, overdue: false };
        }
        return { daysLeft, label: t('goals.deadline.daysLeft', { days: daysLeft }), urgent: false, overdue: false };
    };

    const handleAddGoal = () => {
        const errors: { title?: string; targetValue?: string } = {};

        // Validate title
        if (!newTitle.trim()) {
            errors.title = t('goals.validation.titleRequired');
        }

        // Validate target value
        // For increase goals, must be > 0
        // For decrease goals, can be 0 (e.g., "reduce incidents to 0")
        if (newTargetDirection === 'increase' && newTargetValue <= 0) {
            errors.targetValue = t('goals.validation.targetInvalid');
        } else if (newTargetDirection === 'decrease' && newTargetValue < 0) {
            errors.targetValue = t('goals.validation.targetInvalid');
        }

        // If there are errors, show them and don't submit
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }

        const goal: Goal = {
            id: uuidv4(),
            title: newTitle,
            description: newDescription,
            category: newCategory,
            targetValue: newTargetValue,
            targetUnit: newTargetUnit,
            targetDirection: newTargetDirection,
            startDate: new Date().toISOString(),
            targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
            currentValue: 0,
            status: 'not_started' as GoalStatus,
            progressHistory: []
        };

        addGoal(goal);
        setShowAddGoal(false);
        setNewTitle('');
        setNewDescription('');
        setNewCategory('regulation');
        setNewTargetValue(10);
        setNewTargetUnit('ganger');
        setNewTargetDirection('increase');
        setValidationErrors({});
    };

    const handleLogProgress = (goalId: string) => {
        addGoalProgress(goalId, {
            date: new Date().toISOString(),
            value: progressValue,
            context: currentContext,
            notes: progressNote
        });
        setShowProgressModal(null);
        setProgressValue(0);
        setProgressNote('');
    };

    const getCategoryLabel = (category: GoalCategory) => {
        // We can optionally translate category labels too, for now keeping existing or adding to json
        return GOAL_CATEGORIES.find(c => c.value === category)?.label || category;
    };

    // Default goals if none exist - memoized to avoid calling Date.now() on every render
    const displayGoals: Goal[] = useMemo(() => {
        if (goals.length > 0) return goals;

        const now = new Date();
        const startDate = now.toISOString();
        const targetDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        return [
            {
                id: 'demo-1',
                title: 'Reduser Nedsmeltingsvarighet',
                description: 'Hold nedsmeltinger under 10 minutter',
                category: 'regulation' as GoalCategory,
                targetValue: 10,
                targetUnit: 'minutter',
                targetDirection: 'decrease' as const,
                startDate,
                targetDate,
                currentValue: 14,
                status: 'in_progress' as GoalStatus,
                progressHistory: []
            },
            {
                id: 'demo-2',
                title: 'Øk "Grønn Sone" Tid',
                description: 'Tid brukt i lav spenning',
                category: 'regulation' as GoalCategory,
                targetValue: 4,
                targetUnit: 'timer',
                targetDirection: 'increase' as const,
                startDate,
                targetDate,
                currentValue: 2.5,
                status: 'at_risk' as GoalStatus,
                progressHistory: []
            },
            {
                id: 'demo-3',
                title: 'Bruk Strategier Selvstendig',
                description: 'Selvinitiert bruk av strategier',
                category: 'independence' as GoalCategory,
                targetValue: 3,
                targetUnit: 'ganger',
                targetDirection: 'increase' as const,
                startDate,
                targetDate,
                currentValue: 4,
                status: 'achieved' as GoalStatus,
                progressHistory: []
            }
        ];
    }, [goals]);

    return (
        <div className="flex flex-col gap-6 px-4 py-4 min-h-screen pb-24">
            {/* Top App Bar with Glass Effect */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="sticky top-0 z-10 flex items-center bg-background-dark/80 p-4 pb-2 backdrop-blur-sm justify-between rounded-b-xl -mx-4 -mt-4 mb-2 border-b border-white/10"
            >
                <button onClick={() => navigate(-1)} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white" aria-label="Gå tilbake">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">{t('goals.title')}</h2>
                <button
                    onClick={() => setShowAddGoal(true)}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                    aria-label={t('goals.addGoal')}
                >
                    <Plus size={24} />
                </button>
            </motion.div>

            <div className="flex flex-col gap-4">
                {/* Summary Card with Neon Glow */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-3xl p-6 text-white shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
                >
                    {/* Background noise/texture */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <Target className="text-white" size={20} />
                            </div>
                            <h3 className="font-bold text-lg">{t('goals.progression')}</h3>
                        </div>
                        <p className="text-indigo-100 mb-6 text-sm">
                            {goals.length > 0
                                ? t('goals.summary', {
                                    count: displayGoals.filter(g => getProgressPercent(g) >= 80).length,
                                    total: displayGoals.length
                                })
                                : t('goals.empty')}
                        </p>

                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-4xl font-bold tracking-tight text-white drop-shadow-lg">{goals.length > 0 ? overallProgress : 68}%</p>
                                <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mt-1">{t('goals.totalCompletion')}</p>
                            </div>
                            <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md">
                                <TrendingUp className="text-white" size={24} />
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Goals List */}
                <div className="space-y-4">
                    <h3 className="text-white/60 font-medium text-sm px-2 uppercase tracking-wider">{t('goals.activeGoals')}</h3>
                    {displayGoals.map((goal, index) => (
                        <motion.div
                            key={goal.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="liquid-glass-card p-5 rounded-2xl"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <span className="text-[10px] uppercase font-bold px-2 py-1 rounded-full bg-white/10 text-white/70 border border-white/5">
                                            {getCategoryLabel(goal.category)}
                                        </span>
                                        {(() => {
                                            const deadlineInfo = getDeadlineInfo(goal);
                                            const isCompleted = getProgressPercent(goal) >= 100;
                                            if (isCompleted) return null; // Don't show deadline for completed goals
                                            return (
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${
                                                    deadlineInfo.overdue
                                                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                        : deadlineInfo.urgent
                                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                                            : 'bg-white/5 text-slate-400 border border-white/5'
                                                }`}>
                                                    {deadlineInfo.overdue ? (
                                                        <AlertTriangle size={10} />
                                                    ) : (
                                                        <Clock size={10} />
                                                    )}
                                                    {deadlineInfo.label}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <h4 className="font-bold text-white text-lg leading-tight mb-1">{goal.title}</h4>
                                    <p className="text-slate-400 text-sm leading-relaxed">{goal.description}</p>
                                </div>
                                {getProgressPercent(goal) >= 100 && (
                                    <div className="bg-green-500/20 p-1.5 rounded-full">
                                        <CheckCircle2 className="text-green-400" size={20} />
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 bg-black/20 rounded-xl p-3 border border-white/5">
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="font-medium text-slate-400 text-xs">{t('goals.progress')}</span>
                                    <span className="font-bold text-white">{Math.round(getProgressPercent(goal))}%</span>
                                </div>
                                <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${getProgressPercent(goal)}%` }}
                                        transition={{ duration: 0.5, delay: index * 0.1 }}
                                        className={`h-full rounded-full ${getStatusColor(goal)}`}
                                    />
                                </div>
                                <div className="flex justify-between mt-2 text-xs text-slate-500 font-medium">
                                    <span>{t('goals.current')} {goal.currentValue} {goal.targetUnit}</span>
                                    <span>{t('goals.target')} {goal.targetDirection === 'decrease' ? '< ' : ''}{goal.targetValue} {goal.targetUnit}</span>
                                </div>
                            </div>

                            {goals.length > 0 && (
                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                        setShowProgressModal(goal.id);
                                        setProgressValue(goal.currentValue);
                                    }}
                                    className="mt-4 w-full bg-primary/10 hover:bg-primary/20 focus:bg-primary/20 text-primary border border-primary/20 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                                    aria-label={`${t('goals.logProgress')} - ${goal.title}`}
                                >
                                    <Plus size={16} aria-hidden="true" />
                                    {t('goals.logProgress')}
                                </motion.button>
                            )}
                        </motion.div>
                    ))}

                    {/* Add Another Goal button - visible when goals exist */}
                    {goals.length > 0 && (
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: displayGoals.length * 0.1 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowAddGoal(true)}
                            className="w-full border-2 border-dashed border-white/20 hover:border-primary/50 bg-white/5 hover:bg-primary/10 text-slate-400 hover:text-primary py-4 rounded-2xl font-medium text-sm transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                            aria-label={t('goals.addGoal')}
                        >
                            <Plus size={18} aria-hidden="true" />
                            {t('goals.addGoal')}
                        </motion.button>
                    )}
                </div>

                {goals.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-12"
                    >
                        <p className="text-slate-500 mb-6 max-w-xs mx-auto text-sm">
                            {t('goals.noGoals')}
                        </p>
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowAddGoal(true)}
                            className="bg-primary text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all neon-glow-blue"
                        >
                            {t('goals.addFirst')}
                        </motion.button>
                    </motion.div>
                )}
            </div>

            {/* Add Goal Modal */}
            <AnimatePresence>
                {showAddGoal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="liquid-glass-card rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white">{t('goals.newGoal')}</h3>
                                <button onClick={() => { setShowAddGoal(false); setValidationErrors({}); }} className="text-slate-400 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-400 block mb-2">{t('goals.form.title')}</label>
                                    <input
                                        type="text"
                                        value={newTitle}
                                        onChange={(e) => {
                                            setNewTitle(e.target.value);
                                            if (validationErrors.title && e.target.value.trim()) {
                                                setValidationErrors(prev => ({ ...prev, title: undefined }));
                                            }
                                        }}
                                        placeholder="f.eks. Bruk pusteøvelser daglig"
                                        className={`w-full bg-black/20 border rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none transition-colors ${
                                            validationErrors.title
                                                ? 'border-red-500/50 focus:border-red-500'
                                                : 'border-white/10 focus:border-primary/50'
                                        }`}
                                        aria-invalid={!!validationErrors.title}
                                        aria-describedby={validationErrors.title ? 'title-error' : undefined}
                                    />
                                    {validationErrors.title && (
                                        <p id="title-error" className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                                            <AlertTriangle size={12} />
                                            {validationErrors.title}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-400 block mb-2">{t('goals.form.description')}</label>
                                    <textarea
                                        value={newDescription}
                                        onChange={(e) => setNewDescription(e.target.value)}
                                        placeholder="Beskriv målet..."
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 transition-colors h-24 resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-400 block mb-2">{t('goals.form.category')}</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {GOAL_CATEGORIES.map((cat) => (
                                            <button
                                                key={cat.value}
                                                onClick={() => setNewCategory(cat.value)}
                                                className={`p-2 rounded-xl text-sm font-medium transition-all ${newCategory === cat.value
                                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                                    }`}
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-sm font-medium text-slate-400 block mb-2">{t('goals.form.targetValue')}</label>
                                        <input
                                            type="number"
                                            value={newTargetValue}
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                setNewTargetValue(val);
                                                if (validationErrors.targetValue && val > 0) {
                                                    setValidationErrors(prev => ({ ...prev, targetValue: undefined }));
                                                }
                                            }}
                                            min={newTargetDirection === 'decrease' ? 0 : 1}
                                            className={`w-full bg-black/20 border rounded-xl p-3 text-white focus:outline-none transition-colors ${
                                                validationErrors.targetValue
                                                    ? 'border-red-500/50 focus:border-red-500'
                                                    : 'border-white/10 focus:border-primary/50'
                                            }`}
                                            aria-invalid={!!validationErrors.targetValue}
                                            aria-describedby={validationErrors.targetValue ? 'target-error' : undefined}
                                        />
                                        {validationErrors.targetValue && (
                                            <p id="target-error" className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                                                <AlertTriangle size={12} />
                                                {validationErrors.targetValue}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-sm font-medium text-slate-400 block mb-2">{t('goals.form.unit')}</label>
                                        <input
                                            type="text"
                                            value={newTargetUnit}
                                            onChange={(e) => setNewTargetUnit(e.target.value)}
                                            placeholder="ganger..."
                                            className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 transition-colors"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-400 block mb-2">{t('goals.form.direction')}</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setNewTargetDirection('increase')}
                                            className={`flex-1 p-3 rounded-xl font-medium transition-all ${newTargetDirection === 'increase'
                                                ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                                                : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                                }`}
                                        >
                                            {t('goals.form.increase')}
                                        </button>
                                        <button
                                            onClick={() => setNewTargetDirection('decrease')}
                                            className={`flex-1 p-3 rounded-xl font-medium transition-all ${newTargetDirection === 'decrease'
                                                ? 'bg-red-500/20 text-red-300 border border-red-500/50'
                                                : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                                }`}
                                        >
                                            {t('goals.form.decrease')}
                                        </button>
                                    </div>
                                </div>

                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleAddGoal}
                                    className="w-full bg-primary text-white py-4 rounded-xl font-bold mt-4 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all neon-glow-blue"
                                >
                                    {t('goals.form.submit')}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Progress Modal */}
            <AnimatePresence>
                {showProgressModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="liquid-glass-card rounded-3xl p-6 w-full max-w-md"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white">{t('goals.logModal.title')}</h3>
                                <button onClick={() => setShowProgressModal(null)} className="text-slate-400 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-400 block mb-2">
                                        {t('goals.logModal.newValue')}
                                    </label>
                                    <input
                                        type="number"
                                        value={progressValue}
                                        onChange={(e) => setProgressValue(Number(e.target.value))}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-primary/50 transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-400 block mb-2">
                                        {t('goals.logModal.note')}
                                    </label>
                                    <textarea
                                        value={progressNote}
                                        onChange={(e) => setProgressNote(e.target.value)}
                                        placeholder="Hva skjedde?"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:border-primary/50 transition-colors h-24 resize-none"
                                    />
                                </div>

                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleLogProgress(showProgressModal)}
                                    className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all neon-glow-blue"
                                >
                                    {t('goals.logModal.save')}
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

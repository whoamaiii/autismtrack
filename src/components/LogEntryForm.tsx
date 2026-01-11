import React, { useReducer, useId, useCallback, useMemo } from 'react';
import { useLogs, useAppContext } from '../store';
import { type LogEntry, SENSORY_TRIGGERS, CONTEXT_TRIGGERS, STRATEGIES } from '../types';
import { TriggerSelector } from './TriggerSelector';
import { X, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useToast } from './Toast';
import { validateLogEntryInput } from '../utils/validation';

interface LogEntryFormProps {
    onClose: () => void;
}

// Form state type
interface FormState {
    arousal: number;
    valence: number;
    energy: number;
    sensoryTriggers: string[];
    contextTriggers: string[];
    strategies: string[];
    strategyEffectiveness: 'helped' | 'no_change' | 'escalated' | undefined;
    duration: number;
    note: string;
    timestamp: string;
}

// Action types for form reducer
type FormAction =
    | { type: 'SET_AROUSAL'; payload: number }
    | { type: 'SET_VALENCE'; payload: number }
    | { type: 'SET_ENERGY'; payload: number }
    | { type: 'SET_SENSORY_TRIGGERS'; payload: string[] }
    | { type: 'SET_CONTEXT_TRIGGERS'; payload: string[] }
    | { type: 'SET_STRATEGIES'; payload: string[] }
    | { type: 'SET_STRATEGY_EFFECTIVENESS'; payload: 'helped' | 'no_change' | 'escalated' | undefined }
    | { type: 'SET_DURATION'; payload: number }
    | { type: 'SET_NOTE'; payload: string }
    | { type: 'SET_TIMESTAMP'; payload: string };

// Form reducer for consolidated state management
function formReducer(state: FormState, action: FormAction): FormState {
    switch (action.type) {
        case 'SET_AROUSAL':
            return { ...state, arousal: action.payload };
        case 'SET_VALENCE':
            return { ...state, valence: action.payload };
        case 'SET_ENERGY':
            return { ...state, energy: action.payload };
        case 'SET_SENSORY_TRIGGERS':
            return { ...state, sensoryTriggers: action.payload };
        case 'SET_CONTEXT_TRIGGERS':
            return { ...state, contextTriggers: action.payload };
        case 'SET_STRATEGIES':
            // Clear effectiveness when strategies are cleared
            return {
                ...state,
                strategies: action.payload,
                strategyEffectiveness: action.payload.length === 0 ? undefined : state.strategyEffectiveness,
            };
        case 'SET_STRATEGY_EFFECTIVENESS':
            return { ...state, strategyEffectiveness: action.payload };
        case 'SET_DURATION':
            return { ...state, duration: action.payload };
        case 'SET_NOTE':
            return { ...state, note: action.payload };
        case 'SET_TIMESTAMP':
            return { ...state, timestamp: action.payload };
        default:
            return state;
    }
}

// Format datetime for input (handles timezone and fallback)
function formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Check if datetime-local is supported
function isDateTimeLocalSupported(): boolean {
    if (typeof document === 'undefined') return true;
    const input = document.createElement('input');
    input.setAttribute('type', 'datetime-local');
    return input.type === 'datetime-local';
}

// Initial state factory
function createInitialState(): FormState {
    return {
        arousal: 5,
        valence: 5,
        energy: 5,
        sensoryTriggers: [],
        contextTriggers: [],
        strategies: [],
        strategyEffectiveness: undefined,
        duration: 15,
        note: '',
        timestamp: formatDateTimeLocal(new Date()),
    };
}

// Accessible slider component
interface AccessibleSliderProps {
    id: string;
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
    lowLabel: string;
    highLabel: string;
    gradient?: string;
    describedById?: string;
}

const AccessibleSlider: React.FC<AccessibleSliderProps> = ({
    id,
    label,
    value,
    min,
    max,
    onChange,
    lowLabel,
    highLabel,
    gradient,
    describedById,
}) => {
    const descId = describedById || `${id}-description`;

    return (
        <div className="flex flex-col gap-3" role="group" aria-labelledby={`${id}-label`}>
            <div className="flex justify-between items-center">
                <label id={`${id}-label`} htmlFor={id} className="text-slate-700 dark:text-slate-300 font-medium">
                    {label}
                </label>
                <span
                    className="text-slate-900 dark:text-white font-bold bg-white dark:bg-white/10 px-3 py-1 rounded-lg"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {value}
                </span>
            </div>
            <input
                type="range"
                id={id}
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900"
                style={gradient ? { background: gradient } : undefined}
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={value}
                aria-describedby={descId}
            />
            <div id={descId} className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>{lowLabel}</span>
                <span>{highLabel}</span>
            </div>
        </div>
    );
};

export const LogEntryForm: React.FC<LogEntryFormProps> = ({ onClose }) => {
    const { addLog } = useLogs();
    const { currentContext } = useAppContext();
    const { t } = useTranslation();
    const { showSuccess, showError, showWarning } = useToast();
    const formId = useId();

    // Consolidated form state with useReducer
    const [formState, dispatch] = useReducer(formReducer, null, createInitialState);

    // Check datetime-local support once
    const dateTimeSupported = useMemo(() => isDateTimeLocalSupported(), []);

    // Validation: require effectiveness when strategies are selected
    const needsEffectiveness = formState.strategies.length > 0 && !formState.strategyEffectiveness;

    // Memoized dispatch callbacks for better performance
    const setArousal = useCallback((value: number) => dispatch({ type: 'SET_AROUSAL', payload: value }), []);
    const setValence = useCallback((value: number) => dispatch({ type: 'SET_VALENCE', payload: value }), []);
    const setEnergy = useCallback((value: number) => dispatch({ type: 'SET_ENERGY', payload: value }), []);
    const setSensoryTriggers = useCallback((value: string[]) => dispatch({ type: 'SET_SENSORY_TRIGGERS', payload: value }), []);
    const setContextTriggers = useCallback((value: string[]) => dispatch({ type: 'SET_CONTEXT_TRIGGERS', payload: value }), []);
    const setStrategies = useCallback((value: string[]) => dispatch({ type: 'SET_STRATEGIES', payload: value }), []);
    const setStrategyEffectiveness = useCallback(
        (value: 'helped' | 'no_change' | 'escalated' | undefined) => dispatch({ type: 'SET_STRATEGY_EFFECTIVENESS', payload: value }),
        []
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate strategy effectiveness is set when strategies are used
        if (needsEffectiveness) {
            showWarning(t('log.effectiveness.required'), t('log.effectiveness.requiredDescription'));
            // Scroll to and focus on the effectiveness section for accessibility
            const effectivenessSection = document.getElementById(`${formId}-effectiveness`);
            if (effectivenessSection) {
                effectivenessSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Focus after scroll animation completes
                setTimeout(() => effectivenessSection.focus(), 300);
            }
            return;
        }

        try {
            const newLog: LogEntry = {
                id: crypto.randomUUID(),
                timestamp: formState.timestamp,
                context: currentContext,
                arousal: formState.arousal,
                valence: formState.valence,
                energy: formState.energy,
                sensoryTriggers: formState.sensoryTriggers,
                contextTriggers: formState.contextTriggers,
                strategies: formState.strategies,
                strategyEffectiveness: formState.strategyEffectiveness,
                duration: formState.duration,
                note: formState.note,
            };

            // Validate the log entry before submission
            const validation = validateLogEntryInput(newLog);
            if (!validation.success) {
                showError(t('common.validationError'), validation.errors.join(', '));
                return;
            }

            const success = addLog(newLog);
            if (!success) {
                showError(t('common.error'), t('log.saveError'));
                return;
            }
            showSuccess(t('log.saved'), t('log.savedDescription'));
            onClose();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t('log.saveError');
            showError(t('common.error'), errorMessage);
        }
    };

    // Handle datetime change with fallback support
    const handleTimestampChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch({ type: 'SET_TIMESTAMP', payload: e.target.value });
    };

    // Handle separate date/time inputs for fallback
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const [, time] = formState.timestamp.split('T');
        dispatch({ type: 'SET_TIMESTAMP', payload: `${e.target.value}T${time || '12:00'}` });
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const [date] = formState.timestamp.split('T');
        dispatch({ type: 'SET_TIMESTAMP', payload: `${date}T${e.target.value}` });
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md p-4 overflow-y-auto"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${formId}-title`}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
                    className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-10">
                        <h2 id={`${formId}-title`} className="text-slate-900 dark:text-white text-xl font-bold">{t('log.title')}</h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                            aria-label={t('common.close')}
                        >
                            <X size={24} aria-hidden="true" />
                        </button>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="flex-1 overflow-y-auto flex flex-col"
                        aria-labelledby={`${formId}-title`}
                        noValidate
                    >
                        {/* Scrollable content area */}
                        <div className="p-6 flex flex-col gap-8 pb-24">
                        {/* Date & Time with fallback for unsupported browsers */}
                        <div className="flex flex-col gap-2">
                            <label
                                htmlFor={`${formId}-datetime`}
                                className="text-slate-700 dark:text-slate-300 font-medium text-sm"
                            >
                                {t('log.date')}
                            </label>
                            {dateTimeSupported ? (
                                <input
                                    type="datetime-local"
                                    id={`${formId}-datetime`}
                                    value={formState.timestamp}
                                    onChange={handleTimestampChange}
                                    className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                    aria-describedby={`${formId}-datetime-hint`}
                                />
                            ) : (
                                /* Fallback: separate date and time inputs for older browsers */
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        id={`${formId}-date`}
                                        value={formState.timestamp.split('T')[0]}
                                        onChange={handleDateChange}
                                        className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                        aria-label={t('log.dateOnly')}
                                    />
                                    <input
                                        type="time"
                                        id={`${formId}-time`}
                                        value={formState.timestamp.split('T')[1] || '12:00'}
                                        onChange={handleTimeChange}
                                        className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                        aria-label={t('log.timeOnly')}
                                    />
                                </div>
                            )}
                            <span id={`${formId}-datetime-hint`} className="sr-only">
                                {t('log.dateHint')}
                            </span>
                        </div>

                        {/* Accessible Sliders */}
                        <div className="flex flex-col gap-6 p-6 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                            <AccessibleSlider
                                id={`${formId}-arousal`}
                                label={t('log.arousal.label')}
                                value={formState.arousal}
                                min={1}
                                max={10}
                                onChange={setArousal}
                                lowLabel={t('log.arousal.low')}
                                highLabel={t('log.arousal.high')}
                                gradient="linear-gradient(to right, #4ade80, #facc15, #f87171)"
                            />

                            <AccessibleSlider
                                id={`${formId}-valence`}
                                label={t('log.valence.label')}
                                value={formState.valence}
                                min={1}
                                max={10}
                                onChange={setValence}
                                lowLabel={t('log.valence.low')}
                                highLabel={t('log.valence.high')}
                                gradient="linear-gradient(to right, #f87171, #facc15, #60a5fa)"
                            />

                            <AccessibleSlider
                                id={`${formId}-energy`}
                                label={t('log.energy.label')}
                                value={formState.energy}
                                min={1}
                                max={10}
                                onChange={setEnergy}
                                lowLabel={t('log.energy.low')}
                                highLabel={t('log.energy.high')}
                            />
                        </div>

                        {/* Triggers & Strategies */}
                        <TriggerSelector
                            label={t('log.triggers.sensory')}
                            options={SENSORY_TRIGGERS}
                            selected={formState.sensoryTriggers}
                            onChange={setSensoryTriggers}
                        />

                        <TriggerSelector
                            label={t('log.triggers.context')}
                            options={CONTEXT_TRIGGERS}
                            selected={formState.contextTriggers}
                            onChange={setContextTriggers}
                        />

                        <TriggerSelector
                            label={t('log.strategies')}
                            options={STRATEGIES}
                            selected={formState.strategies}
                            onChange={setStrategies}
                            type="strategy"
                        />

                        {/* Strategy Effectiveness - Improved UX with clearer prompts */}
                        <AnimatePresence mode="wait">
                            {formState.strategies.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    id={`${formId}-effectiveness`}
                                    tabIndex={-1}
                                    className={`flex flex-col gap-3 p-4 rounded-xl transition-colors ${
                                        needsEffectiveness
                                            ? 'bg-red-500/10 border-2 border-red-500/50'
                                            : 'bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5'
                                    }`}
                                    role="group"
                                    aria-labelledby={`${formId}-effectiveness-label`}
                                    aria-describedby={`${formId}-effectiveness-hint`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span
                                                id={`${formId}-effectiveness-label`}
                                                className="text-slate-700 dark:text-slate-300 font-medium text-sm"
                                            >
                                                {t('log.effectiveness.label')} <span className="text-red-500" aria-hidden="true">*</span>
                                                <span className="sr-only">({t('common.required')})</span>
                                            </span>
                                            <button
                                                type="button"
                                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                                aria-label={t('log.effectiveness.helpTooltip')}
                                                title={t('log.effectiveness.helpTooltip')}
                                            >
                                                <HelpCircle size={16} aria-hidden="true" />
                                            </button>
                                        </div>
                                        {needsEffectiveness && (
                                            <span className="text-red-500 text-xs font-medium" role="alert">
                                                {t('log.effectiveness.required')}
                                            </span>
                                        )}
                                    </div>
                                    <p
                                        id={`${formId}-effectiveness-hint`}
                                        className="text-xs text-slate-500 dark:text-slate-400"
                                    >
                                        {t('log.effectiveness.hint')}
                                    </p>
                                    <div className="flex gap-2" role="radiogroup" aria-required="true">
                                        <button
                                            type="button"
                                            onClick={() => setStrategyEffectiveness('helped')}
                                            role="radio"
                                            aria-checked={formState.strategyEffectiveness === 'helped'}
                                            className={`flex-1 p-3 rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                                formState.strategyEffectiveness === 'helped'
                                                    ? 'bg-green-500 text-white focus:ring-green-500'
                                                    : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 focus:ring-slate-400'
                                            }`}
                                        >
                                            {t('log.effectiveness.helped')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStrategyEffectiveness('no_change')}
                                            role="radio"
                                            aria-checked={formState.strategyEffectiveness === 'no_change'}
                                            className={`flex-1 p-3 rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                                formState.strategyEffectiveness === 'no_change'
                                                    ? 'bg-yellow-500 text-white focus:ring-yellow-500'
                                                    : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 focus:ring-slate-400'
                                            }`}
                                        >
                                            {t('log.effectiveness.noChange')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStrategyEffectiveness('escalated')}
                                            role="radio"
                                            aria-checked={formState.strategyEffectiveness === 'escalated'}
                                            className={`flex-1 p-3 rounded-xl text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                                formState.strategyEffectiveness === 'escalated'
                                                    ? 'bg-red-500 text-white focus:ring-red-500'
                                                    : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 focus:ring-slate-400'
                                            }`}
                                        >
                                            {t('log.effectiveness.escalated')}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Duration */}
                        <div className="flex flex-col gap-2">
                            <label
                                htmlFor={`${formId}-duration`}
                                className="text-slate-700 dark:text-slate-300 font-medium text-sm"
                            >
                                {t('log.duration')}
                            </label>
                            <input
                                type="number"
                                id={`${formId}-duration`}
                                value={formState.duration}
                                onChange={(e) => dispatch({ type: 'SET_DURATION', payload: Math.min(1440, Math.max(0, Number(e.target.value))) })}
                                min="0"
                                max="1440"
                                className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                aria-describedby={`${formId}-duration-hint`}
                            />
                            <span id={`${formId}-duration-hint`} className="sr-only">
                                {t('log.durationHint')}
                            </span>
                        </div>

                        {/* Notes */}
                        <div className="flex flex-col gap-2">
                            <label
                                htmlFor={`${formId}-notes`}
                                className="text-slate-700 dark:text-slate-300 font-medium text-sm"
                            >
                                {t('log.notes.label')}
                            </label>
                            <textarea
                                id={`${formId}-notes`}
                                value={formState.note}
                                onChange={(e) => dispatch({ type: 'SET_NOTE', payload: e.target.value })}
                                placeholder={t('log.notes.placeholder')}
                                className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary h-32 resize-y transition-all"
                            />
                        </div>
                        </div>
                        {/* End scrollable content */}

                        {/* Fixed button at bottom */}
                        <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
                            <motion.button
                                type="submit"
                                whileTap={{ scale: 0.98 }}
                                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            >
                                {t('log.save')}
                            </motion.button>
                        </div>
                    </form>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

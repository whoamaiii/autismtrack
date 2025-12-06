import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useLogs, useAppContext } from '../store';
import { type LogEntry, SENSORY_TRIGGERS, CONTEXT_TRIGGERS, STRATEGIES } from '../types';
import { TriggerSelector } from './TriggerSelector';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface LogEntryFormProps {
    onClose: () => void;
}

export const LogEntryForm: React.FC<LogEntryFormProps> = ({ onClose }) => {
    const { addLog } = useLogs();
    const { currentContext } = useAppContext();
    const { t } = useTranslation();
    const [arousal, setArousal] = useState(5);
    const [valence, setValence] = useState(5);
    const [energy, setEnergy] = useState(5);
    const [sensoryTriggers, setSensoryTriggers] = useState<string[]>([]);
    const [contextTriggers, setContextTriggers] = useState<string[]>([]);
    const [strategies, setStrategies] = useState<string[]>([]);
    const [strategyEffectiveness, setStrategyEffectiveness] = useState<'helped' | 'no_change' | 'escalated' | undefined>(undefined);
    const [duration, setDuration] = useState<number>(15);
    const [note, setNote] = useState('');
    const [timestamp, setTimestamp] = useState(new Date().toISOString().slice(0, 16));

    // Validation: require effectiveness when strategies are selected
    const needsEffectiveness = strategies.length > 0 && !strategyEffectiveness;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate strategy effectiveness is set when strategies are used
        if (needsEffectiveness) {
            return; // Don't submit if validation fails
        }

        const newLog: LogEntry = {
            id: uuidv4(),
            timestamp,
            context: currentContext,
            arousal,
            valence,
            energy,
            sensoryTriggers,
            contextTriggers,
            strategies,
            strategyEffectiveness,
            duration,
            note,
        };
        addLog(newLog);
        onClose();
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md p-4 overflow-y-auto"
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
                    className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-10">
                        <h2 className="text-slate-900 dark:text-white text-xl font-bold">{t('log.title')}</h2>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
                        {/* Date & Time */}
                        <label className="flex flex-col gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t('log.date')}</span>
                            <input
                                type="datetime-local"
                                value={timestamp}
                                onChange={(e) => setTimestamp(e.target.value)}
                                className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                            />
                        </label>

                        {/* Sliders */}
                        <div className="flex flex-col gap-6 p-6 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                            {/* Arousal */}
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{t('log.arousal.label')}</span>
                                    <span className="text-slate-900 dark:text-white font-bold bg-white dark:bg-white/10 px-3 py-1 rounded-lg">{arousal}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={arousal}
                                    onChange={(e) => setArousal(Number(e.target.value))}
                                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary"
                                    style={{ background: 'linear-gradient(to right, #4ade80, #facc15, #f87171)' }}
                                />
                                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    <span>{t('log.arousal.low')}</span>
                                    <span>{t('log.arousal.high')}</span>
                                </div>
                            </div>

                            {/* Valence */}
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{t('log.valence.label')}</span>
                                    <span className="text-slate-900 dark:text-white font-bold bg-white dark:bg-white/10 px-3 py-1 rounded-lg">{valence}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={valence}
                                    onChange={(e) => setValence(Number(e.target.value))}
                                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary"
                                    style={{ background: 'linear-gradient(to right, #f87171, #facc15, #60a5fa)' }}
                                />
                                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    <span>{t('log.valence.low')}</span>
                                    <span>{t('log.valence.high')}</span>
                                </div>
                            </div>

                            {/* Energy */}
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{t('log.energy.label')}</span>
                                    <span className="text-slate-900 dark:text-white font-bold bg-white dark:bg-white/10 px-3 py-1 rounded-lg">{energy}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={energy}
                                    onChange={(e) => setEnergy(Number(e.target.value))}
                                    className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 appearance-none cursor-pointer accent-primary"
                                />
                                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    <span>{t('log.energy.low')}</span>
                                    <span>{t('log.energy.high')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Triggers & Strategies */}
                        <TriggerSelector
                            label={t('log.triggers.sensory')}
                            options={SENSORY_TRIGGERS}
                            selected={sensoryTriggers}
                            onChange={setSensoryTriggers}
                        />

                        <TriggerSelector
                            label={t('log.triggers.context')}
                            options={CONTEXT_TRIGGERS}
                            selected={contextTriggers}
                            onChange={setContextTriggers}
                        />

                        <TriggerSelector
                            label={t('log.strategies')}
                            options={STRATEGIES}
                            selected={strategies}
                            onChange={setStrategies}
                        />

                        {/* Strategy Effectiveness - Required when strategies are selected */}
                        {strategies.length > 0 && (
                            <div className={`flex flex-col gap-2 p-4 rounded-xl transition-all ${needsEffectiveness
                                    ? 'bg-red-500/10 border-2 border-red-500/50'
                                    : 'bg-slate-50 dark:bg-white/5'
                                }`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-700 dark:text-slate-300 font-medium text-sm">
                                        {t('log.effectiveness.label')} <span className="text-red-500">*</span>
                                    </span>
                                    {needsEffectiveness && (
                                        <span className="text-red-500 text-xs font-medium">{t('log.effectiveness.required')}</span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setStrategyEffectiveness('helped')}
                                        className={`flex-1 p-3 rounded-xl text-sm font-medium transition-all ${strategyEffectiveness === 'helped'
                                                ? 'bg-green-500 text-white'
                                                : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20'
                                            }`}
                                    >
                                        {t('log.effectiveness.helped')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStrategyEffectiveness('no_change')}
                                        className={`flex-1 p-3 rounded-xl text-sm font-medium transition-all ${strategyEffectiveness === 'no_change'
                                                ? 'bg-yellow-500 text-white'
                                                : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20'
                                            }`}
                                    >
                                        {t('log.effectiveness.noChange')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStrategyEffectiveness('escalated')}
                                        className={`flex-1 p-3 rounded-xl text-sm font-medium transition-all ${strategyEffectiveness === 'escalated'
                                                ? 'bg-red-500 text-white'
                                                : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20'
                                            }`}
                                    >
                                        {t('log.effectiveness.escalated')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Duration & Notes */}
                        <label className="flex flex-col gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t('log.duration')}</span>
                            <input
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(Number(e.target.value))}
                                className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                            />
                        </label>

                        <label className="flex flex-col gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium text-sm">{t('log.notes.label')}</span>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder={t('log.notes.placeholder')}
                                className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary h-32 resize-y transition-all"
                            />
                        </label>
                    </form>

                    <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky bottom-0 z-10">
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSubmit}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 transition-colors"
                        >
                            {t('log.save')}
                        </motion.button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

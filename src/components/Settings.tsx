import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useChildProfile } from '../store';
import {
    ArrowLeft,
    User,
    Save,
    Trash2,
    Check,
    Brain,
    MessageSquare,
    Zap,
    Heart,
    Info,
    AlertTriangle,
    Download,
    Upload,
    Database,
    RefreshCw,
    Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ChildProfile } from '../types';
import {
    DIAGNOSIS_OPTIONS,
    COMMUNICATION_STYLES,
    SENSORY_TRIGGERS,
    STRATEGIES
} from '../types';
import { downloadExport, importData, exportAllData, type ImportResult } from '../utils/exportData';
// Note: demoData is now dynamically imported for bundle optimization
import { useTranslation } from 'react-i18next';
import { generateUUID } from '../utils/uuid';
import { useSettings } from '../store';
import { useToast } from './Toast';

// Multi-select chip component with keyboard accessibility
const ChipSelect: React.FC<{
    options: readonly { value: string; label: string }[] | string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    maxSelect?: number;
    /** Optional translation key prefix for labels (e.g., 'settings.diagnoses.options') */
    translatePrefix?: string;
}> = ({ options, selected, onChange, maxSelect, translatePrefix }) => {
    const { t } = useTranslation();

    const toggleOption = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter(s => s !== value));
        } else if (!maxSelect || selected.length < maxSelect) {
            onChange([...selected, value]);
        }
    };

    return (
        <div className="flex flex-wrap gap-2" role="group">
            {options.map(opt => {
                const value = typeof opt === 'string' ? opt : opt.value;
                const fallbackLabel = typeof opt === 'string' ? opt : opt.label;
                // Use translation if prefix is provided, otherwise use fallback label
                const label = translatePrefix ? t(`${translatePrefix}.${value}`, fallbackLabel) : fallbackLabel;
                const isSelected = selected.includes(value);
                const isDisabled = !isSelected && maxSelect !== undefined && selected.length >= maxSelect;

                return (
                    <button
                        key={value}
                        type="button"
                        onClick={() => toggleOption(value)}
                        aria-pressed={isSelected}
                        aria-label={label}
                        disabled={isDisabled}
                        className={`
                            px-3 py-1.5 rounded-full text-sm font-medium transition-all
                            focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-1 focus:ring-offset-slate-900
                            ${isSelected
                                ? 'bg-primary text-white'
                                : 'bg-white/10 text-slate-300 hover:bg-white/20'
                            }
                            ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
};

export const Settings: React.FC = () => {
    const { t } = useTranslation();
    const { childProfile, setChildProfile, updateChildProfile, clearChildProfile } = useChildProfile();
    const { refreshData } = useSettings();
    const { showSuccess } = useToast();

    // Loading state for perceived performance
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    useEffect(() => {
        const timer = setTimeout(() => setIsInitialLoading(false), 300);
        return () => clearTimeout(timer);
    }, []);

    // Form state - initialized from childProfile
    const [name, setName] = useState(childProfile?.name || '');
    const [age, setAge] = useState<number | ''>(childProfile?.age || '');
    const [diagnoses, setDiagnoses] = useState<string[]>(childProfile?.diagnoses || []);
    const [communicationStyle, setCommunicationStyle] = useState<ChildProfile['communicationStyle']>(childProfile?.communicationStyle || 'verbal');
    const [sensorySensitivities, setPrimarySensitivities] = useState<string[]>(childProfile?.sensorySensitivities || []);
    const [seekingSensory, setSeekingSensory] = useState<string[]>(childProfile?.seekingSensory || []);
    const [effectiveStrategies, setEffectiveStrategies] = useState<string[]>(childProfile?.effectiveStrategies || []);
    const [additionalContext, setAdditionalContext] = useState(childProfile?.additionalContext || '');

    const [saved, setSaved] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Export/Import state
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
    const [pendingImportData, setPendingImportData] = useState<string | null>(null);
    // Compute data stats directly (no state needed)
    const dataStats = useMemo(() => {
        const data = exportAllData();
        return {
            logs: data.summary.totalLogs,
            crisis: data.summary.totalCrisisEvents,
            goals: data.goals.length
        };
    }, []);

    // Sync form state when childProfile changes externally (e.g., after import)
    const childProfileId = childProfile?.id;
    useEffect(() => {
        if (childProfile && childProfileId) {
            setName(childProfile.name);
            setAge(childProfile.age || '');
            setDiagnoses(childProfile.diagnoses);
            setCommunicationStyle(childProfile.communicationStyle);
            setPrimarySensitivities(childProfile.sensorySensitivities);
            setSeekingSensory(childProfile.seekingSensory);
            setEffectiveStrategies(childProfile.effectiveStrategies);
            setAdditionalContext(childProfile.additionalContext || '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [childProfileId]);

    const handleSave = () => {
        const now = new Date().toISOString();
        const profile: ChildProfile = {
            id: childProfile?.id || generateUUID(),
            name: name || 'Mitt barn',
            age: age === '' ? undefined : age,
            diagnoses,
            communicationStyle,
            sensorySensitivities,
            seekingSensory,
            effectiveStrategies,
            additionalContext: additionalContext || undefined,
            createdAt: childProfile?.createdAt || now,
            updatedAt: now
        };

        if (childProfile) {
            updateChildProfile(profile);
        } else {
            setChildProfile(profile);
        }

        showSuccess(t('settings.profileSaved'), t('settings.profileSavedDescription'));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleDelete = () => {
        clearChildProfile();
        setName('');
        setAge('');
        setDiagnoses([]);
        setCommunicationStyle('verbal');
        setPrimarySensitivities([]);
        setSeekingSensory([]);
        setEffectiveStrategies([]);
        setAdditionalContext('');
        setShowDeleteConfirm(false);
    };

    // Export handler
    const handleExport = () => {
        downloadExport();
    };

    // Import file selection handler with error handling
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.name.endsWith('.json')) {
            setImportResult({ success: false, error: t('settings.import.invalidFileType') });
            setShowImportModal(true);
            e.target.value = '';
            return;
        }

        const reader = new FileReader();

        reader.onload = (event) => {
            const content = event.target?.result as string;
            setPendingImportData(content);
            setShowImportModal(true);
        };

        reader.onerror = () => {
            setImportResult({ success: false, error: t('settings.import.readError') });
            setShowImportModal(true);
        };

        reader.onabort = () => {
            setImportResult({ success: false, error: t('settings.import.readAborted') });
            setShowImportModal(true);
        };

        reader.readAsText(file);

        // Reset input so same file can be selected again
        e.target.value = '';
    };

    // Confirm import handler
    const handleConfirmImport = () => {
        if (!pendingImportData) return;

        const result = importData(pendingImportData, importMode);
        setImportResult(result);

        if (result.success) {
            // Refresh all contexts from localStorage without page reload
            refreshData();

            // Close modal after brief delay to show success
            setTimeout(() => {
                setShowImportModal(false);
                setImportResult(null);
            }, 1500);
        }

        setPendingImportData(null);
    };

    // Loading skeleton
    if (isInitialLoading) {
        return (
            <div className="flex flex-col gap-6 py-6 pb-24 animate-pulse">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-700" />
                    <div>
                        <div className="h-6 w-32 bg-slate-700 rounded mb-1" />
                        <div className="h-4 w-48 bg-slate-800 rounded" />
                    </div>
                </div>
                <div className="h-24 bg-slate-800 rounded-2xl" />
                <div className="h-32 bg-slate-800 rounded-2xl" />
                <div className="h-40 bg-slate-800 rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 py-6 pb-24">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link to="/" className="p-2 rounded-full hover:bg-white/10 transition-colors" aria-label={t('settings.goBack')}>
                    <ArrowLeft className="text-white" size={24} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white">{t('settings.title')}</h1>
                    <p className="text-slate-400 text-sm">{t('settings.subtitle')}</p>
                </div>
            </div>

            {/* Info Banner */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="liquid-glass-card p-4 rounded-2xl"
            >
                <div className="flex items-start gap-3">
                    <Info size={20} className="text-primary mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm text-slate-300">
                            {t('settings.infoBanner')}
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Profile Form */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="liquid-glass-card p-5 rounded-3xl space-y-6"
            >
                {/* Basic Info */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <User size={18} className="text-primary" />
                        <h2 className="text-lg font-bold text-white">{t('settings.basicInfo')}</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">
                                {t('settings.nameLabel')}
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value.slice(0, 50))}
                                placeholder={t('settings.namePlaceholder')}
                                maxLength={50}
                                className="w-full bg-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <span className={`text-xs mt-1 block ${name.length >= 45 ? 'text-orange-400' : 'text-slate-500'}`}>
                                {name.length}/50
                            </span>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-2">
                                {t('settings.ageLabel')}
                            </label>
                            <input
                                type="number"
                                value={age}
                                onChange={(e) => {
                                    if (e.target.value === '') {
                                        setAge('');
                                    } else {
                                        const val = parseInt(e.target.value, 10);
                                        // Clamp value between 0 and 25
                                        setAge(Math.min(25, Math.max(0, isNaN(val) ? 0 : val)));
                                    }
                                }}
                                min={0}
                                max={25}
                                placeholder={t('settings.agePlaceholder')}
                                className="w-32 bg-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>
                </div>

                {/* Diagnoses */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Brain size={18} className="text-purple-400" />
                        <h2 className="text-lg font-bold text-white">{t('settings.diagnoses.title')}</h2>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{t('settings.diagnoses.subtitle')}</p>
                    <ChipSelect
                        options={DIAGNOSIS_OPTIONS}
                        selected={diagnoses}
                        onChange={setDiagnoses}
                        translatePrefix="settings.diagnoses.options"
                    />
                </div>

                {/* Communication Style */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <MessageSquare size={18} className="text-green-400" />
                        <h2 className="text-lg font-bold text-white">{t('settings.communication.title')}</h2>
                    </div>
                    <div className="space-y-2">
                        {COMMUNICATION_STYLES.map(style => (
                            <button
                                key={style.value}
                                type="button"
                                onClick={() => setCommunicationStyle(style.value as ChildProfile['communicationStyle'])}
                                className={`
                                    w-full text-left px-4 py-3 rounded-xl transition-all
                                    ${communicationStyle === style.value
                                        ? 'bg-primary/20 border border-primary text-white'
                                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                                    }
                                `}
                            >
                                {t(`settings.communication.options.${style.value}`, style.label)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sensory Sensitivities */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Zap size={18} className="text-orange-400" />
                        <h2 className="text-lg font-bold text-white">{t('settings.sensoryChallenges.title')}</h2>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{t('settings.sensoryChallenges.subtitle')}</p>
                    <ChipSelect
                        options={SENSORY_TRIGGERS.map(trigger => ({ value: trigger, label: trigger }))}
                        selected={sensorySensitivities}
                        onChange={setPrimarySensitivities}
                        maxSelect={5}
                        translatePrefix="domain.sensory"
                    />
                </div>

                {/* Sensory Seeking */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Heart size={18} className="text-pink-400" />
                        <h2 className="text-lg font-bold text-white">{t('settings.sensorySeeking.title')}</h2>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{t('settings.sensorySeeking.subtitle')}</p>
                    <ChipSelect
                        options={SENSORY_TRIGGERS.map(trigger => ({ value: trigger, label: trigger }))}
                        selected={seekingSensory}
                        onChange={setSeekingSensory}
                        maxSelect={5}
                        translatePrefix="domain.sensory"
                    />
                </div>

                {/* Effective Strategies */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Check size={18} className="text-emerald-400" />
                        <h2 className="text-lg font-bold text-white">{t('settings.strategies.title')}</h2>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{t('settings.strategies.subtitle')}</p>
                    <ChipSelect
                        options={STRATEGIES.map(s => ({ value: s, label: s }))}
                        selected={effectiveStrategies}
                        onChange={setEffectiveStrategies}
                        translatePrefix="domain.strategies"
                    />
                </div>

                {/* Additional Context */}
                <div>
                    <label className="block text-sm text-slate-400 mb-2">
                        {t('settings.additionalContext.label')}
                    </label>
                    <textarea
                        value={additionalContext}
                        onChange={(e) => setAdditionalContext(e.target.value)}
                        placeholder={t('settings.additionalContext.placeholder')}
                        rows={3}
                        className="w-full bg-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        {t('settings.additionalContext.note')}
                    </p>
                </div>
            </motion.div>

            {/* Data Management Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="liquid-glass-card p-5 rounded-3xl space-y-6"
            >
                <div className="flex items-center gap-2 mb-4">
                    <Database size={18} className="text-blue-400" />
                    <h2 className="text-lg font-bold text-white">{t('settings.dataManagement.title')}</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Export */}
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                        <div className="flex items-center gap-3 mb-3">
                            <Download className="text-blue-400" size={24} />
                            <div>
                                <h3 className="font-bold text-white">{t('settings.dataManagement.export.title')}</h3>
                                <p className="text-xs text-slate-400">{t('settings.dataManagement.export.subtitle')}</p>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">
                            {t('settings.dataManagement.export.desc')}
                        </p>
                        <button
                            onClick={handleExport}
                            className="w-full py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-medium text-sm transition-colors"
                        >
                            {t('settings.dataManagement.export.button')}
                        </button>
                    </div>

                    {/* Import */}
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                        <div className="flex items-center gap-3 mb-3">
                            <Upload className="text-purple-400" size={24} />
                            <div>
                                <h3 className="font-bold text-white">{t('settings.dataManagement.import.title')}</h3>
                                <p className="text-xs text-slate-400">{t('settings.dataManagement.import.subtitle')}</p>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">
                            {t('settings.dataManagement.import.desc')}
                        </p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 font-medium text-sm transition-colors"
                        >
                            {t('settings.dataManagement.import.button')}
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept=".json"
                            className="hidden"
                        />
                    </div>

                    {/* Demo Data - For Kaggle Competition */}
                    <div className="bg-white/5 p-4 rounded-xl border border-amber-500/30 md:col-span-2">
                        <div className="flex items-center gap-3 mb-3">
                            <Sparkles className="text-amber-400" size={24} />
                            <div>
                                <h3 className="font-bold text-white">{t('settings.dataManagement.demo.title')}</h3>
                                <p className="text-xs text-slate-400">{t('settings.dataManagement.demo.subtitle')}</p>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">
                            {t('settings.dataManagement.demo.desc')}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    if (confirm(t('settings.dataManagement.demo.confirmLoad'))) {
                                        // Dynamic import for bundle optimization
                                        const { loadDemoData } = await import('../utils/demoData');
                                        loadDemoData();
                                        window.location.reload();
                                    }
                                }}
                                className="flex-1 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 font-medium text-sm transition-colors"
                            >
                                {t('settings.dataManagement.demo.loadButton')}
                            </button>
                            <button
                                onClick={async () => {
                                    if (confirm(t('settings.dataManagement.demo.confirmClear'))) {
                                        // Dynamic import for bundle optimization
                                        const { clearDemoData } = await import('../utils/demoData');
                                        clearDemoData();
                                        window.location.reload();
                                    }
                                }}
                                className="py-2 px-4 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium text-sm transition-colors"
                                aria-label={t('settings.dataManagement.demo.clearButton')}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between text-xs text-slate-500 px-2">
                    <span>{t('settings.stats.logs')}: {dataStats.logs}</span>
                    <span>{t('settings.stats.events')}: {dataStats.crisis}</span>
                    <span>{t('settings.stats.goals')}: {dataStats.goals}</span>
                </div>
            </motion.div>

            {/* Save Profile Button */}
            <div className="flex gap-3">
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSave}
                    className={`
                        flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white transition-all
                        ${saved ? 'bg-emerald-500' : 'bg-primary hover:bg-primary/80'}
                    `}
                >
                    {saved ? (
                        <>
                            <Check size={20} />
                            {t('settings.save.saved')}
                        </>
                    ) : (
                        <>
                            <Save size={20} />
                            {t('settings.save.button')}
                        </>
                    )}
                </motion.button>

                {childProfile && (
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-4 rounded-2xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        aria-label={t('settings.delete.button')}
                    >
                        <Trash2 size={20} />
                    </motion.button>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50"
                    onClick={() => setShowDeleteConfirm(false)}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="liquid-glass-card p-6 rounded-3xl max-w-sm w-full"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-500/20 rounded-full">
                                <AlertTriangle className="text-red-400" size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white">{t('settings.delete.modal.title')}</h3>
                        </div>
                        <p className="text-slate-300 mb-6">
                            {t('settings.delete.modal.desc')}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                            >
                                {t('settings.delete.modal.cancel')}
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
                            >
                                {t('settings.delete.modal.confirm')}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}

            {/* Import Modal */}
            {showImportModal && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="liquid-glass-card p-6 rounded-3xl max-w-md w-full"
                    >
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <RefreshCw size={24} className="text-purple-400" />
                            {t('settings.dataManagement.import.modal.title')}
                        </h3>

                        <p className="text-slate-300 mb-6">
                            {t('settings.dataManagement.import.modal.desc')}
                        </p>

                        <div className="space-y-3 mb-6">
                            <button
                                onClick={() => setImportMode('replace')}
                                className={`w-full p-3 rounded-xl border text-left transition-all ${importMode === 'replace'
                                    ? 'bg-red-500/20 border-red-500 text-white'
                                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                                    }`}
                            >
                                <div className="font-bold text-sm">{t('settings.dataManagement.import.modal.replace.title')}</div>
                                <div className="text-xs opacity-70">{t('settings.dataManagement.import.modal.replace.desc')}</div>
                            </button>

                            <button
                                onClick={() => setImportMode('merge')}
                                className={`w-full p-3 rounded-xl border text-left transition-all ${importMode === 'merge'
                                    ? 'bg-blue-500/20 border-blue-500 text-white'
                                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                                    }`}
                            >
                                <div className="font-bold text-sm">{t('settings.dataManagement.import.modal.merge.title')}</div>
                                <div className="text-xs opacity-70">{t('settings.dataManagement.import.modal.merge.desc')}</div>
                            </button>
                        </div>

                        {importResult?.error && (
                            <div className="mb-4 p-3 rounded-xl bg-red-500/20 text-red-300 text-sm flex items-center gap-2">
                                <AlertTriangle size={16} />
                                {importResult.error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowImportModal(false);
                                    setPendingImportData(null);
                                    setImportResult(null);
                                }}
                                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                            >
                                {t('settings.dataManagement.import.modal.cancel')}
                            </button>
                            <button
                                onClick={handleConfirmImport}
                                className="flex-1 py-3 rounded-xl bg-purple-500 text-white font-medium hover:bg-purple-600 transition-colors"
                            >
                                {t('settings.dataManagement.import.modal.confirm')}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </div>
    );
};

export default Settings;

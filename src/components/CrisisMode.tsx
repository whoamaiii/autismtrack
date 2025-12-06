import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Square, AlertTriangle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { useCrisis, useAppContext } from '../store';
import {
    type CrisisType,
    type CrisisResolution,
    CRISIS_TYPES,
    SENSORY_TRIGGERS,
    CONTEXT_TRIGGERS,
    STRATEGIES,
    WARNING_SIGNS
} from '../types';
import { TriggerSelector } from './TriggerSelector';
import { useTranslation } from 'react-i18next';

export const CrisisMode: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { addCrisisEvent } = useCrisis();
    const { currentContext } = useAppContext();

    // Timer state
    const [isActive, setIsActive] = useState(true);
    const [seconds, setSeconds] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [startTime] = useState(new Date().toISOString());

    // Crisis details state (collected after stopping)
    const [showDetailsForm, setShowDetailsForm] = useState(false);
    const [crisisType, setCrisisType] = useState<CrisisType>('meltdown');
    const [peakIntensity, setPeakIntensity] = useState(7);
    const [warningSignsObserved, setWarningSignsObserved] = useState<string[]>([]);
    const [sensoryTriggers, setSensoryTriggers] = useState<string[]>([]);
    const [contextTriggers, setContextTriggers] = useState<string[]>([]);
    const [strategiesUsed, setStrategiesUsed] = useState<string[]>([]);
    const [resolution, setResolution] = useState<CrisisResolution>('co_regulated');
    const [notes, setNotes] = useState('');

    // Audio Recording refs - declared early so cleanup effect can access them
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const audioChunksRef = React.useRef<Blob[]>([]);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;
        if (isActive) {
            interval = setInterval(() => {
                setSeconds((seconds) => seconds + 1);
            }, 1000);
        } else if (!isActive && seconds !== 0) {
            if (interval) clearInterval(interval);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isActive, seconds]);

    // Cleanup media stream on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current) {
                if (mediaRecorderRef.current.state === 'recording') {
                    mediaRecorderRef.current.stop();
                }
                mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const formatTime = (totalSeconds: number) => {
        const minutes = Math.floor(totalSeconds / 60);
        const remainingSeconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    // Audio Recording Logic
    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                try {
                    const base64Url = await blobToBase64(audioBlob);
                    setAudioUrl(base64Url);
                } catch (error) {
                    if (import.meta.env.DEV) {
                        console.error('Failed to process audio recording:', error);
                    }
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Error accessing microphone:', error);
            }
            alert('Kunne ikke starte opptak. Sjekk at du har gitt tilgang til mikrofonen.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop()); // Stop stream
            setIsRecording(false);
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const handleStop = () => {
        if (isRecording) {
            stopRecording();
        }
        setIsActive(false);
        setShowDetailsForm(true);
    };

    const handleSave = () => {
        // Save crisis event to store
        addCrisisEvent({
            id: uuidv4(),
            timestamp: startTime,
            context: currentContext,
            type: crisisType,
            durationSeconds: seconds,
            peakIntensity,
            warningSignsObserved,
            sensoryTriggers,
            contextTriggers,
            strategiesUsed,
            resolution,
            hasAudioRecording: !!audioUrl,
            audioUrl: audioUrl || undefined,
            notes
        });

        navigate('/');
    };

    const handleSkipDetails = () => {
        // Save with minimal data
        addCrisisEvent({
            id: uuidv4(),
            timestamp: startTime,
            context: currentContext,
            type: 'other',
            durationSeconds: seconds,
            peakIntensity: 5,
            warningSignsObserved: [],
            sensoryTriggers: [],
            contextTriggers: [],
            strategiesUsed: [],
            resolution: 'other',
            hasAudioRecording: !!audioUrl,
            audioUrl: audioUrl || undefined,
            notes: ''
        });

        navigate('/');
    };

    const resolutionOptions: { value: CrisisResolution; label: string }[] = [
        { value: 'self_regulated', label: 'Selvregulert' },
        { value: 'co_regulated', label: 'Samregulert (med hjelp)' },
        { value: 'timed_out', label: 'Gikk over av seg selv' },
        { value: 'interrupted', label: 'Avbrutt' },
        { value: 'other', label: 'Annet' }
    ];

    return (
        <div className="flex flex-col min-h-screen text-white relative overflow-hidden">
            {/* Background Pulse Animation for Crisis Mode */}
            <AnimatePresence>
                {isActive && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none"
                    >
                        <div className="w-[300px] h-[300px] bg-red-500/20 rounded-full animate-ping opacity-75"></div>
                        <div className="absolute w-[500px] h-[500px] bg-red-500/10 rounded-full animate-pulse"></div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative z-10 flex flex-col flex-1 p-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex justify-between items-center mb-8"
                >
                    <div className="flex items-center gap-2 text-red-500">
                        <AlertTriangle size={28} />
                        <span className="font-bold text-xl tracking-wider uppercase">{t('crisis.title')}</span>
                    </div>
                </motion.div>

                {/* Main Content */}
                <AnimatePresence mode="wait">
                    {!showDetailsForm ? (
                        // Timer View
                        <motion.div
                            key="timer"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 flex flex-col items-center justify-center gap-8"
                        >
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                                className="text-center"
                            >
                                <p className="text-slate-400 text-lg mb-2 font-medium uppercase tracking-widest">{t('crisis.duration')}</p>
                                <div className={`text-8xl font-bold tabular-nums tracking-tighter ${isActive ? 'text-white' : 'text-slate-300'}`}>
                                    {formatTime(seconds)}
                                </div>
                            </motion.div>

                            <div className="flex flex-col gap-6 w-full max-w-xs">
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleStop}
                                    className="w-full bg-red-600 hover:bg-red-700 transition-colors h-24 rounded-2xl flex items-center justify-center gap-4 shadow-lg shadow-red-900/50"
                                >
                                    <Square size={32} fill="currentColor" />
                                    <span className="text-2xl font-bold">{t('crisis.stopEvent')}</span>
                                </motion.button>

                                <motion.button
                                    whileTap={{ scale: 0.98 }}
                                    onClick={toggleRecording}
                                    className={`w-full h-20 rounded-2xl flex items-center justify-center gap-3 transition-all border-2 ${isRecording
                                        ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse'
                                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                        }`}
                                >
                                    <Mic size={24} />
                                    <span className="text-lg font-bold">{isRecording ? t('crisis.stopRecording') : t('crisis.startRecording')}</span>
                                </motion.button>
                            </div>

                            <p className="text-slate-500 text-sm text-center">
                                {t('crisis.recordingActive')}
                            </p>
                        </motion.div>
                    ) : (
                        // Details Form
                        <motion.div
                            key="details"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 overflow-y-auto pb-32"
                        >
                            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl text-center mb-6">
                                <CheckCircle className="mx-auto text-green-500 mb-2" size={36} />
                                <h3 className="text-lg font-bold text-white">{t('crisis.eventEnded')}</h3>
                                <p className="text-slate-400">{t('crisis.duration')}: {formatTime(seconds)}</p>
                            </div>

                            <h2 className="text-white text-lg font-bold mb-4">{t('crisis.documentEvent')}</h2>

                            {/* Audio Player if recorded */}
                            {audioUrl && (
                                <div className="mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700">
                                    <div className="flex items-center gap-3 mb-2 text-slate-300">
                                        <Mic size={18} className="text-red-400" />
                                        <span className="text-sm font-bold">{t('crisis.audioSaved')}</span>
                                    </div>
                                    <audio controls src={audioUrl} className="w-full h-8" />
                                </div>
                            )}

                            <p className="text-slate-400 text-sm mb-6">{t('crisis.helperText')}</p>

                            <div className="space-y-6">
                                {/* Crisis Type */}
                                <div>
                                    <label className="text-slate-300 font-medium text-sm block mb-2">{t('crisis.type')}</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {CRISIS_TYPES.map((type) => (
                                            <button
                                                key={type.value}
                                                onClick={() => setCrisisType(type.value)}
                                                className={`p-3 rounded-xl text-sm font-medium transition-all ${crisisType === type.value
                                                    ? 'bg-red-500 text-white'
                                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                                    }`}
                                            >
                                                {type.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Peak Intensity */}
                                <div>
                                    <label className="text-slate-300 font-medium text-sm block mb-2">
                                        {t('crisis.intensity.label')}: <span className="text-white font-bold">{peakIntensity}</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        value={peakIntensity}
                                        onChange={(e) => setPeakIntensity(Number(e.target.value))}
                                        className="w-full h-2 rounded-full appearance-none cursor-pointer"
                                        style={{ background: 'linear-gradient(to right, #facc15, #f97316, #ef4444)' }}
                                    />
                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                        <span>{t('crisis.intensity.mild')}</span>
                                        <span>{t('crisis.intensity.extreme')}</span>
                                    </div>
                                </div>

                                {/* Warning Signs */}
                                <TriggerSelector
                                    label={t('crisis.warningSigns')}
                                    options={WARNING_SIGNS}
                                    selected={warningSignsObserved}
                                    onChange={setWarningSignsObserved}
                                />

                                {/* Sensory Triggers */}
                                <TriggerSelector
                                    label={t('crisis.sensoryTriggers')}
                                    options={SENSORY_TRIGGERS}
                                    selected={sensoryTriggers}
                                    onChange={setSensoryTriggers}
                                />

                                {/* Context Triggers */}
                                <TriggerSelector
                                    label={t('crisis.contextTriggers')}
                                    options={CONTEXT_TRIGGERS}
                                    selected={contextTriggers}
                                    onChange={setContextTriggers}
                                />

                                {/* Strategies Used */}
                                <TriggerSelector
                                    label={t('crisis.strategiesUsed')}
                                    options={STRATEGIES}
                                    selected={strategiesUsed}
                                    onChange={setStrategiesUsed}
                                />

                                {/* Resolution */}
                                <div>
                                    <label className="text-slate-300 font-medium text-sm block mb-2">{t('crisis.resolution')}</label>
                                    <div className="space-y-2">
                                        {resolutionOptions.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setResolution(opt.value)}
                                                className={`w-full p-3 rounded-xl text-sm font-medium text-left transition-all ${resolution === opt.value
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="text-slate-300 font-medium text-sm block mb-2">{t('crisis.notes.label')}</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder={t('crisis.notes.placeholder')}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Bottom Actions (when showing details form) */}
                {showDetailsForm && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent"
                    >
                        <div className="flex gap-3 max-w-md mx-auto">
                            <button
                                onClick={handleSkipDetails}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-xl font-bold transition-colors"
                            >
                                {t('crisis.actions.skip')}
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold transition-colors"
                            >
                                {t('crisis.actions.save')}
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

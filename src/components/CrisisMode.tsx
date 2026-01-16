import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Square, AlertTriangle, CheckCircle, AlertCircle, RefreshCw, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useCrisis, useAppContext } from '../store';
import {
    type CrisisType,
    type CrisisResolution,
    type CrisisEvent,
    type CrisisReflection as CrisisReflectionType,
    CRISIS_TYPES,
    SENSORY_TRIGGERS,
    CONTEXT_TRIGGERS,
    STRATEGIES,
    WARNING_SIGNS
} from '../types';
import { TriggerSelector } from './TriggerSelector';
import { useTranslation } from 'react-i18next';
import { AudioPlayer } from './AudioPlayer';
import { CrisisReflection } from './CrisisReflection';
import { BackButton } from './BackButton';
import { BreathingCountdown } from './BreathingCountdown';
import { isNative } from '../utils/platform';
import { useToast } from './Toast';

export const CrisisMode: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { addCrisisEvent, addCrisisReflection } = useCrisis();
    const { currentContext } = useAppContext();
    const prefersReducedMotion = useReducedMotion();
    const { showSuccess } = useToast();

    // Breathing countdown phase
    const [showBreathingCountdown, setShowBreathingCountdown] = useState(true);

    // Timer state
    const [isActive, setIsActive] = useState(false); // Start paused until breathing completes
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

    // Recovery capture state
    const [showRecoveryCapture, setShowRecoveryCapture] = useState(false);
    const [recoveryTime, setRecoveryTime] = useState<number | undefined>(undefined);
    const [recoveryStartTime, setRecoveryStartTime] = useState<number | null>(null);
    const [recoveryElapsed, setRecoveryElapsed] = useState(0);

    // Reflection phase state
    const [showReflection, setShowReflection] = useState(false);
    const [savedCrisisEvent, setSavedCrisisEvent] = useState<CrisisEvent | null>(null);

    // Audio Recording refs - declared early so cleanup effect can access them
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const audioChunksRef = React.useRef<Blob[]>([]);
    const [pendingAudioBlob, setPendingAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioError, setAudioError] = useState<string | null>(null);
    // Initialize permission state based on platform capabilities
    const [micPermissionState, setMicPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unavailable'>(() => {
        // Native platforms have audio recording disabled
        if (isNative()) return 'unavailable';
        // Check if browser supports media devices
        if (typeof navigator !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
            return 'unavailable';
        }
        // Default to prompt - will be updated by Permissions API if available
        return 'prompt';
    });
    const startTimeRef = React.useRef<number | null>(null);

    // Audio recording duration state
    const [audioRecordingSeconds, setAudioRecordingSeconds] = useState(0);
    const audioStartTimeRef = React.useRef<number | null>(null);

    // Initialize start time on mount
    useEffect(() => {
        startTimeRef.current = Date.now();
    }, []);

    // Timer effect - calculates elapsed time from startTimeRef to avoid drift
    useEffect(() => {
        let animationFrameId: number;
        let lastUpdate = 0;

        const updateTimer = (timestamp: number) => {
            if (!isActive || startTimeRef.current === null) return;

            // Only update state once per second to avoid excessive re-renders
            if (timestamp - lastUpdate >= 1000 || lastUpdate === 0) {
                const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setSeconds(elapsed);
                lastUpdate = timestamp;
            }
            animationFrameId = requestAnimationFrame(updateTimer);
        };

        if (isActive && startTimeRef.current !== null) {
            animationFrameId = requestAnimationFrame(updateTimer);
        }

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [isActive]);

    // Audio recording timer effect
    useEffect(() => {
        if (!isRecording || audioStartTimeRef.current === null) {
            return;
        }

        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - audioStartTimeRef.current!) / 1000);
            setAudioRecordingSeconds(elapsed);
        }, 1000);

        return () => clearInterval(interval);
    }, [isRecording]);

    // Check microphone permission state on mount (web only)
    useEffect(() => {
        // Skip on native since audio recording is disabled (state already initialized to 'unavailable')
        if (isNative()) {
            return;
        }

        let permissionStatus: PermissionStatus | null = null;

        const handlePermissionChange = () => {
            if (permissionStatus) {
                const state = permissionStatus.state;
                // Validate state is one of expected values
                if (state === 'granted' || state === 'denied' || state === 'prompt') {
                    setMicPermissionState(state);
                } else {
                    setMicPermissionState('unavailable');
                }
            }
        };

        // Check if Permissions API is available
        if (!navigator.permissions) {
            // Permissions API not available, but initial state already set correctly
            // Leave as-is ('prompt' or 'unavailable' based on getUserMedia availability)
            if (import.meta.env.DEV) {
                console.warn('[CrisisMode] Permissions API not available');
            }
            return;
        }

        navigator.permissions.query({ name: 'microphone' as PermissionName })
            .then(status => {
                permissionStatus = status;
                const state = status.state;
                // Validate state is one of expected values
                if (state === 'granted' || state === 'denied' || state === 'prompt') {
                    setMicPermissionState(state);
                } else {
                    setMicPermissionState('unavailable');
                }
                status.addEventListener('change', handlePermissionChange);
            })
            .catch((error) => {
                if (import.meta.env.DEV) {
                    console.warn('[CrisisMode] Failed to query microphone permission:', error);
                }
                // Permission query not supported for microphone, but it might still work
                // Leave as 'prompt' to allow user to try
            });

        return () => {
            if (permissionStatus) {
                permissionStatus.removeEventListener('change', handlePermissionChange);
            }
        };
    }, []);

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

    // Recovery timer effect
    useEffect(() => {
        if (!showRecoveryCapture || !recoveryStartTime) return;

        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recoveryStartTime) / 1000);
            setRecoveryElapsed(elapsed);
        }, 1000);

        return () => clearInterval(interval);
    }, [showRecoveryCapture, recoveryStartTime]);

    // Audio Recording Logic
    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    // Retry audio encoding from pending blob
    const retryAudioEncoding = useCallback(async () => {
        if (!pendingAudioBlob) return;

        try {
            setAudioError(null);
            const base64Url = await blobToBase64(pendingAudioBlob);
            setAudioUrl(base64Url);
            setPendingAudioBlob(null);
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Retry audio encoding failed:', error);
            }
            setAudioError(t('crisis.audioEncodingError'));
        }
    }, [pendingAudioBlob, t]);

    const startRecording = async () => {
        setAudioError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setMicPermissionState('granted');
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

                // Validate blob has content
                if (audioBlob.size === 0) {
                    setAudioError(t('crisis.audioEmptyError'));
                    return;
                }

                try {
                    setAudioError(null);
                    const base64Url = await blobToBase64(audioBlob);
                    setAudioUrl(base64Url);
                } catch (error) {
                    if (import.meta.env.DEV) {
                        console.error('Failed to process audio recording:', error);
                    }
                    setAudioError(t('crisis.audioEncodingError'));
                    // Store blob for retry
                    setPendingAudioBlob(audioBlob);
                }
            };

            mediaRecorder.onerror = () => {
                if (import.meta.env.DEV) {
                    console.error('MediaRecorder error');
                }
                setAudioError(t('crisis.micUnknownError'));
                setIsRecording(false);
            };

            mediaRecorder.start();
            audioStartTimeRef.current = Date.now();
            setAudioRecordingSeconds(0);
            setIsRecording(true);
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('Error accessing microphone:', error);
            }

            // Type guard for DOMException - handle non-DOMException errors first
            if (!(error instanceof DOMException)) {
                setAudioError(t('crisis.micUnknownError'));
                return;
            }

            // Now error is guaranteed to be DOMException
            switch (error.name) {
                case 'NotAllowedError':
                    // Check if it's likely OS-level or browser-level
                    if (micPermissionState === 'denied') {
                        setAudioError(t('crisis.micOsDenied'));
                    } else {
                        setAudioError(t('crisis.micBrowserDenied'));
                        setMicPermissionState('denied');
                    }
                    break;
                case 'NotFoundError':
                    setAudioError(t('crisis.micNotFound'));
                    break;
                case 'NotReadableError':
                    setAudioError(t('crisis.micInUse'));
                    break;
                case 'AbortError':
                    setAudioError(t('crisis.micAborted'));
                    break;
                default:
                    setAudioError(t('crisis.micUnknownError'));
            }
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop()); // Stop stream
            audioStartTimeRef.current = null;
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
        // Transition to recovery capture phase
        setShowDetailsForm(false);
        setShowRecoveryCapture(true);
        setRecoveryStartTime(Date.now());
    };

    // Helper to create crisis event object
    const createCrisisEventData = (recoveryMins?: number) => {
        const crisisId = crypto.randomUUID();
        return {
            id: crisisId,
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
            notes,
            recoveryTimeMinutes: recoveryMins
        };
    };

    // Save crisis and optionally go to reflection
    const saveCrisisAndGoToReflection = (recoveryMins?: number) => {
        const eventData = createCrisisEventData(recoveryMins);
        addCrisisEvent(eventData);
        showSuccess(t('crisis.saved', 'Crisis event saved'));

        // Create a full CrisisEvent for the reflection component
        const fullEvent: CrisisEvent = {
            ...eventData,
            dayOfWeek: undefined,
            timeOfDay: undefined,
            hourOfDay: undefined
        };
        setSavedCrisisEvent(fullEvent);
        setShowRecoveryCapture(false);
        setShowReflection(true);
    };

    const handleSaveWithRecovery = () => {
        // Validate recovery time (must be between 1 and 240 minutes)
        const validRecoveryTime = recoveryTime !== undefined
            ? Math.max(1, Math.min(240, Math.round(recoveryTime)))
            : undefined;

        saveCrisisAndGoToReflection(validRecoveryTime);
    };

    const handleSkipRecovery = () => {
        // Save without recovery time and go to reflection
        saveCrisisAndGoToReflection(undefined);
    };

    const handleMarkRecoveredNow = () => {
        // Use elapsed time since crisis end as recovery time
        const recoveryMins = Math.max(1, Math.round(recoveryElapsed / 60));
        saveCrisisAndGoToReflection(recoveryMins);
    };

    // Handler for reflection completion
    const handleReflectionComplete = (reflection: Omit<CrisisReflectionType, 'id' | 'timestamp'>) => {
        addCrisisReflection(reflection);
        showSuccess(t('crisis.reflectionSaved', 'Reflection saved'));
        navigate('/');
    };

    // Handler for skipping reflection
    const handleSkipReflection = () => {
        navigate('/');
    };

    const handleSkipDetails = () => {
        // Save with minimal data
        addCrisisEvent({
            id: crypto.randomUUID(),
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
        showSuccess(t('crisis.saved', 'Crisis event saved'));

        navigate('/');
    };

    const resolutionOptions: { value: CrisisResolution; label: string }[] = [
        { value: 'self_regulated', label: t('crisisResolution.selfRegulated') },
        { value: 'co_regulated', label: t('crisisResolution.coRegulated') },
        { value: 'timed_out', label: t('crisisResolution.timedOut') },
        { value: 'interrupted', label: t('crisisResolution.interrupted') },
        { value: 'other', label: t('crisisResolution.other') }
    ];

    // Handle breathing countdown completion
    const handleBreathingComplete = useCallback(() => {
        setShowBreathingCountdown(false);
        setIsActive(true);
        startTimeRef.current = Date.now();
    }, []);

    // Show breathing countdown first
    if (showBreathingCountdown) {
        return <BreathingCountdown onComplete={handleBreathingComplete} duration={3} />;
    }

    return (
        <div className="flex flex-col min-h-screen text-white relative overflow-hidden">
            {/* Background Pulse Animation for Crisis Mode */}
            <AnimatePresence>
                {isActive && (
                    <motion.div
                        initial={{ opacity: prefersReducedMotion ? 1 : 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                        className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none"
                    >
                        <div className="w-[300px] h-[300px] bg-red-500/20 rounded-full animate-ping opacity-75"></div>
                        <div className="absolute w-[500px] h-[500px] bg-red-500/10 rounded-full animate-pulse"></div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative z-10 flex flex-col flex-1 p-6">
                {/* Header with BackButton for mobile navigation */}
                <motion.div
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
                    className="flex items-center gap-3 mb-8"
                >
                    <BackButton className="shrink-0" />
                    <div className="flex items-center gap-2 text-red-500">
                        <AlertTriangle size={24} />
                        <span className="font-bold text-lg tracking-wider uppercase">{t('crisis.title')}</span>
                    </div>
                </motion.div>

                {/* Main Content */}
                <AnimatePresence mode="wait">
                    {showReflection && savedCrisisEvent ? (
                        // Reflection Phase
                        <motion.div
                            key="reflection"
                            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
                            className="flex-1 overflow-y-auto pb-8"
                        >
                            <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl text-center mb-4">
                                <div className="flex items-center justify-center gap-3">
                                    <MessageSquare className="text-green-500" size={24} />
                                    <div className="text-left">
                                        <h3 className="text-base font-bold text-white">
                                            {t('crisis.reflection.saved', 'Krise registrert')}
                                        </h3>
                                        <p className="text-slate-400 text-sm">
                                            {t('crisis.reflection.subtitle', 'Ta et øyeblikk til å reflektere')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <CrisisReflection
                                crisisEvent={savedCrisisEvent}
                                onComplete={handleReflectionComplete}
                                onSkip={handleSkipReflection}
                            />
                        </motion.div>
                    ) : !showDetailsForm && !showRecoveryCapture ? (
                        // Timer View
                        <motion.div
                            key="timer"
                            initial={{ opacity: prefersReducedMotion ? 1 : 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                            className="flex-1 flex flex-col items-center justify-center gap-8 pb-24"
                        >
                            <motion.div
                                initial={prefersReducedMotion ? { opacity: 1 } : { scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 25 }}
                                className="text-center"
                            >
                                <p className="text-slate-400 text-base mb-2 font-medium uppercase tracking-widest">{t('crisis.duration')}</p>
                                <motion.div
                                    className={`text-6xl sm:text-7xl font-bold tabular-nums tracking-tighter ${isActive ? 'text-white' : 'text-slate-300'}`}
                                    animate={isActive ? { opacity: [1, 0.7, 1] } : { opacity: 1 }}
                                    transition={isActive ? { repeat: Infinity, duration: 2 } : {}}
                                    role="timer"
                                    aria-live="polite"
                                    aria-label={`${t('crisis.duration')}: ${formatTime(seconds)}`}
                                >
                                    {formatTime(seconds)}
                                </motion.div>
                                {seconds >= 60 && (
                                    <p className="text-slate-400 text-sm mt-2">
                                        {Math.floor(seconds / 60)} {Math.floor(seconds / 60) === 1 ? t('settings.minute') : t('settings.minutes')}
                                    </p>
                                )}
                                {isActive && (
                                    <div className="flex items-center justify-center gap-2 text-red-400 mt-3">
                                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                        <span className="text-sm font-medium">{t('crisis.timerRunning')}</span>
                                    </div>
                                )}
                            </motion.div>

                            <div className="flex flex-col gap-4 w-full max-w-xs">
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleStop}
                                    className="w-full bg-red-600 hover:bg-red-700 transition-colors h-16 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-red-900/50"
                                >
                                    <Square size={24} fill="currentColor" />
                                    <span className="text-xl font-bold">{t('crisis.stopEvent')}</span>
                                </motion.button>

                                {/* Audio Recording UI - Hidden on native platforms */}
                                {!isNative() && (
                                    <>
                                        {/* Mic permission denied warning */}
                                        {micPermissionState === 'denied' && !isRecording && (
                                            <div className="bg-red-900/30 border border-red-700 p-3 rounded-xl">
                                                <div className="flex items-start gap-2">
                                                    <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                                                    <p className="text-red-300 text-sm">{t('crisis.micPermissionDenied')}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Audio error message with retry */}
                                        {audioError && (
                                            <div className="bg-amber-900/30 border border-amber-700 p-3 rounded-xl">
                                                <div className="flex items-start gap-2">
                                                    <AlertCircle size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <p className="text-amber-300 text-sm">{audioError}</p>
                                                        {pendingAudioBlob && (
                                                            <button
                                                                onClick={retryAudioEncoding}
                                                                className="flex items-center gap-1 text-cyan-400 text-sm mt-2 hover:text-cyan-300"
                                                            >
                                                                <RefreshCw size={14} />
                                                                {t('crisis.retryEncoding')}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Audio Recording Button with Enhanced Feedback */}
                                        <motion.button
                                            whileTap={{ scale: 0.98 }}
                                            onClick={toggleRecording}
                                            className={`w-full rounded-xl flex items-center justify-center gap-3 transition-all border relative overflow-hidden ${isRecording
                                                ? 'h-20 bg-red-500/20 border-red-500 text-red-400'
                                                : 'h-14 bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                                                }`}
                                            aria-label={isRecording ? t('crisis.stopRecording') : t('crisis.startRecording')}
                                            aria-pressed={isRecording}
                                        >
                                            {/* Recording pulse overlay */}
                                            {isRecording && (
                                                <motion.div
                                                    className="absolute inset-0 bg-red-500/10"
                                                    animate={{ opacity: [0.1, 0.3, 0.1] }}
                                                    transition={{ duration: 1.5, repeat: Infinity }}
                                                />
                                            )}
                                            <div className="relative z-10 flex flex-col items-center gap-1">
                                                <div className="flex items-center gap-2">
                                                    {isRecording ? (
                                                        <motion.div
                                                            animate={{ scale: [1, 1.2, 1] }}
                                                            transition={{ duration: 1, repeat: Infinity }}
                                                            className="relative"
                                                        >
                                                            <Mic size={20} aria-hidden="true" />
                                                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                                                        </motion.div>
                                                    ) : (
                                                        <Mic size={20} aria-hidden="true" />
                                                    )}
                                                    <span className="text-base font-medium">
                                                        {isRecording ? t('crisis.stopRecording') : t('crisis.startRecording')}
                                                    </span>
                                                </div>
                                                {/* Recording Duration Display */}
                                                {isRecording && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -5 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                                        <span className="text-red-400 text-sm font-mono tabular-nums">
                                                            {formatTime(audioRecordingSeconds)}
                                                        </span>
                                                        <span className="text-red-400/60 text-xs">
                                                            {t('crisis.audioRecordingTime', 'recording')}
                                                        </span>
                                                    </motion.div>
                                                )}
                                            </div>
                                        </motion.button>
                                    </>
                                )}
                            </div>

                            {!isNative() && isRecording && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-center"
                                >
                                    <p className="text-red-400 text-sm flex items-center justify-center gap-2">
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                                        </span>
                                        {t('crisis.recordingActive')}
                                    </p>
                                </motion.div>
                            )}
                        </motion.div>
                    ) : showDetailsForm && !showRecoveryCapture ? (
                        // Details Form
                        <motion.div
                            key="details"
                            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
                            className="flex-1 overflow-y-auto pb-48"
                        >
                            <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl text-center mb-5">
                                <div className="flex items-center justify-center gap-3">
                                    <CheckCircle className="text-green-500" size={24} />
                                    <div className="text-left">
                                        <h3 className="text-base font-bold text-white">{t('crisis.eventEnded')}</h3>
                                        <p className="text-slate-400 text-sm">{t('crisis.duration')}: {formatTime(seconds)}</p>
                                    </div>
                                </div>
                            </div>

                            <h2 className="text-white text-base font-bold mb-3">{t('crisis.documentEvent')}</h2>

                            {/* Audio Player if recorded */}
                            {audioUrl && (
                                <div className="mb-6">
                                    <AudioPlayer audioUrl={audioUrl} />
                                </div>
                            )}

                            {/* Audio error in details form */}
                            {audioError && !audioUrl && (
                                <div className="mb-6 bg-amber-900/30 border border-amber-700 p-3 rounded-xl">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-amber-300 text-sm">{audioError}</p>
                                            {pendingAudioBlob && (
                                                <button
                                                    onClick={retryAudioEncoding}
                                                    className="flex items-center gap-1 text-cyan-400 text-sm mt-2 hover:text-cyan-300"
                                                >
                                                    <RefreshCw size={14} />
                                                    {t('crisis.retryEncoding')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <p className="text-slate-400 text-sm mb-4">{t('crisis.helperText')}</p>

                            <div className="space-y-5">
                                {/* Crisis Type */}
                                <div>
                                    <label className="text-slate-300 font-medium text-sm block mb-2">{t('crisis.type')}</label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {CRISIS_TYPES.map((type) => (
                                            <button
                                                key={type.value}
                                                onClick={() => setCrisisType(type.value)}
                                                className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${crisisType === type.value
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
                                    <label htmlFor="peak-intensity-slider" className="text-slate-300 font-medium text-sm block mb-2">
                                        {t('crisis.intensity.label')}: <span className="text-white font-bold" aria-live="polite">{peakIntensity}</span>
                                    </label>
                                    <input
                                        type="range"
                                        id="peak-intensity-slider"
                                        min="1"
                                        max="10"
                                        value={peakIntensity}
                                        onChange={(e) => setPeakIntensity(Number(e.target.value))}
                                        className="w-full h-2 rounded-full appearance-none cursor-pointer"
                                        style={{ background: 'linear-gradient(to right, #facc15, #f97316, #ef4444)' }}
                                        aria-valuemin={1}
                                        aria-valuemax={10}
                                        aria-valuenow={peakIntensity}
                                        aria-describedby="peak-intensity-description"
                                    />
                                    <div id="peak-intensity-description" className="flex justify-between text-sm text-slate-400 mt-2 font-medium">
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
                                    type="warningSign"
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
                                    type="strategy"
                                />

                                {/* Resolution */}
                                <div>
                                    <label className="text-slate-300 font-medium text-sm block mb-2">{t('crisis.resolution')}</label>
                                    <div className="space-y-1.5">
                                        {resolutionOptions.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setResolution(opt.value)}
                                                className={`w-full py-2.5 px-3 rounded-lg text-sm font-medium text-left transition-all ${resolution === opt.value
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
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 h-28 resize-none"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    ) : showRecoveryCapture ? (
                        // Recovery Capture Phase
                        <motion.div
                            key="recovery"
                            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
                            className="flex-1 flex flex-col items-center justify-center gap-4 px-4"
                        >
                            {/* Recovery Timer */}
                            <div className="text-center mb-2">
                                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center">
                                    <CheckCircle size={28} className="text-green-400" />
                                </div>
                                <h2 className="text-lg font-bold text-white mb-1">
                                    {t('crisis.recovery.title', 'Gjenopprettingsfase')}
                                </h2>
                                <p className="text-slate-400 text-sm mb-3">
                                    {t('crisis.recovery.subtitle', 'Når var barnet tilbake til normalt?')}
                                </p>

                                {/* Elapsed time since crisis end */}
                                <div className="bg-slate-800/50 rounded-lg px-4 py-3 mb-4 inline-block">
                                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-0.5">
                                        {t('crisis.recovery.timerLabel', 'Tid siden krise slutt')}
                                    </p>
                                    <p className="text-2xl font-bold text-white tabular-nums">
                                        {formatTime(recoveryElapsed)}
                                    </p>
                                </div>
                            </div>

                            {/* Quick Select Buttons */}
                            <div className="w-full max-w-sm">
                                <p className="text-slate-400 text-xs mb-2 text-center uppercase tracking-wider">
                                    {t('crisis.recovery.quickOptions', 'Hurtigvalg')}
                                </p>
                                <div className="grid grid-cols-3 gap-1.5 mb-3">
                                    {[5, 10, 15, 20, 30, 45].map(mins => (
                                        <button
                                            key={mins}
                                            onClick={() => saveCrisisAndGoToReflection(mins)}
                                            className="py-2.5 px-3 rounded-lg text-sm font-medium transition-all bg-slate-800 text-slate-300 hover:bg-slate-700 active:bg-green-500 active:text-white"
                                        >
                                            {mins} min
                                        </button>
                                    ))}
                                </div>

                                {/* Manual Input */}
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="number"
                                        min="1"
                                        max="240"
                                        value={recoveryTime || ''}
                                        onChange={(e) => setRecoveryTime(e.target.value ? Number(e.target.value) : undefined)}
                                        placeholder={t('crisis.recovery.customTime', 'Angi minutter...')}
                                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                    {recoveryTime && (
                                        <button
                                            onClick={handleSaveWithRecovery}
                                            className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                                        >
                                            OK
                                        </button>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={handleMarkRecoveredNow}
                                        className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-green-500/30"
                                    >
                                        {t('crisis.recovery.markRecovered', 'Gjenopprettet nå')} ({Math.max(1, Math.round(recoveryElapsed / 60))} min)
                                    </button>
                                    <button
                                        onClick={handleSkipRecovery}
                                        className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-medium transition-colors"
                                    >
                                        {t('crisis.recovery.skip', 'Hopp over (logg senere)')}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ) : null}
                </AnimatePresence>

                {/* Bottom Actions (when showing details form) */}
                {showDetailsForm && !showRecoveryCapture && (
                    <motion.div
                        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.15 }}
                        className="fixed bottom-0 left-0 right-0 z-[60] bg-slate-900/95 backdrop-blur-lg border-t border-white/10"
                        style={{ paddingBottom: 'max(5rem, calc(env(safe-area-inset-bottom) + 4rem))' }}
                    >
                        <div className="flex gap-3 max-w-md mx-auto px-4 pt-3">
                            <button
                                onClick={handleSkipDetails}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-3 rounded-xl font-medium transition-colors"
                            >
                                {t('crisis.actions.skip')}
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-600/30"
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

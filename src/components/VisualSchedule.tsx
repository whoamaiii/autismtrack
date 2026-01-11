import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { useSchedule, useAppContext } from '../store';
import type { ScheduleEntry, ActivityStatus, DailyScheduleTemplate } from '../types';
import { Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    CurrentActivityCard,
    TimelineItem,
    UpNextCard,
    NewActivityModal,
    FloatingAddButton,
    AllDoneCard,
    StickyHeader,
    ConfirmDeleteModal,
    type Activity
} from './DailyPlanComponents';
import { STORAGE_KEYS, STORAGE_PREFIXES } from '../constants/storage';
import { useToast } from './Toast';

// Extend window type for webkit prefix
interface WebkitWindow extends Window {
    webkitAudioContext?: typeof AudioContext;
}

// Play a notification sound when timer ends
const playTimerEndSound = () => {
    try {
        const AudioContextClass = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
        if (!AudioContextClass) return;

        const audioContext = new AudioContextClass();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);

        // Clean up AudioContext after sound finishes to prevent memory leak
        oscillator.onended = () => {
            audioContext.close();
        };
    } catch {
        // Audio not supported, ignore
    }
};

// Storage keys (use centralized constants)
const SCHEDULE_STORAGE_KEY = STORAGE_PREFIXES.DAILY_SCHEDULE;
const TIMER_STATE_KEY = STORAGE_KEYS.TIMER_STATE;

// Time validation regex: HH:mm format (00:00 - 23:59)
const TIME_FORMAT_REGEX = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;

interface ParsedTime {
    hours: number;
    minutes: number;
    totalMinutes: number;
    valid: boolean;
}

// Parse and validate time string (HH:mm format)
const parseTime = (timeStr: string | undefined): ParsedTime => {
    const defaultTime = { hours: 0, minutes: 0, totalMinutes: 0, valid: false };

    if (!timeStr) return defaultTime;

    const match = timeStr.match(TIME_FORMAT_REGEX);
    if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        return {
            hours,
            minutes,
            totalMinutes: hours * 60 + minutes,
            valid: true
        };
    }

    // Fallback: try to parse loosely and clamp values
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
        const hours = Math.max(0, Math.min(23, parseInt(parts[0] || '0', 10) || 0));
        const minutes = Math.max(0, Math.min(59, parseInt(parts[1] || '0', 10) || 0));
        return {
            hours,
            minutes,
            totalMinutes: hours * 60 + minutes,
            valid: false // Mark as invalid but usable
        };
    }

    return defaultTime;
};

// Type guard for Activity array from localStorage
const isValidActivityArray = (data: unknown): data is Activity[] => {
    if (!Array.isArray(data)) return false;
    return data.every(item =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Activity).id === 'string' &&
        typeof (item as Activity).title === 'string' &&
        typeof (item as Activity).time === 'string' &&
        typeof (item as Activity).status === 'string'
    );
};

// Timer state interface for persistence
interface TimerState {
    activityId: string;
    timeRemaining: number;
    timerActive: boolean;
    timerStarted: boolean;
    savedAt: number; // timestamp
}

// Default schedule template for demo/fallback
const DEFAULT_SCHEDULE: Activity[] = [
    { id: '1', time: '08:00', endTime: '09:00', title: 'Morgensamling', status: 'upcoming', icon: '☀️', durationMinutes: 60 },
    { id: '2', time: '09:00', endTime: '10:00', title: 'Matte', status: 'upcoming', icon: '🔢', durationMinutes: 60 },
    { id: '3', time: '10:00', endTime: '10:30', title: 'Pause', status: 'upcoming', icon: '🍎', durationMinutes: 30 },
    { id: '4', time: '10:30', endTime: '11:30', title: 'Lesing', status: 'upcoming', icon: '📖', durationMinutes: 60 },
    { id: '5', time: '11:30', endTime: '12:30', title: 'Lunsj', status: 'upcoming', icon: '🥪', durationMinutes: 60 },
    { id: '6', time: '12:30', endTime: '13:30', title: 'Kunst', status: 'upcoming', icon: '🎨', durationMinutes: 60 },
    { id: '7', time: '13:30', endTime: '14:30', title: 'Gym', status: 'upcoming', icon: '⚽', durationMinutes: 60 },
];

// Helper to convert template activities to local Activity format
const convertTemplateToActivities = (template: DailyScheduleTemplate): Activity[] => {
    return template.activities.map((act, index) => ({
        id: act.id,
        time: act.scheduledStart,
        endTime: act.scheduledEnd,
        title: act.title,
        icon: act.icon,
        durationMinutes: act.durationMinutes,
        status: index === 0 ? 'current' as const : 'upcoming' as const
    }));
};

// Helper to check if current time is within an activity time range (handles midnight wraparound)
const isTimeInRange = (currentMinutes: number, startMinutes: number, endMinutes: number): boolean => {
    // Handle special case: activity ends at exactly midnight (00:00)
    // e.g., 23:00 to 00:00 should include times from 23:00 to 23:59
    if (endMinutes === 0 && startMinutes > 0) {
        // Treat 00:00 as 24:00 (1440 minutes) for comparison
        return currentMinutes >= startMinutes;
    }

    // Handle midnight wraparound: if end < start, the activity spans midnight
    if (endMinutes < startMinutes) {
        // Activity spans midnight (e.g., 23:00 to 00:30)
        // Current time is in range if: currentMinutes >= startMinutes OR currentMinutes < endMinutes
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    // Normal case: activity within same day
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
};

// Helper to determine current activity based on time
const determineCurrentActivity = (activities: Activity[]): Activity[] => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let foundCurrent = false;
    return activities.map(activity => {
        const startTime = parseTime(activity.time);
        const endTime = parseTime(activity.endTime);
        const startMinutes = startTime.totalMinutes;
        const endMinutes = endTime.totalMinutes;

        if (activity.status === 'completed') {
            return activity;
        }

        // Check if current time is within this activity's time range
        if (!foundCurrent && isTimeInRange(currentMinutes, startMinutes, endMinutes)) {
            foundCurrent = true;
            return { ...activity, status: 'current' as const };
        }

        // Check if this is the next upcoming activity
        if (!foundCurrent && currentMinutes < startMinutes) {
            foundCurrent = true;
            return { ...activity, status: 'current' as const };
        }

        if (foundCurrent) {
            return { ...activity, status: 'upcoming' as const };
        }

        return { ...activity, status: 'completed' as const };
    });
};

export const VisualSchedule: React.FC = () => {
    const navigate = useNavigate();
    const { addScheduleEntry, scheduleTemplates } = useSchedule();
    const { currentContext } = useAppContext();
    const { t, i18n } = useTranslation();
    const { showSuccess } = useToast();
    const today = new Date().toISOString().split('T')[0];

    // Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);

    // Storage error state for user notification
    const [storageError, setStorageError] = useState<string | null>(null);

    // Load schedule from localStorage or templates
    const [scheduleItems, setScheduleItems] = useState<Activity[]>(() => {
        // Try to load from localStorage first
        try {
            const stored = localStorage.getItem(`${SCHEDULE_STORAGE_KEY}_${today}_${currentContext}`);
            if (stored) {
                const parsed: unknown = JSON.parse(stored);
                if (isValidActivityArray(parsed) && parsed.length > 0) {
                    return determineCurrentActivity(parsed);
                }
            }
        } catch (e) {
            if (import.meta.env.DEV) {
                console.error('Failed to load schedule from localStorage', e);
            }
        }

        // Try to find a matching template
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
        const matchingTemplate = scheduleTemplates.find(
            template => template.context === currentContext && (template.dayOfWeek === dayOfWeek || template.dayOfWeek === 'all')
        );

        if (matchingTemplate && matchingTemplate.activities.length > 0) {
            return determineCurrentActivity(convertTemplateToActivities(matchingTemplate));
        }

        // Fall back to default schedule
        return determineCurrentActivity(DEFAULT_SCHEDULE);
    });

    // Safe localStorage write with quota error handling
    const safeSetItem = useCallback((key: string, value: string): boolean => {
        try {
            localStorage.setItem(key, value);
            setStorageError(null); // Clear any previous error
            return true;
        } catch (error) {
            // Check for QuotaExceededError
            const isQuotaError = error instanceof DOMException && (
                error.name === 'QuotaExceededError' ||
                error.name === 'NS_ERROR_DOM_QUOTA_REACHED' // Firefox
            );

            if (isQuotaError) {
                setStorageError(t('visualSchedule.storageFullError', 'Lagring full. Prøv å eksportere og slette gamle data.'));
            } else {
                setStorageError(t('visualSchedule.storageSaveError', 'Kunne ikke lagre. Endringer kan gå tapt.'));
            }

            if (import.meta.env.DEV) {
                console.error(`Failed to write to localStorage key "${key}":`, error);
            }
            return false;
        }
    }, [t]);

    // Save schedule to localStorage whenever it changes
    useEffect(() => {
        safeSetItem(
            `${SCHEDULE_STORAGE_KEY}_${today}_${currentContext}`,
            JSON.stringify(scheduleItems)
        );
    }, [scheduleItems, today, currentContext, safeSetItem]);

    const currentActivity = scheduleItems.find(item => item.status === 'current');
    const nextActivity = scheduleItems.find(item => item.status === 'upcoming');

    // Calculate initial time based on current activity
    const getInitialTime = useCallback((activity: Activity | undefined) => {
        return activity ? (activity.durationMinutes || 30) * 60 : 0;
    }, []);

    // Load saved timer state from localStorage
    const loadSavedTimerState = useCallback((): TimerState | null => {
        try {
            const saved = localStorage.getItem(TIMER_STATE_KEY);
            if (saved) {
                const state = JSON.parse(saved) as TimerState;
                // Validate saved state is not too old (max 4 hours)
                const maxAge = 4 * 60 * 60 * 1000; // 4 hours in ms
                if (Date.now() - state.savedAt < maxAge) {
                    return state;
                }
            }
        } catch {
            // Ignore parse errors
        }
        return null;
    }, []);

    // Timer state - using refs to avoid stale closure issues
    // Initialize from localStorage if available and matches current activity
    const [timerActive, setTimerActive] = useState(() => {
        const saved = loadSavedTimerState();
        if (saved && currentActivity && saved.activityId === currentActivity.id) {
            return saved.timerActive;
        }
        return false;
    });

    const [timerStarted, setTimerStarted] = useState(() => {
        const saved = loadSavedTimerState();
        if (saved && currentActivity && saved.activityId === currentActivity.id) {
            return saved.timerStarted;
        }
        return false;
    });

    const [timeRemaining, setTimeRemaining] = useState(() => {
        const saved = loadSavedTimerState();
        if (saved && currentActivity && saved.activityId === currentActivity.id) {
            // If timer was active, account for elapsed time since save
            if (saved.timerActive) {
                const elapsedSeconds = Math.floor((Date.now() - saved.savedAt) / 1000);
                // Validate elapsed time is reasonable (not negative, not more than 4 hours)
                // This handles clock skew or corrupted timestamps
                if (elapsedSeconds < 0 || elapsedSeconds > 4 * 60 * 60) {
                    return getInitialTime(currentActivity);
                }
                return Math.max(0, saved.timeRemaining - elapsedSeconds);
            }
            return saved.timeRemaining;
        }
        return getInitialTime(currentActivity);
    });

    const currentActivityIdRef = useRef<string | null>(
        currentActivity?.id ?? null
    );

    // Persist timer state to localStorage
    // Throttled to every 5 seconds during active countdown, but always save state changes immediately
    const lastTimerSaveRef = useRef<number>(0);
    const lastSavedStateRef = useRef<{ active: boolean; started: boolean }>({ active: false, started: false });
    useEffect(() => {
        if (!currentActivity) return;

        const now = Date.now();

        // Detect if timer active/started state changed (pause, resume, reset, start)
        const stateChanged =
            timerActive !== lastSavedStateRef.current.active ||
            timerStarted !== lastSavedStateRef.current.started;

        // Only throttle during active countdown when state hasn't changed
        if (!stateChanged && timerActive && now - lastTimerSaveRef.current < 5000) {
            return;
        }

        lastTimerSaveRef.current = now;
        lastSavedStateRef.current = { active: timerActive, started: timerStarted };

        const timerState: TimerState = {
            activityId: currentActivity.id,
            timeRemaining,
            timerActive,
            timerStarted,
            savedAt: now
        };

        safeSetItem(TIMER_STATE_KEY, JSON.stringify(timerState));
    }, [currentActivity, timeRemaining, timerActive, timerStarted, safeSetItem]);

    // Clear timer state when all activities are completed or on unmount
    const clearTimerState = useCallback(() => {
        try {
            localStorage.removeItem(TIMER_STATE_KEY);
        } catch {
            // Ignore errors
        }
    }, []);

    // Update timeRemaining ONLY when the current activity ID changes (not on every render)
    // This is needed to sync timer state when switching between activities
    useEffect(() => {
        if (currentActivity && currentActivity.id !== currentActivityIdRef.current) {
            currentActivityIdRef.current = currentActivity.id;
            // Check if we have saved state for this new activity
            const saved = loadSavedTimerState();
            if (saved && saved.activityId === currentActivity.id) {
                // Restore saved state
                if (saved.timerActive) {
                    const elapsedSeconds = Math.floor((Date.now() - saved.savedAt) / 1000);
                    // Validate elapsed time is reasonable (handles clock skew)
                    if (elapsedSeconds >= 0 && elapsedSeconds <= 4 * 60 * 60) {
                        setTimeRemaining(Math.max(0, saved.timeRemaining - elapsedSeconds));
                        setTimerActive(saved.timerActive);
                        setTimerStarted(saved.timerStarted);
                    } else {
                        // Invalid timestamp, reset to initial time
                        setTimeRemaining(getInitialTime(currentActivity));
                    }
                } else {
                    setTimeRemaining(saved.timeRemaining);
                    setTimerActive(saved.timerActive);
                    setTimerStarted(saved.timerStarted);
                }
            } else if (!timerStarted) {
                // No saved state and timer not started - reset to initial time
                setTimeRemaining(getInitialTime(currentActivity));
            }
        }
    }, [currentActivity, timerStarted, getInitialTime, loadSavedTimerState]);

    // Timer countdown with audio notification
    // timeRemaining is intentionally NOT in deps - we use functional update pattern
    // and only want to start/stop the interval based on timerActive
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;

        if (timerActive && timeRemaining > 0) {
            interval = setInterval(() => {
                setTimeRemaining(prev => {
                    if (prev <= 1) {
                        setTimerActive(false);
                        // Play notification sound when timer ends
                        playTimerEndSound();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timerActive]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartTimer = () => {
        setTimerActive(true);
        setTimerStarted(true);
    };

    const handlePauseTimer = () => {
        setTimerActive(false);
    };

    const handleResetTimer = () => {
        setTimerActive(false);
        setTimerStarted(false);
        clearTimerState();
        if (currentActivity) {
            setTimeRemaining((currentActivity.durationMinutes || 30) * 60);
        }
    };

    const handleComplete = useCallback((id?: string) => {
        const itemToComplete = id
            ? scheduleItems.find(i => i.id === id)
            : currentActivity;

        if (!itemToComplete) return;

        // Save completed activity to store for LLM analysis
        const entry: ScheduleEntry = {
            id: uuidv4(),
            date: today,
            context: currentContext,
            activity: {
                id: itemToComplete.id,
                title: itemToComplete.title,
                icon: itemToComplete.icon,
                scheduledStart: itemToComplete.time,
                scheduledEnd: itemToComplete.endTime,
                durationMinutes: itemToComplete.durationMinutes || 30
            },
            status: 'completed' as ActivityStatus,
            actualEnd: new Date().toISOString(),
            actualDurationMinutes: Math.round(((itemToComplete.durationMinutes || 30) * 60 - timeRemaining) / 60)
        };
        addScheduleEntry(entry);

        // Update local state
        setScheduleItems(prev => {
            const currentIndex = prev.findIndex(item => item.id === itemToComplete.id);
            if (currentIndex === -1) return prev;

            return prev.map((item, index) => {
                if (index === currentIndex) {
                    return { ...item, status: 'completed' as const };
                }
                if (index === currentIndex + 1) {
                    return { ...item, status: 'current' as const };
                }
                return item;
            });
        });
        setTimerActive(false);
        setTimerStarted(false);
        clearTimerState();
    }, [scheduleItems, currentActivity, today, currentContext, addScheduleEntry, timeRemaining, clearTimerState]);

    const handleSaveActivity = (activityData: Omit<Activity, 'id' | 'status'>) => {
        if (editingActivity) {
            // Update existing activity
            const updatedItems = scheduleItems.map(item =>
                item.id === editingActivity.id
                    ? { ...item, ...activityData }
                    : item
            );
            setScheduleItems(updatedItems.sort((a, b) => a.time.localeCompare(b.time)));
            setEditingActivity(null);
            showSuccess(t('schedule.saved'), t('schedule.activityUpdated'));
        } else {
            // Create new activity
            const newActivity: Activity = {
                id: uuidv4(),
                ...activityData,
                status: 'upcoming'
            };
            setScheduleItems([...scheduleItems, newActivity].sort((a, b) => a.time.localeCompare(b.time)));
            showSuccess(t('schedule.saved'), t('schedule.activityAdded'));
        }
        setIsAddModalOpen(false);
    };

    const handleEditActivity = (id: string) => {
        const activity = scheduleItems.find(item => item.id === id);
        if (activity) {
            setEditingActivity(activity);
            setIsAddModalOpen(true);
        }
    };

    // Show delete confirmation instead of immediate delete
    const handleRequestDelete = () => {
        if (editingActivity) {
            setActivityToDelete(editingActivity);
            setShowDeleteConfirm(true);
        }
    };

    // Actually delete after confirmation
    const handleConfirmDelete = () => {
        if (activityToDelete) {
            setScheduleItems(scheduleItems.filter(item => item.id !== activityToDelete.id));
            setActivityToDelete(null);
            setShowDeleteConfirm(false);
            setEditingActivity(null);
            setIsAddModalOpen(false);
        }
    };

    const handleCancelDelete = () => {
        setActivityToDelete(null);
        setShowDeleteConfirm(false);
    };

    const handleDuplicateActivity = () => {
        if (editingActivity) {
            const newActivity: Activity = {
                ...editingActivity,
                id: uuidv4(),
                title: `${editingActivity.title} (Copy)`,
                status: 'upcoming'
            };
            setScheduleItems([...scheduleItems, newActivity].sort((a, b) => a.time.localeCompare(b.time)));
            setEditingActivity(null);
            setIsAddModalOpen(false);
        }
    };

    const handleCloseModal = () => {
        setIsAddModalOpen(false);
        setEditingActivity(null);
    };

    const progress = currentActivity
        ? (((currentActivity.durationMinutes || 30) * 60 - timeRemaining) / ((currentActivity.durationMinutes || 30) * 60)) * 100
        : 0;

    const locale = i18n.language === 'no' ? 'nb-NO' : 'en-US';

    return (
        <div className="min-h-screen pb-32">
            <StickyHeader
                title={t('visualSchedule.title')}
                onBack={() => navigate('/')}
                rightAction={
                    <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" aria-label="Settings">
                        <Settings size={20} className="text-white" />
                    </button>
                }
            />

            {/* Storage Error Notification */}
            <AnimatePresence>
                {storageError && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="mx-4 mt-2 p-3 bg-amber-500/20 border border-amber-500/40 rounded-lg flex items-center justify-between"
                    >
                        <span className="text-amber-200 text-sm">{storageError}</span>
                        <button
                            onClick={() => setStorageError(null)}
                            className="text-amber-200 hover:text-amber-100 ml-2"
                            aria-label="Dismiss"
                        >
                            ✕
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="p-4 space-y-6">
                {/* Date Display */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                >
                    <p className="text-white/40 text-sm uppercase tracking-wider">
                        {new Date().toLocaleDateString(locale, { weekday: 'long' })}
                    </p>
                    <p className="text-white/70 text-lg font-medium">
                        {new Date().toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </motion.div>

                {/* Current Activity Hero Card */}
                <AnimatePresence mode="wait">
                    {currentActivity ? (
                        <CurrentActivityCard
                            key={currentActivity.id}
                            activity={currentActivity}
                            onComplete={() => handleComplete(currentActivity.id)}
                            timerActive={timerActive}
                            timeRemaining={timeRemaining}
                            progress={progress}
                            onStartTimer={handleStartTimer}
                            onPauseTimer={handlePauseTimer}
                            onResetTimer={handleResetTimer}
                            formatTime={formatTime}
                            timerStarted={timerStarted}
                        />
                    ) : (
                        scheduleItems.every(i => i.status === 'completed') && scheduleItems.length > 0 && (
                            <AllDoneCard />
                        )
                    )}
                </AnimatePresence>

                {/* Up Next */}
                {nextActivity && (
                    <div className="space-y-2">
                        <h3 className="text-white/50 text-sm font-bold uppercase tracking-wider px-2">{t('visualSchedule.next')}</h3>
                        <UpNextCard activity={nextActivity} />
                    </div>
                )}

                {/* Timeline */}
                <div className="space-y-2">
                    <h3 className="text-white/50 text-sm font-bold uppercase tracking-wider px-2">{t('visualSchedule.timeline')}</h3>
                    <div className="relative">
                        {scheduleItems.map((activity, index) => (
                            <TimelineItem
                                key={activity.id}
                                activity={activity}
                                isLast={index === scheduleItems.length - 1}
                                onEdit={handleEditActivity}
                                onComplete={handleComplete}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Floating Add Button */}
            <FloatingAddButton onClick={() => {
                setEditingActivity(null);
                setIsAddModalOpen(true);
            }} />

            {/* Add/Edit Modal */}
            <NewActivityModal
                isOpen={isAddModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveActivity}
                editActivity={editingActivity}
                onDelete={handleRequestDelete}
                onDuplicate={handleDuplicateActivity}
            />

            {/* Delete Confirmation Modal */}
            <ConfirmDeleteModal
                isOpen={showDeleteConfirm}
                onClose={handleCancelDelete}
                onConfirm={handleConfirmDelete}
                activityTitle={activityToDelete?.title || ''}
            />
        </div>
    );
};

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
    } catch {
        // Audio not supported, ignore
    }
};

// Storage key for today's schedule
const SCHEDULE_STORAGE_KEY = 'kreativium_daily_schedule';

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

// Helper to determine current activity based on time
const determineCurrentActivity = (activities: Activity[]): Activity[] => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let foundCurrent = false;
    return activities.map(activity => {
        const [startH, startM] = (activity.time || '00:00').split(':').map(Number);
        const [endH, endM] = (activity.endTime || '00:00').split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (activity.status === 'completed') {
            return activity;
        }

        if (!foundCurrent && currentMinutes >= startMinutes && currentMinutes < endMinutes) {
            foundCurrent = true;
            return { ...activity, status: 'current' as const };
        }

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
    const today = new Date().toISOString().split('T')[0];

    // Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);

    // Load schedule from localStorage or templates
    const [scheduleItems, setScheduleItems] = useState<Activity[]>(() => {
        // Try to load from localStorage first
        try {
            const stored = localStorage.getItem(`${SCHEDULE_STORAGE_KEY}_${today}_${currentContext}`);
            if (stored) {
                const parsed = JSON.parse(stored) as Activity[];
                if (parsed.length > 0) {
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
            t => t.context === currentContext && (t.dayOfWeek === dayOfWeek || t.dayOfWeek === 'all')
        );

        if (matchingTemplate && matchingTemplate.activities.length > 0) {
            return determineCurrentActivity(convertTemplateToActivities(matchingTemplate));
        }

        // Fall back to default schedule
        return determineCurrentActivity(DEFAULT_SCHEDULE);
    });

    // Save schedule to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem(
                `${SCHEDULE_STORAGE_KEY}_${today}_${currentContext}`,
                JSON.stringify(scheduleItems)
            );
        } catch (e) {
            if (import.meta.env.DEV) {
                console.error('Failed to save schedule to localStorage', e);
            }
        }
    }, [scheduleItems, today, currentContext]);

    const currentActivity = scheduleItems.find(item => item.status === 'current');
    const nextActivity = scheduleItems.find(item => item.status === 'upcoming');

    // Timer state - using refs to avoid stale closure issues
    const [timerActive, setTimerActive] = useState(false);
    const [timerStarted, setTimerStarted] = useState(false);
    const currentActivityIdRef = useRef<string | null>(null);

    // Calculate initial time based on current activity
    const getInitialTime = useCallback((activity: Activity | undefined) => {
        return activity ? (activity.durationMinutes || 30) * 60 : 0;
    }, []);

    const [timeRemaining, setTimeRemaining] = useState(() => getInitialTime(currentActivity));

    // Update timeRemaining ONLY when the current activity ID changes (not on every render)
    // This is needed to sync timer state when switching between activities
    useEffect(() => {
        if (currentActivity && currentActivity.id !== currentActivityIdRef.current) {
            currentActivityIdRef.current = currentActivity.id;
            // Only reset timer if not already started for this activity
            if (!timerStarted) {

                setTimeRemaining(getInitialTime(currentActivity));
            }
        }
    }, [currentActivity, timerStarted, getInitialTime]);

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
    }, [scheduleItems, currentActivity, today, currentContext, addScheduleEntry, timeRemaining]);

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
        } else {
            // Create new activity
            const newActivity: Activity = {
                id: uuidv4(),
                ...activityData,
                status: 'upcoming'
            };
            setScheduleItems([...scheduleItems, newActivity].sort((a, b) => a.time.localeCompare(b.time)));
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

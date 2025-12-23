/* eslint-disable react-refresh/only-export-components */
// This file exports both the DataProvider component and associated hooks.
// This is a valid React pattern for context providers.

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type {
    LogEntry,
    CrisisEvent,
    ScheduleEntry,
    Goal,
    GoalProgress,
    GoalStatus,
    ContextType,
    DailyScheduleTemplate,
    ChildProfile
} from './types';
import { enrichLogEntry, enrichCrisisEvent } from './types';
import { generateUUID } from './utils/uuid';

// ============================================
// STORAGE KEYS
// ============================================
const STORAGE_KEYS = {
    LOGS: 'kreativium_logs',
    CRISIS_EVENTS: 'kreativium_crisis_events',
    SCHEDULE_ENTRIES: 'kreativium_schedule_entries',
    SCHEDULE_TEMPLATES: 'kreativium_schedule_templates',
    GOALS: 'kreativium_goals',
    CURRENT_CONTEXT: 'kreativium_current_context',
    CHILD_PROFILE: 'kreativium_child_profile',
    ONBOARDING_COMPLETED: 'kreativium_onboarding_completed'
} as const;

// ============================================
// LOGS CONTEXT
// ============================================
interface LogsContextType {
    logs: LogEntry[];
    addLog: (log: Omit<LogEntry, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'>) => void;
    updateLog: (id: string, updates: Partial<LogEntry>) => void;
    deleteLog: (id: string) => void;
    getLogsByDateRange: (startDate: Date, endDate: Date) => LogEntry[];
    getLogsByContext: (context: ContextType) => LogEntry[];
}

const LogsContext = createContext<LogsContextType | undefined>(undefined);

// ============================================
// CRISIS EVENTS CONTEXT
// ============================================
interface CrisisContextType {
    crisisEvents: CrisisEvent[];
    addCrisisEvent: (event: Omit<CrisisEvent, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'>) => void;
    updateCrisisEvent: (id: string, updates: Partial<CrisisEvent>) => void;
    deleteCrisisEvent: (id: string) => void;
    getCrisisByDateRange: (startDate: Date, endDate: Date) => CrisisEvent[];
    getAverageCrisisDuration: () => number;
    getCrisisCountByType: () => Record<string, number>;
}

const CrisisContext = createContext<CrisisContextType | undefined>(undefined);

// ============================================
// SCHEDULE CONTEXT
// ============================================
interface ScheduleContextType {
    scheduleEntries: ScheduleEntry[];
    scheduleTemplates: DailyScheduleTemplate[];
    addScheduleEntry: (entry: ScheduleEntry) => void;
    updateScheduleEntry: (id: string, updates: Partial<ScheduleEntry>) => void;
    deleteScheduleEntry: (id: string) => void;
    getEntriesByDate: (date: string) => ScheduleEntry[];
    addTemplate: (template: DailyScheduleTemplate) => void;
    updateTemplate: (id: string, updates: Partial<DailyScheduleTemplate>) => void;
    deleteTemplate: (id: string) => void;
    getCompletionRate: (dateRange?: { start: Date; end: Date }) => number;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

// ============================================
// GOALS CONTEXT
// ============================================
interface GoalsContextType {
    goals: Goal[];
    addGoal: (goal: Goal) => void;
    updateGoal: (id: string, updates: Partial<Goal>) => void;
    deleteGoal: (id: string) => void;
    addGoalProgress: (goalId: string, progress: Omit<GoalProgress, 'id' | 'goalId'>) => void;
    getGoalProgress: (goalId: string) => GoalProgress[];
    getOverallProgress: () => number;
}

const GoalsContext = createContext<GoalsContextType | undefined>(undefined);

// ============================================
// APP CONTEXT (Current context: home/school)
// ============================================
interface AppContextType {
    currentContext: ContextType;
    setCurrentContext: (context: ContextType) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ============================================
// CHILD PROFILE CONTEXT
// ============================================
interface ChildProfileContextType {
    childProfile: ChildProfile | null;
    setChildProfile: (profile: ChildProfile) => void;
    updateChildProfile: (updates: Partial<ChildProfile>) => void;
    clearChildProfile: () => void;
}

const ChildProfileContext = createContext<ChildProfileContextType | undefined>(undefined);

// ============================================
// SETTINGS CONTEXT
// ============================================
interface SettingsContextType {
    hasCompletedOnboarding: boolean;
    completeOnboarding: () => void;
    refreshData: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// ============================================
// HELPER: Safe localStorage getter with parsing
// ============================================
function getStorageItem<T>(key: string, fallback: T): T {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch {
        return fallback;
    }
}

function getStorageString(key: string, fallback: ContextType): ContextType {
    try {
        const item = localStorage.getItem(key);
        if (item === 'home' || item === 'school') {
            return item;
        }
        return fallback;
    } catch {
        return fallback;
    }
}

// ============================================
// COMBINED PROVIDER
// ============================================
export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // State with lazy initializers - loads from localStorage during initial render
    const [logs, setLogs] = useState<LogEntry[]>(() => getStorageItem(STORAGE_KEYS.LOGS, []));
    const [crisisEvents, setCrisisEvents] = useState<CrisisEvent[]>(() => getStorageItem(STORAGE_KEYS.CRISIS_EVENTS, []));
    const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>(() => getStorageItem(STORAGE_KEYS.SCHEDULE_ENTRIES, []));
    const [scheduleTemplates, setScheduleTemplates] = useState<DailyScheduleTemplate[]>(() => getStorageItem(STORAGE_KEYS.SCHEDULE_TEMPLATES, []));
    const [goals, setGoals] = useState<Goal[]>(() => getStorageItem(STORAGE_KEYS.GOALS, []));
    const [currentContext, setCurrentContextState] = useState<ContextType>(() => getStorageString(STORAGE_KEYS.CURRENT_CONTEXT, 'home'));
    const [childProfile, setChildProfileState] = useState<ChildProfile | null>(() => getStorageItem(STORAGE_KEYS.CHILD_PROFILE, null));
    const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => getStorageItem(STORAGE_KEYS.ONBOARDING_COMPLETED, false));

    // Refresh function to reload from localStorage (for external sync)
    const loadFromStorage = useCallback(() => {
        try {
            setLogs(getStorageItem(STORAGE_KEYS.LOGS, []));
            setCrisisEvents(getStorageItem(STORAGE_KEYS.CRISIS_EVENTS, []));
            setScheduleEntries(getStorageItem(STORAGE_KEYS.SCHEDULE_ENTRIES, []));
            setScheduleTemplates(getStorageItem(STORAGE_KEYS.SCHEDULE_TEMPLATES, []));
            setGoals(getStorageItem(STORAGE_KEYS.GOALS, []));
            setCurrentContextState(getStorageString(STORAGE_KEYS.CURRENT_CONTEXT, 'home'));
            setChildProfileState(getStorageItem(STORAGE_KEYS.CHILD_PROFILE, null));
            setHasCompletedOnboarding(getStorageItem(STORAGE_KEYS.ONBOARDING_COMPLETED, false));
        } catch (e) {
            if (import.meta.env.DEV) {
                console.error('Failed to load data from localStorage', e);
            }
        }
    }, []);

    // Save functions
    const saveLogs = useCallback((newLogs: LogEntry[]) => {
        setLogs(newLogs);
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(newLogs));
    }, []);

    const saveCrisisEvents = useCallback((newEvents: CrisisEvent[]) => {
        setCrisisEvents(newEvents);
        localStorage.setItem(STORAGE_KEYS.CRISIS_EVENTS, JSON.stringify(newEvents));
    }, []);

    const saveScheduleEntries = useCallback((newEntries: ScheduleEntry[]) => {
        setScheduleEntries(newEntries);
        localStorage.setItem(STORAGE_KEYS.SCHEDULE_ENTRIES, JSON.stringify(newEntries));
    }, []);

    const saveScheduleTemplates = useCallback((newTemplates: DailyScheduleTemplate[]) => {
        setScheduleTemplates(newTemplates);
        localStorage.setItem(STORAGE_KEYS.SCHEDULE_TEMPLATES, JSON.stringify(newTemplates));
    }, []);

    const saveGoals = useCallback((newGoals: Goal[]) => {
        setGoals(newGoals);
        localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(newGoals));
    }, []);

    const setCurrentContext = useCallback((context: ContextType) => {
        setCurrentContextState(context);
        localStorage.setItem(STORAGE_KEYS.CURRENT_CONTEXT, context);
    }, []);

    // Child Profile save functions
    const setChildProfile = useCallback((profile: ChildProfile) => {
        setChildProfileState(profile);
        localStorage.setItem(STORAGE_KEYS.CHILD_PROFILE, JSON.stringify(profile));
    }, []);

    const updateChildProfile = useCallback((updates: Partial<ChildProfile>) => {
        setChildProfileState(prev => {
            if (!prev) {
                // If no profile exists, create a new one with the updates
                const newProfile: ChildProfile = {
                    id: generateUUID(),
                    name: '',
                    diagnoses: [],
                    communicationStyle: 'verbal',
                    sensorySensitivities: [],
                    seekingSensory: [],
                    effectiveStrategies: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    ...updates
                };
                localStorage.setItem(STORAGE_KEYS.CHILD_PROFILE, JSON.stringify(newProfile));
                return newProfile;
            }
            const updated = { ...prev, ...updates, updatedAt: new Date().toISOString() };
            localStorage.setItem(STORAGE_KEYS.CHILD_PROFILE, JSON.stringify(updated));
            return updated;
        });
    }, []);

    const clearChildProfile = useCallback(() => {
        setChildProfileState(null);
        localStorage.removeItem(STORAGE_KEYS.CHILD_PROFILE);
    }, []);

    // Settings methods
    const completeOnboarding = useCallback(() => {
        setHasCompletedOnboarding(true);
        localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, JSON.stringify(true));
    }, []);

    // ============================================
    // LOGS METHODS
    // ============================================
    const addLog = useCallback((log: Omit<LogEntry, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'>) => {
        const enrichedLog = enrichLogEntry(log);
        saveLogs([enrichedLog, ...logs]);
    }, [logs, saveLogs]);

    const updateLog = useCallback((id: string, updates: Partial<LogEntry>) => {
        saveLogs(logs.map(log => log.id === id ? { ...log, ...updates } : log));
    }, [logs, saveLogs]);

    const deleteLog = useCallback((id: string) => {
        saveLogs(logs.filter(log => log.id !== id));
    }, [logs, saveLogs]);

    const getLogsByDateRange = useCallback((startDate: Date, endDate: Date) => {
        return logs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate >= startDate && logDate <= endDate;
        });
    }, [logs]);

    const getLogsByContext = useCallback((context: ContextType) => {
        return logs.filter(log => log.context === context);
    }, [logs]);

    // ============================================
    // CRISIS METHODS
    // ============================================
    const addCrisisEvent = useCallback((event: Omit<CrisisEvent, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'>) => {
        const enrichedEvent = enrichCrisisEvent(event);
        saveCrisisEvents([enrichedEvent, ...crisisEvents]);
    }, [crisisEvents, saveCrisisEvents]);

    const updateCrisisEvent = useCallback((id: string, updates: Partial<CrisisEvent>) => {
        saveCrisisEvents(crisisEvents.map(e => e.id === id ? { ...e, ...updates } : e));
    }, [crisisEvents, saveCrisisEvents]);

    const deleteCrisisEvent = useCallback((id: string) => {
        saveCrisisEvents(crisisEvents.filter(e => e.id !== id));
    }, [crisisEvents, saveCrisisEvents]);

    const getCrisisByDateRange = useCallback((startDate: Date, endDate: Date) => {
        return crisisEvents.filter(event => {
            const eventDate = new Date(event.timestamp);
            return eventDate >= startDate && eventDate <= endDate;
        });
    }, [crisisEvents]);

    const getAverageCrisisDuration = useCallback(() => {
        if (crisisEvents.length === 0) return 0;
        const totalSeconds = crisisEvents.reduce((sum, e) => sum + e.durationSeconds, 0);
        return Math.round(totalSeconds / crisisEvents.length);
    }, [crisisEvents]);

    const getCrisisCountByType = useCallback(() => {
        return crisisEvents.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }, [crisisEvents]);

    // ============================================
    // SCHEDULE METHODS
    // ============================================
    const addScheduleEntry = useCallback((entry: ScheduleEntry) => {
        saveScheduleEntries([...scheduleEntries, entry]);
    }, [scheduleEntries, saveScheduleEntries]);

    const updateScheduleEntry = useCallback((id: string, updates: Partial<ScheduleEntry>) => {
        saveScheduleEntries(scheduleEntries.map(e => e.id === id ? { ...e, ...updates } : e));
    }, [scheduleEntries, saveScheduleEntries]);

    const deleteScheduleEntry = useCallback((id: string) => {
        saveScheduleEntries(scheduleEntries.filter(e => e.id !== id));
    }, [scheduleEntries, saveScheduleEntries]);

    const getEntriesByDate = useCallback((date: string) => {
        return scheduleEntries.filter(e => e.date === date);
    }, [scheduleEntries]);

    const addTemplate = useCallback((template: DailyScheduleTemplate) => {
        saveScheduleTemplates([...scheduleTemplates, template]);
    }, [scheduleTemplates, saveScheduleTemplates]);

    const updateTemplate = useCallback((id: string, updates: Partial<DailyScheduleTemplate>) => {
        saveScheduleTemplates(scheduleTemplates.map(t => t.id === id ? { ...t, ...updates } : t));
    }, [scheduleTemplates, saveScheduleTemplates]);

    const deleteTemplate = useCallback((id: string) => {
        saveScheduleTemplates(scheduleTemplates.filter(t => t.id !== id));
    }, [scheduleTemplates, saveScheduleTemplates]);

    const getCompletionRate = useCallback((dateRange?: { start: Date; end: Date }) => {
        let entries = scheduleEntries;
        if (dateRange) {
            entries = entries.filter(e => {
                const date = new Date(e.date);
                return date >= dateRange.start && date <= dateRange.end;
            });
        }
        if (entries.length === 0) return 0;
        const completed = entries.filter(e => e.status === 'completed').length;
        return Math.round((completed / entries.length) * 100);
    }, [scheduleEntries]);

    // ============================================
    // GOALS METHODS
    // ============================================
    const addGoal = useCallback((goal: Goal) => {
        saveGoals([...goals, goal]);
    }, [goals, saveGoals]);

    const updateGoal = useCallback((id: string, updates: Partial<Goal>) => {
        saveGoals(goals.map(g => g.id === id ? { ...g, ...updates } : g));
    }, [goals, saveGoals]);

    const deleteGoal = useCallback((id: string) => {
        saveGoals(goals.filter(g => g.id !== id));
    }, [goals, saveGoals]);

    const addGoalProgress = useCallback((goalId: string, progress: Omit<GoalProgress, 'id' | 'goalId'>) => {
        const newProgress: GoalProgress = {
            ...progress,
            id: generateUUID(),
            goalId
        };
        saveGoals(goals.map(g => {
            if (g.id === goalId) {
                const updatedHistory = [...g.progressHistory, newProgress];
                const latestValue = newProgress.value;

                // Auto-calculate status based on progress
                let progressPercent: number;
                if (g.targetDirection === 'decrease') {
                    // For decrease goals, use first progress entry as baseline
                    const baseline = updatedHistory.length > 1 ? updatedHistory[0].value : latestValue;
                    const range = baseline - g.targetValue;
                    progressPercent = range > 0
                        ? Math.min(100, Math.max(0, (baseline - latestValue) / range * 100))
                        : (latestValue <= g.targetValue ? 100 : 0);
                } else {
                    // Guard against division by zero
                    progressPercent = g.targetValue > 0
                        ? Math.min(100, (latestValue / g.targetValue) * 100)
                        : (latestValue > 0 ? 100 : 0);
                }

                const daysUntilDeadline = Math.ceil(
                    (new Date(g.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );

                let newStatus: GoalStatus = g.status;

                // Auto-update status based on progress and deadline
                if (progressPercent >= 100) {
                    newStatus = 'achieved';
                } else if (progressPercent >= 75) {
                    newStatus = 'on_track';
                } else if (progressPercent >= 25) {
                    // Check if at risk based on deadline
                    if (daysUntilDeadline < 14 && progressPercent < 50) {
                        newStatus = 'at_risk';
                    } else {
                        newStatus = 'in_progress';
                    }
                } else if (daysUntilDeadline < 7 && progressPercent < 25) {
                    newStatus = 'at_risk';
                } else if (g.status === 'not_started') {
                    newStatus = 'in_progress';
                }

                return {
                    ...g,
                    progressHistory: updatedHistory,
                    currentValue: latestValue,
                    status: newStatus
                };
            }
            return g;
        }));
    }, [goals, saveGoals]);

    const getGoalProgress = useCallback((goalId: string) => {
        const goal = goals.find(g => g.id === goalId);
        return goal?.progressHistory || [];
    }, [goals]);

    const getOverallProgress = useCallback(() => {
        if (goals.length === 0) return 0;
        const validGoals = goals.filter(g => g.targetValue > 0);
        if (validGoals.length === 0) return 0;
        const totalProgress = validGoals.reduce((sum, g) => {
            let progress: number;
            if (g.targetDirection === 'decrease') {
                // For decrease goals, use first progress entry as baseline
                const baseline = g.progressHistory.length > 0 ? g.progressHistory[0].value : g.currentValue;
                const range = baseline - g.targetValue;
                progress = range > 0
                    ? Math.min(100, Math.max(0, (baseline - g.currentValue) / range * 100))
                    : (g.currentValue <= g.targetValue ? 100 : 0);
            } else {
                progress = Math.min(100, (g.currentValue / g.targetValue) * 100);
            }
            return sum + progress;
        }, 0);
        return Math.round(totalProgress / validGoals.length);
    }, [goals]);

    // ============================================
    // CONTEXT VALUES
    // ============================================
    const logsValue: LogsContextType = {
        logs,
        addLog,
        updateLog,
        deleteLog,
        getLogsByDateRange,
        getLogsByContext
    };

    const crisisValue: CrisisContextType = {
        crisisEvents,
        addCrisisEvent,
        updateCrisisEvent,
        deleteCrisisEvent,
        getCrisisByDateRange,
        getAverageCrisisDuration,
        getCrisisCountByType
    };

    const scheduleValue: ScheduleContextType = {
        scheduleEntries,
        scheduleTemplates,
        addScheduleEntry,
        updateScheduleEntry,
        deleteScheduleEntry,
        getEntriesByDate,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        getCompletionRate
    };

    const goalsValue: GoalsContextType = {
        goals,
        addGoal,
        updateGoal,
        deleteGoal,
        addGoalProgress,
        getGoalProgress,
        getOverallProgress
    };

    const appValue: AppContextType = {
        currentContext,
        setCurrentContext
    };

    const childProfileValue: ChildProfileContextType = {
        childProfile,
        setChildProfile,
        updateChildProfile,
        clearChildProfile
    };

    const settingsValue: SettingsContextType = {
        hasCompletedOnboarding,
        completeOnboarding,
        refreshData: loadFromStorage
    };

    return (
        <AppContext.Provider value={appValue}>
            <ChildProfileContext.Provider value={childProfileValue}>
                <SettingsContext.Provider value={settingsValue}>
                    <LogsContext.Provider value={logsValue}>
                        <CrisisContext.Provider value={crisisValue}>
                            <ScheduleContext.Provider value={scheduleValue}>
                                <GoalsContext.Provider value={goalsValue}>
                                    {children}
                                </GoalsContext.Provider>
                            </ScheduleContext.Provider>
                        </CrisisContext.Provider>
                    </LogsContext.Provider>
                </SettingsContext.Provider>
            </ChildProfileContext.Provider>
        </AppContext.Provider>
    );
};

// ============================================
// HOOKS
// ============================================
export const useLogs = () => {
    const context = useContext(LogsContext);
    if (context === undefined) {
        throw new Error('useLogs must be used within a DataProvider');
    }
    return context;
};

export const useCrisis = () => {
    const context = useContext(CrisisContext);
    if (context === undefined) {
        throw new Error('useCrisis must be used within a DataProvider');
    }
    return context;
};

export const useSchedule = () => {
    const context = useContext(ScheduleContext);
    if (context === undefined) {
        throw new Error('useSchedule must be used within a DataProvider');
    }
    return context;
};

export const useGoals = () => {
    const context = useContext(GoalsContext);
    if (context === undefined) {
        throw new Error('useGoals must be used within a DataProvider');
    }
    return context;
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within a DataProvider');
    }
    return context;
};

export const useChildProfile = () => {
    const context = useContext(ChildProfileContext);
    if (context === undefined) {
        throw new Error('useChildProfile must be used within a DataProvider');
    }
    return context;
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a DataProvider');
    }
    return context;
};

// ============================================
// BACKWARDS COMPATIBILITY
// ============================================
// Keep LogsProvider for backwards compatibility
export const LogsProvider = DataProvider;

// ============================================
// DATA EXPORT FOR LLM ANALYSIS
// ============================================
// Re-export from separate file to satisfy React Fast Refresh requirements
// (Fast Refresh requires files to only export React components or only export non-components)
export { exportAllData, type ExportedData } from './utils/exportData';

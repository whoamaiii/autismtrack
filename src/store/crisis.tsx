/* eslint-disable react-refresh/only-export-components */
/**
 * Crisis Context - Manages crisis event tracking
 */
import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { z } from 'zod';
import type { CrisisEvent, CrisisReflection, ContextType } from '../types';
import { enrichCrisisEvent } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { CrisisEventSchema, CrisisReflectionSchema, validateCrisisEvent } from '../utils/validation';
import { createStorageSyncHandlers, getStorageItem, safeSetItem, STORAGE_REFRESH_EVENT } from './storage';
import type { CrisisContextType } from './types';

const CrisisContext = createContext<CrisisContextType | undefined>(undefined);

interface CrisisProviderProps {
    children: ReactNode;
}

export const CrisisProvider: React.FC<CrisisProviderProps> = ({ children }) => {
    const [crisisEvents, setCrisisEvents] = useState<CrisisEvent[]>(() =>
        getStorageItem(STORAGE_KEYS.CRISIS_EVENTS, [], z.array(CrisisEventSchema))
    );
    const [crisisReflections, setCrisisReflections] = useState<CrisisReflection[]>(() =>
        getStorageItem(STORAGE_KEYS.CRISIS_REFLECTIONS, [], z.array(CrisisReflectionSchema))
    );

    // Multi-tab sync and refresh event handling
    useEffect(() => {
        const eventsSync = createStorageSyncHandlers({
            key: STORAGE_KEYS.CRISIS_EVENTS,
            getLatest: () => getStorageItem(STORAGE_KEYS.CRISIS_EVENTS, [], z.array(CrisisEventSchema)),
            onUpdate: setCrisisEvents,
            refreshDelay: 100
        });

        const reflectionsSync = createStorageSyncHandlers({
            key: STORAGE_KEYS.CRISIS_REFLECTIONS,
            getLatest: () => getStorageItem(STORAGE_KEYS.CRISIS_REFLECTIONS, [], z.array(CrisisReflectionSchema)),
            onUpdate: setCrisisReflections,
            refreshDelay: 100
        });

        const handleStorageChange = (e: StorageEvent) => {
            eventsSync.handleStorageChange(e);
            reflectionsSync.handleStorageChange(e);
        };

        const handleRefresh = () => {
            eventsSync.handleRefresh();
            reflectionsSync.handleRefresh();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener(STORAGE_REFRESH_EVENT, handleRefresh);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener(STORAGE_REFRESH_EVENT, handleRefresh);
        };
    }, []);

    // Functional update pattern to prevent stale closure bugs
    const saveCrisisEvents = useCallback((updater: CrisisEvent[] | ((prev: CrisisEvent[]) => CrisisEvent[])) => {
        setCrisisEvents(prevEvents => {
            const newEvents = typeof updater === 'function' ? updater(prevEvents) : updater;
            safeSetItem(STORAGE_KEYS.CRISIS_EVENTS, JSON.stringify(newEvents));
            return newEvents;
        });
    }, []);

    const addCrisisEvent = useCallback((event: Omit<CrisisEvent, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'>): boolean => {
        const validation = validateCrisisEvent(event);
        if (!validation.success) {
            if (import.meta.env.DEV) {
                console.error('[addCrisisEvent] Validation failed:', validation.errors);
            }
            return false;
        }

        const enrichedEvent = enrichCrisisEvent(event);
        saveCrisisEvents(prev => [enrichedEvent, ...prev]);
        return true;
    }, [saveCrisisEvents]);

    const updateCrisisEvent = useCallback((id: string, updates: Partial<CrisisEvent>) => {
        saveCrisisEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    }, [saveCrisisEvents]);

    const deleteCrisisEvent = useCallback((id: string) => {
        saveCrisisEvents(prev => prev.filter(e => e.id !== id));
    }, [saveCrisisEvents]);

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

    const getCrisisEventsByContext = useCallback((context: ContextType) => {
        return crisisEvents.filter(event => event.context === context);
    }, [crisisEvents]);

    const updateCrisisRecoveryTime = useCallback((id: string, recoveryMinutes: number) => {
        saveCrisisEvents(prev => prev.map(e =>
            e.id === id ? { ...e, recoveryTimeMinutes: recoveryMinutes } : e
        ));
    }, [saveCrisisEvents]);

    // Reflection management
    const saveCrisisReflections = useCallback((updater: CrisisReflection[] | ((prev: CrisisReflection[]) => CrisisReflection[])) => {
        setCrisisReflections(prevReflections => {
            const newReflections = typeof updater === 'function' ? updater(prevReflections) : updater;
            safeSetItem(STORAGE_KEYS.CRISIS_REFLECTIONS, JSON.stringify(newReflections));
            return newReflections;
        });
    }, []);

    const addCrisisReflection = useCallback((reflection: Omit<CrisisReflection, 'id' | 'timestamp'>) => {
        const fullReflection: CrisisReflection = {
            ...reflection,
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString()
        };
        saveCrisisReflections(prev => [fullReflection, ...prev]);
    }, [saveCrisisReflections]);

    const getReflectionForCrisis = useCallback((crisisId: string) => {
        return crisisReflections.find(r => r.crisisId === crisisId);
    }, [crisisReflections]);

    const value = useMemo<CrisisContextType>(() => ({
        crisisEvents,
        crisisReflections,
        addCrisisEvent,
        updateCrisisEvent,
        deleteCrisisEvent,
        getCrisisByDateRange,
        getAverageCrisisDuration,
        getCrisisCountByType,
        getCrisisEventsByContext,
        updateCrisisRecoveryTime,
        addCrisisReflection,
        getReflectionForCrisis
    }), [crisisEvents, crisisReflections, addCrisisEvent, updateCrisisEvent, deleteCrisisEvent, getCrisisByDateRange, getAverageCrisisDuration, getCrisisCountByType, getCrisisEventsByContext, updateCrisisRecoveryTime, addCrisisReflection, getReflectionForCrisis]);

    return (
        <CrisisContext.Provider value={value}>
            {children}
        </CrisisContext.Provider>
    );
};

export const useCrisis = (): CrisisContextType => {
    const context = useContext(CrisisContext);
    if (context === undefined) {
        throw new Error('useCrisis must be used within a DataProvider');
    }
    return context;
};

export { CrisisContext };

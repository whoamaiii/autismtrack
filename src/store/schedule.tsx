/* eslint-disable react-refresh/only-export-components */
/**
 * Schedule Context - Manages visual schedule entries and templates
 */
import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { z } from 'zod';
import type { ScheduleEntry, DailyScheduleTemplate } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { ScheduleEntrySchema, DailyScheduleTemplateSchema } from '../utils/validation';
import { createStorageSyncHandlers, getStorageItem, safeSetItem, STORAGE_REFRESH_EVENT } from './storage';
import type { ScheduleContextType } from './types';

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

interface ScheduleProviderProps {
    children: ReactNode;
}

export const ScheduleProvider: React.FC<ScheduleProviderProps> = ({ children }) => {
    const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>(() =>
        getStorageItem(STORAGE_KEYS.SCHEDULE_ENTRIES, [], z.array(ScheduleEntrySchema))
    );
    const [scheduleTemplates, setScheduleTemplates] = useState<DailyScheduleTemplate[]>(() =>
        getStorageItem(STORAGE_KEYS.SCHEDULE_TEMPLATES, [], z.array(DailyScheduleTemplateSchema))
    );

    // Multi-tab sync and refresh event handling
    useEffect(() => {
        const entriesSync = createStorageSyncHandlers({
            key: STORAGE_KEYS.SCHEDULE_ENTRIES,
            getLatest: () => getStorageItem(STORAGE_KEYS.SCHEDULE_ENTRIES, [], z.array(ScheduleEntrySchema)),
            onUpdate: setScheduleEntries
        });

        const templatesSync = createStorageSyncHandlers({
            key: STORAGE_KEYS.SCHEDULE_TEMPLATES,
            getLatest: () => getStorageItem(STORAGE_KEYS.SCHEDULE_TEMPLATES, [], z.array(DailyScheduleTemplateSchema)),
            onUpdate: setScheduleTemplates
        });

        const handleStorageChange = (e: StorageEvent) => {
            entriesSync.handleStorageChange(e);
            templatesSync.handleStorageChange(e);
        };

        const handleRefresh = () => {
            entriesSync.handleRefresh();
            templatesSync.handleRefresh();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener(STORAGE_REFRESH_EVENT, handleRefresh);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener(STORAGE_REFRESH_EVENT, handleRefresh);
        };
    }, []);

    const saveScheduleEntries = useCallback((updater: ScheduleEntry[] | ((prev: ScheduleEntry[]) => ScheduleEntry[])) => {
        setScheduleEntries(prevEntries => {
            const nextEntries = typeof updater === 'function' ? updater(prevEntries) : updater;
            safeSetItem(STORAGE_KEYS.SCHEDULE_ENTRIES, JSON.stringify(nextEntries));
            return nextEntries;
        });
    }, []);

    const saveScheduleTemplates = useCallback((updater: DailyScheduleTemplate[] | ((prev: DailyScheduleTemplate[]) => DailyScheduleTemplate[])) => {
        setScheduleTemplates(prevTemplates => {
            const nextTemplates = typeof updater === 'function' ? updater(prevTemplates) : updater;
            safeSetItem(STORAGE_KEYS.SCHEDULE_TEMPLATES, JSON.stringify(nextTemplates));
            return nextTemplates;
        });
    }, []);

    const addScheduleEntry = useCallback((entry: ScheduleEntry) => {
        saveScheduleEntries(prev => [...prev, entry]);
    }, [saveScheduleEntries]);

    const updateScheduleEntry = useCallback((id: string, updates: Partial<ScheduleEntry>) => {
        saveScheduleEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    }, [saveScheduleEntries]);

    const deleteScheduleEntry = useCallback((id: string) => {
        saveScheduleEntries(prev => prev.filter(e => e.id !== id));
    }, [saveScheduleEntries]);

    const getEntriesByDate = useCallback((date: string) => {
        return scheduleEntries.filter(e => e.date === date);
    }, [scheduleEntries]);

    const addTemplate = useCallback((template: DailyScheduleTemplate) => {
        saveScheduleTemplates(prev => [...prev, template]);
    }, [saveScheduleTemplates]);

    const updateTemplate = useCallback((id: string, updates: Partial<DailyScheduleTemplate>) => {
        saveScheduleTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }, [saveScheduleTemplates]);

    const deleteTemplate = useCallback((id: string) => {
        saveScheduleTemplates(prev => prev.filter(t => t.id !== id));
    }, [saveScheduleTemplates]);

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

    const value = useMemo<ScheduleContextType>(() => ({
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
    }), [scheduleEntries, scheduleTemplates, addScheduleEntry, updateScheduleEntry, deleteScheduleEntry, getEntriesByDate, addTemplate, updateTemplate, deleteTemplate, getCompletionRate]);

    return (
        <ScheduleContext.Provider value={value}>
            {children}
        </ScheduleContext.Provider>
    );
};

export const useSchedule = (): ScheduleContextType => {
    const context = useContext(ScheduleContext);
    if (context === undefined) {
        throw new Error('useSchedule must be used within a DataProvider');
    }
    return context;
};

export { ScheduleContext };

/* eslint-disable react-refresh/only-export-components */
/**
 * Logs Context - Manages emotion/arousal log entries
 */
import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { z } from 'zod';
import type { LogEntry, ContextType } from '../types';
import { enrichLogEntry } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { LogEntrySchema, validateLogEntryInput } from '../utils/validation';
import { getStorageItem, safeSetItem, STORAGE_REFRESH_EVENT, debounce } from './storage';
import type { LogsContextType } from './types';

const LogsContext = createContext<LogsContextType | undefined>(undefined);

interface LogsProviderProps {
    children: ReactNode;
}

export const LogsProvider: React.FC<LogsProviderProps> = ({ children }) => {
    const [logs, setLogs] = useState<LogEntry[]>(() =>
        getStorageItem(STORAGE_KEYS.LOGS, [], z.array(LogEntrySchema))
    );

    // Multi-tab sync and refresh event handling
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key !== STORAGE_KEYS.LOGS || !e.newValue) return;
            try {
                const parsed = JSON.parse(e.newValue);
                const result = z.array(LogEntrySchema).safeParse(parsed);
                if (result.success) {
                    setLogs(result.data);
                } else if (import.meta.env.DEV) {
                    console.warn('[Storage Sync] Invalid logs data from other tab');
                }
            } catch (e) {
                // Log parse errors in DEV mode for debugging
                if (import.meta.env.DEV) {
                    console.warn('[Storage Sync] Failed to parse logs from other tab:', e);
                }
            }
        };

        // Handle refresh event from settings.refreshData() - debounced to prevent rapid re-renders
        const handleRefresh = debounce(() => {
            setLogs(getStorageItem(STORAGE_KEYS.LOGS, [], z.array(LogEntrySchema)));
        }, 100);

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener(STORAGE_REFRESH_EVENT, handleRefresh);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener(STORAGE_REFRESH_EVENT, handleRefresh);
        };
    }, []);

    // Functional update pattern to prevent stale closure bugs
    const saveLogs = useCallback((updater: LogEntry[] | ((prev: LogEntry[]) => LogEntry[])) => {
        setLogs(prevLogs => {
            const newLogs = typeof updater === 'function' ? updater(prevLogs) : updater;
            safeSetItem(STORAGE_KEYS.LOGS, JSON.stringify(newLogs));
            return newLogs;
        });
    }, []);

    const addLog = useCallback((log: Omit<LogEntry, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'>): boolean => {
        const validation = validateLogEntryInput(log);
        if (!validation.success) {
            if (import.meta.env.DEV) {
                console.error('[addLog] Validation failed:', validation.errors);
            }
            return false;
        }

        const enrichedLog = enrichLogEntry(log);
        saveLogs(prev => [enrichedLog, ...prev]);
        return true;
    }, [saveLogs]);

    const updateLog = useCallback((id: string, updates: Partial<LogEntry>) => {
        saveLogs(prev => prev.map(log => log.id === id ? { ...log, ...updates } : log));
    }, [saveLogs]);

    const deleteLog = useCallback((id: string) => {
        saveLogs(prev => prev.filter(log => log.id !== id));
    }, [saveLogs]);

    const getLogsByDateRange = useCallback((startDate: Date, endDate: Date) => {
        return logs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate >= startDate && logDate <= endDate;
        });
    }, [logs]);

    const getLogsByContext = useCallback((context: ContextType) => {
        return logs.filter(log => log.context === context);
    }, [logs]);

    const getLogsNearTimestamp = useCallback((timestamp: string, windowMinutes: number) => {
        const targetTime = new Date(timestamp).getTime();
        const windowMs = windowMinutes * 60 * 1000;
        return logs.filter(log => {
            const logTime = new Date(log.timestamp).getTime();
            return Math.abs(logTime - targetTime) <= windowMs;
        }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [logs]);

    const getLogsByContextAndDateRange = useCallback((context: ContextType, startDate: Date, endDate: Date) => {
        return logs.filter(log => {
            const logDate = new Date(log.timestamp);
            return log.context === context && logDate >= startDate && logDate <= endDate;
        });
    }, [logs]);

    const value = useMemo<LogsContextType>(() => ({
        logs,
        addLog,
        updateLog,
        deleteLog,
        getLogsByDateRange,
        getLogsByContext,
        getLogsNearTimestamp,
        getLogsByContextAndDateRange
    }), [logs, addLog, updateLog, deleteLog, getLogsByDateRange, getLogsByContext, getLogsNearTimestamp, getLogsByContextAndDateRange]);

    return (
        <LogsContext.Provider value={value}>
            {children}
        </LogsContext.Provider>
    );
};

export const useLogs = (): LogsContextType => {
    const context = useContext(LogsContext);
    if (context === undefined) {
        throw new Error('useLogs must be used within a DataProvider');
    }
    return context;
};

// Export context for advanced use cases
export { LogsContext };

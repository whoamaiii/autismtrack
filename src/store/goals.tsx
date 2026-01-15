/* eslint-disable react-refresh/only-export-components */
/**
 * Goals Context - Manages IEP goal tracking with progress
 */
import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { z } from 'zod';
import type { Goal, GoalProgress, GoalStatus } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { GoalSchema } from '../utils/validation';
import { generateUUID } from '../utils/uuid';
import { createStorageSyncHandlers, getStorageItem, safeSetItem, STORAGE_REFRESH_EVENT } from './storage';
import type { GoalsContextType } from './types';

const GoalsContext = createContext<GoalsContextType | undefined>(undefined);

interface GoalsProviderProps {
    children: ReactNode;
}

export const GoalsProvider: React.FC<GoalsProviderProps> = ({ children }) => {
    const [goals, setGoals] = useState<Goal[]>(() =>
        getStorageItem(STORAGE_KEYS.GOALS, [], z.array(GoalSchema))
    );

    // Multi-tab sync and refresh event handling
    useEffect(() => {
        const goalsSync = createStorageSyncHandlers({
            key: STORAGE_KEYS.GOALS,
            getLatest: () => getStorageItem(STORAGE_KEYS.GOALS, [], z.array(GoalSchema)),
            onUpdate: setGoals
        });

        window.addEventListener('storage', goalsSync.handleStorageChange);
        window.addEventListener(STORAGE_REFRESH_EVENT, goalsSync.handleRefresh);
        return () => {
            window.removeEventListener('storage', goalsSync.handleStorageChange);
            window.removeEventListener(STORAGE_REFRESH_EVENT, goalsSync.handleRefresh);
        };
    }, []);

    const saveGoals = useCallback((updater: Goal[] | ((prev: Goal[]) => Goal[])) => {
        setGoals(prevGoals => {
            const nextGoals = typeof updater === 'function' ? updater(prevGoals) : updater;
            safeSetItem(STORAGE_KEYS.GOALS, JSON.stringify(nextGoals));
            return nextGoals;
        });
    }, []);

    const addGoal = useCallback((goal: Goal) => {
        saveGoals(prev => [...prev, goal]);
    }, [saveGoals]);

    const updateGoal = useCallback((id: string, updates: Partial<Goal>) => {
        saveGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    }, [saveGoals]);

    const deleteGoal = useCallback((id: string) => {
        saveGoals(prev => prev.filter(g => g.id !== id));
    }, [saveGoals]);

    const addGoalProgress = useCallback((goalId: string, progress: Omit<GoalProgress, 'id' | 'goalId'>) => {
        const newProgress: GoalProgress = {
            ...progress,
            id: generateUUID(),
            goalId
        };
        saveGoals(prev => prev.map(g => {
            if (g.id === goalId) {
                const updatedHistory = [...g.progressHistory, newProgress];
                const latestValue = newProgress.value;

                // Auto-calculate status based on progress
                let progressPercent: number;
                if (g.targetDirection === 'decrease') {
                    const baseline = updatedHistory.length > 1 ? updatedHistory[0].value : latestValue;
                    const range = baseline - g.targetValue;
                    progressPercent = range > 0
                        ? Math.min(100, Math.max(0, (baseline - latestValue) / range * 100))
                        : (latestValue <= g.targetValue ? 100 : 0);
                } else {
                    progressPercent = g.targetValue > 0
                        ? Math.min(100, (latestValue / g.targetValue) * 100)
                        : (latestValue > 0 ? 100 : 0);
                }

                const daysUntilDeadline = Math.ceil(
                    (new Date(g.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );

                let newStatus: GoalStatus = g.status;

                if (progressPercent >= 100) {
                    newStatus = 'achieved';
                } else if (progressPercent >= 75) {
                    newStatus = 'on_track';
                } else if (progressPercent >= 25) {
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
    }, [saveGoals]);

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

    const value = useMemo<GoalsContextType>(() => ({
        goals,
        addGoal,
        updateGoal,
        deleteGoal,
        addGoalProgress,
        getGoalProgress,
        getOverallProgress
    }), [goals, addGoal, updateGoal, deleteGoal, addGoalProgress, getGoalProgress, getOverallProgress]);

    return (
        <GoalsContext.Provider value={value}>
            {children}
        </GoalsContext.Provider>
    );
};

export const useGoals = (): GoalsContextType => {
    const context = useContext(GoalsContext);
    if (context === undefined) {
        throw new Error('useGoals must be used within a DataProvider');
    }
    return context;
};

export { GoalsContext };

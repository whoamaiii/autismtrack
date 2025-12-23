import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DataProvider, useLogs, useCrisis, useGoals, useAppContext, useChildProfile, useSettings } from './store';
import type { LogEntry, CrisisEvent, Goal } from './types';
import React from 'react';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Wrapper component for hooks
const wrapper = ({ children }: { children: React.ReactNode }) => (
    <DataProvider>{children}</DataProvider>
);

describe('Store - LogsContext', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    it('starts with empty logs array', () => {
        const { result } = renderHook(() => useLogs(), { wrapper });
        expect(result.current.logs).toEqual([]);
    });

    it('adds a log entry with enrichment', () => {
        const { result } = renderHook(() => useLogs(), { wrapper });

        const newLog: Omit<LogEntry, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'> = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            timestamp: '2024-01-15T14:30:00',
            context: 'home',
            arousal: 7,
            valence: 4,
            energy: 5,
            sensoryTriggers: ['Auditiv'],
            contextTriggers: ['Overgang'],
            strategies: ['Skjerming'],
            strategyEffectiveness: 'helped',
            duration: 15,
            note: 'Test note',
        };

        act(() => {
            result.current.addLog(newLog);
        });

        expect(result.current.logs).toHaveLength(1);
        expect(result.current.logs[0].arousal).toBe(7);
        expect(result.current.logs[0].dayOfWeek).toBeDefined();
        expect(result.current.logs[0].timeOfDay).toBeDefined();
        expect(result.current.logs[0].hourOfDay).toBeDefined();
    });

    it('updates a log entry', () => {
        const { result } = renderHook(() => useLogs(), { wrapper });

        const newLog = {
            id: '123e4567-e89b-12d3-a456-426614174001',
            timestamp: '2024-01-15T14:30:00',
            context: 'home' as const,
            arousal: 5,
            valence: 5,
            energy: 5,
            sensoryTriggers: [],
            contextTriggers: [],
            strategies: [],
            duration: 10,
            note: '',
        };

        act(() => {
            result.current.addLog(newLog);
        });

        act(() => {
            result.current.updateLog('123e4567-e89b-12d3-a456-426614174001', { arousal: 8 });
        });

        expect(result.current.logs[0].arousal).toBe(8);
    });

    it('deletes a log entry', () => {
        const { result } = renderHook(() => useLogs(), { wrapper });

        const newLog = {
            id: '123e4567-e89b-12d3-a456-426614174002',
            timestamp: '2024-01-15T14:30:00',
            context: 'home' as const,
            arousal: 5,
            valence: 5,
            energy: 5,
            sensoryTriggers: [],
            contextTriggers: [],
            strategies: [],
            duration: 10,
            note: '',
        };

        act(() => {
            result.current.addLog(newLog);
        });

        expect(result.current.logs).toHaveLength(1);

        act(() => {
            result.current.deleteLog('123e4567-e89b-12d3-a456-426614174002');
        });

        expect(result.current.logs).toHaveLength(0);
    });

    it('filters logs by date range', () => {
        const { result } = renderHook(() => useLogs(), { wrapper });

        // Add logs one by one
        act(() => {
            result.current.addLog({
                id: '11111111-1111-4111-a111-111111111111',
                timestamp: '2024-01-10T10:00:00',
                context: 'home',
                arousal: 5, valence: 5, energy: 5,
                sensoryTriggers: [], contextTriggers: [], strategies: [],
                duration: 10, note: '',
            });
        });

        act(() => {
            result.current.addLog({
                id: '22222222-2222-4222-a222-222222222222',
                timestamp: '2024-01-15T10:00:00',
                context: 'school',
                arousal: 6, valence: 6, energy: 6,
                sensoryTriggers: [], contextTriggers: [], strategies: [],
                duration: 10, note: '',
            });
        });

        act(() => {
            result.current.addLog({
                id: '33333333-3333-4333-a333-333333333333',
                timestamp: '2024-01-20T10:00:00',
                context: 'home',
                arousal: 7, valence: 7, energy: 7,
                sensoryTriggers: [], contextTriggers: [], strategies: [],
                duration: 10, note: '',
            });
        });

        // Verify all logs are present
        expect(result.current.logs).toHaveLength(3);

        const filtered = result.current.getLogsByDateRange(
            new Date('2024-01-12'),
            new Date('2024-01-18')
        );

        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe('22222222-2222-4222-a222-222222222222');
    });

    it('filters logs by context', () => {
        const { result } = renderHook(() => useLogs(), { wrapper });

        act(() => {
            result.current.addLog({
                id: '44444444-4444-4444-a444-444444444444',
                timestamp: '2024-01-10T10:00:00',
                context: 'home',
                arousal: 5, valence: 5, energy: 5,
                sensoryTriggers: [], contextTriggers: [], strategies: [],
                duration: 10, note: '',
            });
        });

        act(() => {
            result.current.addLog({
                id: '55555555-5555-4555-a555-555555555555',
                timestamp: '2024-01-15T10:00:00',
                context: 'school',
                arousal: 6, valence: 6, energy: 6,
                sensoryTriggers: [], contextTriggers: [], strategies: [],
                duration: 10, note: '',
            });
        });

        expect(result.current.logs).toHaveLength(2);

        const homeLogs = result.current.getLogsByContext('home');
        expect(homeLogs).toHaveLength(1);
        expect(homeLogs[0].context).toBe('home');
    });
});

describe('Store - CrisisContext', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    it('starts with empty crisis events', () => {
        const { result } = renderHook(() => useCrisis(), { wrapper });
        expect(result.current.crisisEvents).toEqual([]);
    });

    it('adds a crisis event with enrichment', () => {
        const { result } = renderHook(() => useCrisis(), { wrapper });

        const crisisEvent: Omit<CrisisEvent, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'> = {
            id: 'c1111111-1111-4111-a111-111111111111',
            timestamp: '2024-01-15T14:30:00',
            context: 'school',
            type: 'meltdown',
            durationSeconds: 300,
            peakIntensity: 8,
            warningSignsObserved: ['Økt motorisk uro'],
            sensoryTriggers: ['Auditiv'],
            contextTriggers: ['Overgang'],
            strategiesUsed: ['Skjerming'],
            resolution: 'co_regulated',
            hasAudioRecording: false,
            notes: 'Crisis event notes',
        };

        act(() => {
            result.current.addCrisisEvent(crisisEvent);
        });

        expect(result.current.crisisEvents).toHaveLength(1);
        expect(result.current.crisisEvents[0].type).toBe('meltdown');
        expect(result.current.crisisEvents[0].dayOfWeek).toBeDefined();
    });

    it('calculates average crisis duration', () => {
        const { result } = renderHook(() => useCrisis(), { wrapper });

        act(() => {
            result.current.addCrisisEvent({
                id: 'c2222222-2222-4222-a222-222222222222', timestamp: '2024-01-15T10:00:00', context: 'home',
                type: 'meltdown', durationSeconds: 300, peakIntensity: 7,
                warningSignsObserved: [], sensoryTriggers: [], contextTriggers: [],
                strategiesUsed: [], resolution: 'self_regulated', hasAudioRecording: false, notes: '',
            });
        });

        act(() => {
            result.current.addCrisisEvent({
                id: 'c3333333-3333-4333-a333-333333333333', timestamp: '2024-01-16T10:00:00', context: 'school',
                type: 'shutdown', durationSeconds: 600, peakIntensity: 6,
                warningSignsObserved: [], sensoryTriggers: [], contextTriggers: [],
                strategiesUsed: [], resolution: 'timed_out', hasAudioRecording: false, notes: '',
            });
        });

        expect(result.current.crisisEvents).toHaveLength(2);
        expect(result.current.getAverageCrisisDuration()).toBe(450);
    });

    it('counts crises by type', () => {
        const { result } = renderHook(() => useCrisis(), { wrapper });

        act(() => {
            result.current.addCrisisEvent({
                id: 'c4444444-4444-4444-a444-444444444444', timestamp: '2024-01-15T10:00:00', context: 'home',
                type: 'meltdown', durationSeconds: 300, peakIntensity: 7,
                warningSignsObserved: [], sensoryTriggers: [], contextTriggers: [],
                strategiesUsed: [], resolution: 'self_regulated', hasAudioRecording: false, notes: '',
            });
        });

        act(() => {
            result.current.addCrisisEvent({
                id: 'c5555555-5555-4555-a555-555555555555', timestamp: '2024-01-16T10:00:00', context: 'school',
                type: 'meltdown', durationSeconds: 600, peakIntensity: 6,
                warningSignsObserved: [], sensoryTriggers: [], contextTriggers: [],
                strategiesUsed: [], resolution: 'timed_out', hasAudioRecording: false, notes: '',
            });
        });

        act(() => {
            result.current.addCrisisEvent({
                id: 'c6666666-6666-4666-a666-666666666666', timestamp: '2024-01-17T10:00:00', context: 'home',
                type: 'anxiety', durationSeconds: 200, peakIntensity: 5,
                warningSignsObserved: [], sensoryTriggers: [], contextTriggers: [],
                strategiesUsed: [], resolution: 'co_regulated', hasAudioRecording: false, notes: '',
            });
        });

        expect(result.current.crisisEvents).toHaveLength(3);
        const countByType = result.current.getCrisisCountByType();
        expect(countByType.meltdown).toBe(2);
        expect(countByType.anxiety).toBe(1);
    });
});

describe('Store - GoalsContext', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    it('starts with empty goals', () => {
        const { result } = renderHook(() => useGoals(), { wrapper });
        expect(result.current.goals).toEqual([]);
    });

    it('adds a goal', () => {
        const { result } = renderHook(() => useGoals(), { wrapper });

        const goal: Goal = {
            id: 'goal-1',
            title: 'Improve self-regulation',
            description: 'Learn to recognize early warning signs',
            category: 'regulation',
            targetValue: 10,
            targetUnit: 'times',
            targetDirection: 'increase',
            startDate: '2024-01-01',
            targetDate: '2024-03-01',
            currentValue: 0,
            status: 'not_started',
            progressHistory: [],
        };

        act(() => {
            result.current.addGoal(goal);
        });

        expect(result.current.goals).toHaveLength(1);
        expect(result.current.goals[0].title).toBe('Improve self-regulation');
    });

    it('calculates overall progress', () => {
        const { result } = renderHook(() => useGoals(), { wrapper });

        act(() => {
            result.current.addGoal({
                id: 'g1', title: 'Goal 1', description: '', category: 'regulation',
                targetValue: 10, targetUnit: 'times', targetDirection: 'increase',
                startDate: '2024-01-01', targetDate: '2024-03-01',
                currentValue: 5, status: 'in_progress', progressHistory: [],
            });
        });

        act(() => {
            result.current.addGoal({
                id: 'g2', title: 'Goal 2', description: '', category: 'social',
                targetValue: 10, targetUnit: 'times', targetDirection: 'increase',
                startDate: '2024-01-01', targetDate: '2024-03-01',
                currentValue: 10, status: 'achieved', progressHistory: [],
            });
        });

        expect(result.current.goals).toHaveLength(2);
        // (50% + 100%) / 2 = 75%
        expect(result.current.getOverallProgress()).toBe(75);
    });
});

describe('Store - AppContext', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    it('defaults to home context', () => {
        const { result } = renderHook(() => useAppContext(), { wrapper });
        expect(result.current.currentContext).toBe('home');
    });

    it('switches context', () => {
        const { result } = renderHook(() => useAppContext(), { wrapper });

        act(() => {
            result.current.setCurrentContext('school');
        });

        expect(result.current.currentContext).toBe('school');
    });
});

describe('Store - SettingsContext', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    it('defaults to onboarding not completed', () => {
        const { result } = renderHook(() => useSettings(), { wrapper });
        expect(result.current.hasCompletedOnboarding).toBe(false);
    });

    it('completes onboarding', () => {
        const { result } = renderHook(() => useSettings(), { wrapper });

        act(() => {
            result.current.completeOnboarding();
        });

        expect(result.current.hasCompletedOnboarding).toBe(true);
    });
});

describe('Store - ChildProfileContext', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    it('starts with null profile', () => {
        const { result } = renderHook(() => useChildProfile(), { wrapper });
        expect(result.current.childProfile).toBeNull();
    });

    it('sets child profile', () => {
        const { result } = renderHook(() => useChildProfile(), { wrapper });

        const profile = {
            id: 'child-1',
            name: 'Test Child',
            age: 8,
            diagnoses: ['autism', 'adhd'],
            communicationStyle: 'verbal' as const,
            sensorySensitivities: ['Auditiv'],
            seekingSensory: [],
            effectiveStrategies: ['Skjerming'],
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
        };

        act(() => {
            result.current.setChildProfile(profile);
        });

        expect(result.current.childProfile).not.toBeNull();
        expect(result.current.childProfile?.name).toBe('Test Child');
    });

    it('updates child profile', () => {
        const { result } = renderHook(() => useChildProfile(), { wrapper });

        const profile = {
            id: 'child-1',
            name: 'Test Child',
            age: 8,
            diagnoses: ['autism'],
            communicationStyle: 'verbal' as const,
            sensorySensitivities: [],
            seekingSensory: [],
            effectiveStrategies: [],
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
        };

        act(() => {
            result.current.setChildProfile(profile);
        });

        act(() => {
            result.current.updateChildProfile({ age: 9 });
        });

        expect(result.current.childProfile?.age).toBe(9);
    });

    it('clears child profile', () => {
        const { result } = renderHook(() => useChildProfile(), { wrapper });

        const profile = {
            id: 'child-1',
            name: 'Test Child',
            diagnoses: [],
            communicationStyle: 'verbal' as const,
            sensorySensitivities: [],
            seekingSensory: [],
            effectiveStrategies: [],
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
        };

        act(() => {
            result.current.setChildProfile(profile);
        });

        expect(result.current.childProfile).not.toBeNull();

        act(() => {
            result.current.clearChildProfile();
        });

        expect(result.current.childProfile).toBeNull();
    });
});

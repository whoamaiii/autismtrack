import { describe, it, expect } from 'vitest';
import { calculateTransitionStats } from './transitionAnalysis';
import type { ScheduleEntry, ScheduleActivity, ActivityStatus } from '../types';

// Helper to create a mock schedule entry
const createMockEntry = (overrides: Partial<ScheduleEntry> & { activity?: Partial<ScheduleActivity> } = {}): ScheduleEntry => {
    const defaultActivity: ScheduleActivity = {
        id: crypto.randomUUID(),
        title: 'Test Activity',
        icon: '📚',
        scheduledStart: '09:00',
        scheduledEnd: '10:00',
        durationMinutes: 60
    };

    const { activity: activityOverrides, ...restOverrides } = overrides;

    return {
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        context: 'school',
        activity: { ...defaultActivity, ...activityOverrides },
        status: 'completed' as ActivityStatus,
        transitionDifficulty: 5,
        ...restOverrides
    };
};

describe('calculateTransitionStats', () => {
    it('should return empty results for empty input', () => {
        const result = calculateTransitionStats([]);

        expect(result.overallAvgDifficulty).toBe(0);
        expect(result.totalTransitions).toBe(0);
        expect(result.hardestTransitions).toHaveLength(0);
        expect(result.easiestTransitions).toHaveLength(0);
        expect(result.effectiveSupports).toHaveLength(0);
        expect(result.recentDifficulties).toHaveLength(0);
    });

    it('should return empty results when no completed entries with transition data', () => {
        const entries = [
            createMockEntry({ status: 'upcoming', transitionDifficulty: undefined }),
            createMockEntry({ status: 'skipped', transitionDifficulty: undefined })
        ];
        const result = calculateTransitionStats(entries);

        expect(result.totalTransitions).toBe(0);
    });

    it('should calculate overall average difficulty correctly', () => {
        const entries = [
            createMockEntry({ transitionDifficulty: 2 }),
            createMockEntry({ transitionDifficulty: 4 }),
            createMockEntry({ transitionDifficulty: 6 })
        ];
        const result = calculateTransitionStats(entries);

        expect(result.overallAvgDifficulty).toBe(4); // (2+4+6)/3 = 4
        expect(result.totalTransitions).toBe(3);
    });

    it('should group transitions by activity name', () => {
        const entries = [
            createMockEntry({
                activity: { id: '1', title: 'Math', icon: '🔢', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 8
            }),
            createMockEntry({
                activity: { id: '2', title: 'Math', icon: '🔢', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 6
            }),
            createMockEntry({
                activity: { id: '3', title: 'Lunch', icon: '🍎', scheduledStart: '12:00', scheduledEnd: '13:00', durationMinutes: 60 },
                transitionDifficulty: 2
            })
        ];
        const result = calculateTransitionStats(entries);

        // Math should have avg difficulty of 7, Lunch should have 2
        const mathStats = result.hardestTransitions.find(t => t.activityName === 'Math');
        const lunchStats = result.easiestTransitions.find(t => t.activityName === 'Lunch');

        expect(mathStats).toBeDefined();
        expect(mathStats?.avgDifficulty).toBe(7);
        expect(mathStats?.count).toBe(2);

        expect(lunchStats).toBeDefined();
        expect(lunchStats?.avgDifficulty).toBe(2);
    });

    it('should calculate trend as improving when difficulty decreases', () => {
        const entries = [
            createMockEntry({
                date: '2024-01-01',
                activity: { id: '1', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 8
            }),
            createMockEntry({
                date: '2024-01-02',
                activity: { id: '2', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 7
            }),
            createMockEntry({
                date: '2024-01-03',
                activity: { id: '3', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 3
            }),
            createMockEntry({
                date: '2024-01-04',
                activity: { id: '4', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 2
            })
        ];
        const result = calculateTransitionStats(entries);

        const stats = result.hardestTransitions.find(t => t.activityName === 'Activity');
        expect(stats?.trend).toBe('improving');
    });

    it('should calculate trend as worsening when difficulty increases', () => {
        const entries = [
            createMockEntry({
                date: '2024-01-01',
                activity: { id: '1', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 2
            }),
            createMockEntry({
                date: '2024-01-02',
                activity: { id: '2', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 3
            }),
            createMockEntry({
                date: '2024-01-03',
                activity: { id: '3', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 7
            }),
            createMockEntry({
                date: '2024-01-04',
                activity: { id: '4', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 8
            })
        ];
        const result = calculateTransitionStats(entries);

        const stats = result.hardestTransitions.find(t => t.activityName === 'Activity');
        expect(stats?.trend).toBe('worsening');
    });

    it('should track support strategy effectiveness', () => {
        const entries = [
            createMockEntry({
                transitionDifficulty: 3,
                transitionSupport: ['Visual Timer', 'Countdown']
            }),
            createMockEntry({
                transitionDifficulty: 7,
                transitionSupport: ['Verbal Warning']
            }),
            createMockEntry({
                transitionDifficulty: 2,
                transitionSupport: ['Visual Timer']
            })
        ];
        const result = calculateTransitionStats(entries);

        // Visual Timer should have lower avg difficulty (more effective)
        const visualTimer = result.effectiveSupports.find(s => s.strategy === 'Visual Timer');
        expect(visualTimer).toBeDefined();
        expect(visualTimer?.usageCount).toBe(2);
        expect(visualTimer?.avgDifficultyWhenUsed).toBe(2.5); // (3+2)/2 = 2.5
    });

    it('should return recent difficulties sorted by date', () => {
        const entries = [
            createMockEntry({ date: '2024-01-03', transitionDifficulty: 5 }),
            createMockEntry({ date: '2024-01-01', transitionDifficulty: 3 }),
            createMockEntry({ date: '2024-01-02', transitionDifficulty: 4 })
        ];
        const result = calculateTransitionStats(entries);

        // Should be sorted ascending by date
        expect(result.recentDifficulties).toHaveLength(3);
        expect(result.recentDifficulties[0].date).toBe('2024-01-01');
        expect(result.recentDifficulties[1].date).toBe('2024-01-02');
        expect(result.recentDifficulties[2].date).toBe('2024-01-03');
    });

    it('should limit hardest and easiest transitions to 5', () => {
        const entries = Array.from({ length: 10 }, (_, i) =>
            createMockEntry({
                activity: {
                    id: `${i}`,
                    title: `Activity ${i}`,
                    icon: '📚',
                    scheduledStart: '09:00',
                    scheduledEnd: '10:00',
                    durationMinutes: 60
                },
                transitionDifficulty: i + 1
            })
        );
        const result = calculateTransitionStats(entries);

        expect(result.hardestTransitions).toHaveLength(5);
        expect(result.easiestTransitions).toHaveLength(5);
    });
});

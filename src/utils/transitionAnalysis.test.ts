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
        // Need 6+ data points for statistical trend detection
        const entries = [
            createMockEntry({
                date: '2024-01-01',
                activity: { id: '1', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 8
            }),
            createMockEntry({
                date: '2024-01-02',
                activity: { id: '2', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 8
            }),
            createMockEntry({
                date: '2024-01-03',
                activity: { id: '3', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 7
            }),
            createMockEntry({
                date: '2024-01-04',
                activity: { id: '4', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 3
            }),
            createMockEntry({
                date: '2024-01-05',
                activity: { id: '5', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 2
            }),
            createMockEntry({
                date: '2024-01-06',
                activity: { id: '6', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 2
            })
        ];
        const result = calculateTransitionStats(entries);

        const stats = result.hardestTransitions.find(t => t.activityName === 'Activity');
        expect(stats?.trend).toBe('improving');
    });

    it('should calculate trend as worsening when difficulty increases', () => {
        // Need 6+ data points for statistical trend detection
        const entries = [
            createMockEntry({
                date: '2024-01-01',
                activity: { id: '1', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 2
            }),
            createMockEntry({
                date: '2024-01-02',
                activity: { id: '2', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 2
            }),
            createMockEntry({
                date: '2024-01-03',
                activity: { id: '3', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 3
            }),
            createMockEntry({
                date: '2024-01-04',
                activity: { id: '4', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 7
            }),
            createMockEntry({
                date: '2024-01-05',
                activity: { id: '5', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 8
            }),
            createMockEntry({
                date: '2024-01-06',
                activity: { id: '6', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
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

describe('calculateTransitionStats - Enhanced Features', () => {
    it('should detect trend confidence based on sample size', () => {
        // Small sample size should have low confidence
        const smallEntries = [
            createMockEntry({
                date: '2024-01-01',
                activity: { id: '1', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 8
            }),
            createMockEntry({
                date: '2024-01-02',
                activity: { id: '2', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 3
            }),
        ];
        const smallResult = calculateTransitionStats(smallEntries);
        const smallStat = smallResult.hardestTransitions[0];
        expect(smallStat.trendConfidence).toBe('low');

        // Large sample size should have high confidence
        const largeEntries = Array.from({ length: 15 }, (_, i) =>
            createMockEntry({
                date: `2024-01-${String(i + 1).padStart(2, '0')}`,
                activity: { id: `${i}`, title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 5
            })
        );
        const largeResult = calculateTransitionStats(largeEntries);
        const largeStat = largeResult.hardestTransitions[0];
        expect(largeStat.trendConfidence).toBe('high');
    });

    it('should require statistical significance for trend detection', () => {
        // High variance data should be stable (no significant trend)
        const entries = [
            createMockEntry({
                date: '2024-01-01',
                activity: { id: '1', title: 'Math', icon: '🔢', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 8
            }),
            createMockEntry({
                date: '2024-01-02',
                activity: { id: '2', title: 'Math', icon: '🔢', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 2
            }),
            createMockEntry({
                date: '2024-01-03',
                activity: { id: '3', title: 'Math', icon: '🔢', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 9
            }),
            createMockEntry({
                date: '2024-01-04',
                activity: { id: '4', title: 'Math', icon: '🔢', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 1
            }),
            createMockEntry({
                date: '2024-01-05',
                activity: { id: '5', title: 'Math', icon: '🔢', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 7
            }),
            createMockEntry({
                date: '2024-01-06',
                activity: { id: '6', title: 'Math', icon: '🔢', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 3
            }),
        ];
        const result = calculateTransitionStats(entries);
        const stat = result.hardestTransitions.find(t => t.activityName === 'Math');
        // High variance should result in stable trend
        expect(stat?.trend).toBe('stable');
    });

    it('should cap history arrays to configured maximum', () => {
        const entries = Array.from({ length: 150 }, (_, i) =>
            createMockEntry({
                date: `2024-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
                activity: { id: `${i}`, title: 'Same Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 5
            })
        );
        const result = calculateTransitionStats(entries, { maxHistoryEntries: 90 });

        const stat = result.hardestTransitions.find(t => t.activityName === 'Same Activity');
        expect(stat?.history.length).toBeLessThanOrEqual(90);
    });

    it('should calculate weekly summaries', () => {
        const entries = [
            createMockEntry({ date: '2024-01-01', transitionDifficulty: 4 }),
            createMockEntry({ date: '2024-01-03', transitionDifficulty: 6 }),
            createMockEntry({ date: '2024-01-08', transitionDifficulty: 3 }),
        ];
        const result = calculateTransitionStats(entries);

        expect(result.weeklySummary).toBeDefined();
        expect(result.weeklySummary!.length).toBeGreaterThan(0);
        expect(result.weeklySummary![0]).toHaveProperty('weekStart');
        expect(result.weeklySummary![0]).toHaveProperty('avgDifficulty');
        expect(result.weeklySummary![0]).toHaveProperty('transitionCount');
    });

    it('should calculate monthly summaries', () => {
        const entries = [
            createMockEntry({ date: '2024-01-15', transitionDifficulty: 4 }),
            createMockEntry({ date: '2024-01-20', transitionDifficulty: 6 }),
            createMockEntry({ date: '2024-02-05', transitionDifficulty: 3 }),
        ];
        const result = calculateTransitionStats(entries);

        expect(result.monthlySummary).toBeDefined();
        expect(result.monthlySummary!.length).toBe(2);
        expect(result.monthlySummary![0].month).toBe('2024-01');
        expect(result.monthlySummary![1].month).toBe('2024-02');
    });

    it('should generate confidence warning for small datasets', () => {
        const entries = [
            createMockEntry({ transitionDifficulty: 5 }),
            createMockEntry({ transitionDifficulty: 5 }),
        ];
        const result = calculateTransitionStats(entries);

        expect(result.confidenceWarning).toBeDefined();
        expect(result.confidenceWarning).toContain('2 data points');
    });

    it('should accept custom configuration', () => {
        const entries = Array.from({ length: 10 }, (_, i) =>
            createMockEntry({
                activity: { id: `${i}`, title: `Activity ${i}`, icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: i + 1
            })
        );
        const result = calculateTransitionStats(entries, { topTransitionsLimit: 3 });

        expect(result.hardestTransitions.length).toBe(3);
        expect(result.easiestTransitions.length).toBe(3);
    });

    it('should include data window dates', () => {
        const entries = [
            createMockEntry({ date: '2024-01-01', transitionDifficulty: 5 }),
            createMockEntry({ date: '2024-01-15', transitionDifficulty: 5 }),
            createMockEntry({ date: '2024-01-31', transitionDifficulty: 5 }),
        ];
        const result = calculateTransitionStats(entries);

        expect(result.dataWindowStart).toBe('2024-01-01');
        expect(result.dataWindowEnd).toBe('2024-01-31');
    });

    it('should include standard deviation in stats', () => {
        const entries = [
            createMockEntry({
                date: '2024-01-01',
                activity: { id: '1', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 2
            }),
            createMockEntry({
                date: '2024-01-02',
                activity: { id: '2', title: 'Activity', icon: '📚', scheduledStart: '09:00', scheduledEnd: '10:00', durationMinutes: 60 },
                transitionDifficulty: 8
            }),
        ];
        const result = calculateTransitionStats(entries);
        const stat = result.hardestTransitions[0];

        expect(stat.standardDeviation).toBeDefined();
        expect(stat.standardDeviation).toBeGreaterThan(0);
    });
});

import { describe, it, expect } from 'vitest';
import { calculateRiskForecast } from './predictions';
import type { LogEntry } from '../types';

describe('calculateRiskForecast', () => {
    it('returns low risk with empty logs', () => {
        const result = calculateRiskForecast([]);
        expect(result.level).toBe('low');
        expect(result.score).toBe(0);
        expect(result.contributingFactors).toEqual([]);
    });

    it('returns not enough data message with few logs', () => {
        const logs: LogEntry[] = [
            createMockLog(5, new Date()),
            createMockLog(3, new Date()),
        ];
        const result = calculateRiskForecast(logs);
        expect(result.level).toBe('low');
        expect(result.contributingFactors[0].key).toBe('risk.factors.notEnoughData');
    });

    it('detects high arousal patterns', () => {
        const now = new Date();
        const logs: LogEntry[] = [];

        // Create 10 logs on same day of week within 30-day window, all with high arousal
        // (minSamplesForPrediction is now 10)
        for (let i = 0; i < 10; i++) {
            const date = new Date(now.getTime() - (Math.floor(i / 2) * 7 * 24 * 60 * 60 * 1000)); // Same day of week, going back weeks
            date.setHours(10 + (i % 3)); // Spread across hours
            logs.push(createMockLog(8, date)); // High arousal
        }

        const result = calculateRiskForecast(logs);
        expect(result.score).toBeGreaterThan(50);
    });

    it('only considers logs from the last 30 days', () => {
        const now = new Date();
        const logs: LogEntry[] = [];

        // Create 5 logs at 35 days ago (should be excluded from analysis)
        for (let i = 0; i < 5; i++) {
            const date = new Date(now.getTime() - (35 * 24 * 60 * 60 * 1000));
            date.setHours(date.getHours() + i); // Spread them out slightly
            logs.push(createMockLog(9, date)); // Very high arousal
        }

        const result = calculateRiskForecast(logs);
        // Should return not enough data since all logs are outside 30-day window
        expect(result.contributingFactors[0].key).toBe('risk.factors.notEnoughData');
    });

    it('returns calm period factor when arousal is low', () => {
        const now = new Date();
        const logs: LogEntry[] = [];

        // Create 10 logs on same day of week with low arousal (minSamplesForPrediction is 10)
        for (let i = 0; i < 10; i++) {
            const date = new Date(now.getTime() - (Math.floor(i / 2) * 7 * 24 * 60 * 60 * 1000));
            date.setHours(10 + (i % 3));
            logs.push(createMockLog(3, date)); // Low arousal
        }

        const result = calculateRiskForecast(logs);
        expect(result.level).toBe('low');
        expect(result.contributingFactors[0].key).toBe('risk.factors.calmPeriod');
    });
});

function createMockLog(arousal: number, timestamp: Date): LogEntry {
    return {
        id: crypto.randomUUID(),
        timestamp: timestamp.toISOString(),
        context: 'home',
        arousal,
        valence: 5,
        energy: 5,
        sensoryTriggers: [],
        contextTriggers: [],
        strategies: [],
        strategyEffectiveness: 'helped',
        duration: 30,
        note: '',
        dayOfWeek: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][timestamp.getDay()] as LogEntry['dayOfWeek'],
        timeOfDay: 'afternoon',
        hourOfDay: timestamp.getHours(),
    };
}

describe('calculateRiskForecast - Enhanced Features', () => {
    it('should apply recency weighting (recent data matters more)', () => {
        const now = new Date();
        const logs: LogEntry[] = [];

        // Old high arousal logs (should have less weight due to decay)
        for (let i = 0; i < 5; i++) {
            const date = new Date(now.getTime() - (25 * 24 * 60 * 60 * 1000)); // 25 days ago
            // Same day of week
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            date.setHours(date.getHours() + i);
            logs.push(createMockLog(9, date));
        }

        // Recent low arousal logs (should have more weight)
        for (let i = 0; i < 5; i++) {
            const date = new Date(now.getTime() - (7 * Math.floor(i / 2) * 24 * 60 * 60 * 1000)); // Recent weeks
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            date.setHours(10 + i);
            logs.push(createMockLog(3, date));
        }

        const result = calculateRiskForecast(logs);
        expect(result.recencyWeightedScore).toBeDefined();
        // Recent calm data should result in lower score
        expect(result.level).toBe('low');
    });

    it('should preserve raw score before capping', () => {
        const now = new Date();
        const logs: LogEntry[] = [];

        // Create very high risk scenario that would exceed 100 (10 logs for minSamplesForPrediction)
        for (let i = 0; i < 10; i++) {
            const date = new Date(now.getTime() - (Math.floor(i / 2) * 7 * 24 * 60 * 60 * 1000));
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            // Set to current hour to trigger risk zone boost
            date.setHours(now.getHours());
            logs.push(createMockLog(10, date));
        }

        const result = calculateRiskForecast(logs);

        expect(result.score).toBeLessThanOrEqual(100);
        expect(result.rawScore).toBeDefined();
        // Raw score might exceed 100 with the boost
        expect(result.rawScore).toBeGreaterThanOrEqual(result.score);
    });

    it('should return confidence level based on sample size', () => {
        const now = new Date();

        // Low sample size (exactly 10 - minimum) - use custom config for lower threshold
        const fewLogs = Array.from({ length: 5 }, (_, i) => {
            const date = new Date(now.getTime() - (7 * i * 24 * 60 * 60 * 1000));
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            return createMockLog(5, date);
        });

        const lowResult = calculateRiskForecast(fewLogs, { minSamplesForPrediction: 5 });
        expect(lowResult.confidence).toBe('low');

        // High sample size (30+) - need 30+ same-day logs for high confidence (3x min)
        const manyLogs = Array.from({ length: 35 }, (_, i) => {
            const date = new Date(now.getTime() - (Math.floor(i / 10) * 7 * 24 * 60 * 60 * 1000));
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            date.setHours(8 + (i % 10));
            return createMockLog(5, date);
        });

        const highResult = calculateRiskForecast(manyLogs);
        expect(highResult.confidence).toBe('high');
    });

    it('should accept custom configuration', () => {
        const now = new Date();

        // Only 3 logs (below default min of 5)
        const logs = Array.from({ length: 3 }, (_, i) => {
            const date = new Date(now.getTime() - (7 * i * 24 * 60 * 60 * 1000));
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            return createMockLog(8, date);
        });

        // With default config (5 min samples), should return not enough data
        const defaultResult = calculateRiskForecast(logs);
        expect(defaultResult.contributingFactors[0].key).toBe('risk.factors.notEnoughData');

        // With custom lower threshold, should work
        const customResult = calculateRiskForecast(logs, { minSamplesForPrediction: 3 });
        expect(customResult.contributingFactors[0].key).not.toBe('risk.factors.notEnoughData');
    });

    it('should provide hourly risk distribution', () => {
        const now = new Date();
        const logs: LogEntry[] = [];

        // Create pattern at 14:00 (10 logs to meet minSamplesForPrediction)
        for (let i = 0; i < 10; i++) {
            const date = new Date(now.getTime() - (Math.floor(i / 2) * 7 * 24 * 60 * 60 * 1000));
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            date.setHours(14, 30, 0, 0);
            logs.push(createMockLog(8, date));
        }

        const result = calculateRiskForecast(logs);

        expect(result.hourlyRiskDistribution).toBeDefined();
        expect(result.hourlyRiskDistribution!.length).toBeGreaterThan(0);

        const hour14 = result.hourlyRiskDistribution!.find(h => h.hour === 14);
        expect(hour14).toBeDefined();
        expect(hour14!.incidentCount).toBe(10);
    });

    it('should include sample size in result', () => {
        const now = new Date();
        const logs = Array.from({ length: 12 }, (_, i) => {
            const date = new Date(now.getTime() - (Math.floor(i / 3) * 7 * 24 * 60 * 60 * 1000));
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            date.setHours(10 + (i % 3));
            return createMockLog(5, date);
        });

        const result = calculateRiskForecast(logs);
        expect(result.sampleSize).toBeDefined();
        expect(result.sampleSize).toBeGreaterThan(0);
    });

    it('should use configurable thresholds for risk levels', () => {
        const now = new Date();
        const logs: LogEntry[] = [];

        // Create low arousal scenario (all below default threshold of 7) - 10 logs for minSamples
        for (let i = 0; i < 10; i++) {
            const date = new Date(now.getTime() - (Math.floor(i / 2) * 7 * 24 * 60 * 60 * 1000));
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            date.setHours(10 + (i % 3));
            logs.push(createMockLog(5, date)); // All low arousal (below 7)
        }

        // With default thresholds (highArousal=7), low arousal (5) should be 'low' risk
        const defaultResult = calculateRiskForecast(logs);
        expect(defaultResult.level).toBe('low');

        // Verify custom highArousalThreshold changes what counts as "high"
        const customResult = calculateRiskForecast(logs, {
            highArousalThreshold: 4, // Now arousal=5 is considered "high"
            personalizedThresholds: { enabled: false, highArousalPercentile: 75, recoveryPercentile: 25, minLogsForPersonalization: 20 }
        });
        // With lower threshold, score should be higher since all arousal=5 now counts as "high"
        expect(customResult.score).toBeGreaterThan(0);
    });
});

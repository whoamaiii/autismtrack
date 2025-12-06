import type { LogEntry } from '../types';
import { getDay, getHours, subDays } from 'date-fns';

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface RiskFactor {
    key: string;
    params?: Record<string, any>;
}

export interface RiskForecast {
    level: RiskLevel;
    score: number; // 0-100
    contributingFactors: RiskFactor[]; // e.g., { key: 'risk.factors.highStressTime', params: { time: "14:00" } }
    predictedHighArousalTime?: string; // "14:00 - 16:00"
}

/**
 * Calculates a risk forecast for the current moment based on historical data
 * Logic:
 * 1. Look at logs from the past 30 days
 * 2. Filter for logs that match the current day of week (e.g., all past Tuesdays)
 * 3. Filter for logs that match the current time of day (+/- 2 hours)
 * 4. Count "High Arousal" (>= 7) events in this window
 */
export const calculateRiskForecast = (logs: LogEntry[]): RiskForecast => {
    if (logs.length === 0) {
        return { level: 'low', score: 0, contributingFactors: [] };
    }

    const now = new Date();
    const currentDay = getDay(now); // 0-6 (Sun-Sat)
    const currentHour = getHours(now);

    // 1. Get logs from last 30 days
    const thirtyDaysAgo = subDays(now, 30);
    const recentLogs = logs.filter(log => new Date(log.timestamp) >= thirtyDaysAgo);

    // 2. Filter for same Day of Week
    const sameDayLogs = recentLogs.filter(log => getDay(new Date(log.timestamp)) === currentDay);

    if (sameDayLogs.length < 5) {
        return {
            level: 'low',
            score: 0,
            contributingFactors: [{ key: 'risk.factors.notEnoughData' }]
        };
    }

    // 3. Analyze patterns for this weekday
    let highArousalCount = 0;
    const timeBuckets: Record<number, number> = {}; // hour -> count of high arousal

    sameDayLogs.forEach(log => {
        if (log.arousal >= 7) {
            highArousalCount++;
            const hour = getHours(new Date(log.timestamp));
            timeBuckets[hour] = (timeBuckets[hour] || 0) + 1;
        }
    });

    // 4. Calculate Score
    // Base score on frequency of high arousal events on this weekday
    // If > 20% of logs on this weekday are high arousal -> Risk
    const highArousalRate = highArousalCount / sameDayLogs.length;
    let score = Math.round(highArousalRate * 100);

    // Adjust score based on current time proximity to known hotspots
    const upcomingRiskHours = Object.entries(timeBuckets)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }))
        .filter(bucket => bucket.count >= 2) // At least 2 incidents to count as a pattern
        .filter(bucket => {
            // Handle hour wraparound for late-night hours (e.g., 22:00 + 4 hours = 02:00)
            const hourDiff = bucket.hour - currentHour;
            return (hourDiff >= 0 && hourDiff <= 4) ||
                (bucket.hour < currentHour && bucket.hour + 24 - currentHour <= 4);
        });

    if (upcomingRiskHours.length > 0) {
        score += 30; // Significant boost if entering a risk zone
    }

    score = Math.min(100, score);

    // Determine Level
    let level: RiskLevel = 'low';
    if (score >= 60) level = 'high';
    else if (score >= 30) level = 'moderate';

    // Factors
    const contributingFactors: RiskFactor[] = [];
    if (upcomingRiskHours.length > 0) {
        const peakHour = upcomingRiskHours.reduce((max, curr) => curr.count > max.count ? curr : max).hour;
        const nextHour = (peakHour + 1) % 24;
        contributingFactors.push({
            key: 'risk.factors.highStressTime',
            params: { timeRange: `${peakHour}:00-${nextHour}:00` }
        });
    } else if (highArousalRate > 0.3) {
        contributingFactors.push({ key: 'risk.factors.elevatedStress' });
    } else {
        contributingFactors.push({ key: 'risk.factors.calmPeriod' });
    }

    // Predict specific time
    let predictedHighArousalTime = undefined;
    if (upcomingRiskHours.length > 0) {
        const peak = upcomingRiskHours.reduce((max, curr) => curr.count > max.count ? curr : max);
        const peakNextHour = (peak.hour + 1) % 24;
        predictedHighArousalTime = `${peak.hour}:00 - ${peakNextHour}:00`;
    }

    return {
        level,
        score,
        contributingFactors,
        predictedHighArousalTime
    };
};

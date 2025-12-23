import type { LogEntry } from '../types';
import { getDay, getHours, subDays } from 'date-fns';
import {
    DEFAULT_RISK_CONFIG,
    type RiskPredictionConfig,
} from './analysisConfig';

// ============================================================================
// Types
// ============================================================================

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface RiskFactor {
    key: string;
    params?: Record<string, string | number | boolean>;
}

export interface HourlyRisk {
    hour: number; // 0-23
    incidentCount: number;
    weightedScore: number; // Recency-weighted score contribution
}

export interface RiskForecast {
    level: RiskLevel;
    score: number; // 0-100 (capped)
    contributingFactors: RiskFactor[];
    predictedHighArousalTime?: string; // "14:00 - 16:00"
    /** Uncapped score for detailed analysis (can exceed 100) */
    rawScore?: number;
    /** Confidence level based on sample size */
    confidence?: 'low' | 'medium' | 'high';
    /** Number of logs that contributed to this forecast */
    sampleSize?: number;
    /** Score calculated with recency weighting */
    recencyWeightedScore?: number;
    /** Peak time in minutes since midnight for precise analysis */
    peakTimeMinutes?: number;
    /** Risk breakdown by hour of day */
    hourlyRiskDistribution?: HourlyRisk[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate recency weight using exponential decay.
 * Half-life determines how quickly old data loses influence.
 * A half-life of 7 days means data from 7 days ago has 50% weight.
 */
function calculateRecencyWeight(
    logDate: Date,
    now: Date,
    halfLifeDays: number
): number {
    const daysDiff = (now.getTime() - logDate.getTime()) / (24 * 60 * 60 * 1000);
    // Exponential decay: weight = 2^(-daysDiff/halfLife)
    return Math.pow(2, -daysDiff / halfLifeDays);
}

/**
 * Check if a target hour is within a window ahead of current hour.
 * Properly handles midnight wraparound (e.g., 23:00 + 4 hours = 03:00).
 */
function isHourInUpcomingWindow(
    targetHour: number,
    currentHour: number,
    windowSize: number
): boolean {
    // Calculate hours until target, handling wraparound
    let hoursUntil = targetHour - currentHour;
    if (hoursUntil < 0) {
        hoursUntil += 24; // Wrap around midnight
    }
    return hoursUntil >= 0 && hoursUntil <= windowSize;
}

/**
 * Calculate peak time with minute-level precision using weighted average.
 * Weights incidents by arousal intensity for more accurate peak detection.
 */
function calculatePeakTimeWithMinutes(
    logs: { timestamp: string; arousal: number }[],
    highArousalThreshold: number
): { hour: number; minute: number } | null {
    const highArousalLogs = logs.filter(l => l.arousal >= highArousalThreshold);

    if (highArousalLogs.length === 0) return null;

    // Convert to minutes since midnight and calculate weighted average
    let totalMinutes = 0;
    let totalWeight = 0;

    highArousalLogs.forEach(log => {
        const date = new Date(log.timestamp);
        const minutes = date.getHours() * 60 + date.getMinutes();
        // Weight by arousal intensity (higher arousal = more weight)
        const weight = log.arousal - highArousalThreshold + 1;
        totalMinutes += minutes * weight;
        totalWeight += weight;
    });

    const avgMinutes = Math.round(totalMinutes / totalWeight);
    return {
        hour: Math.floor(avgMinutes / 60) % 24,
        minute: avgMinutes % 60,
    };
}

/**
 * Determine confidence level based on sample size relative to minimum required.
 */
function getConfidenceLevel(
    sampleSize: number,
    minRequired: number
): 'low' | 'medium' | 'high' {
    if (sampleSize >= minRequired * 3) return 'high';
    if (sampleSize >= minRequired * 2) return 'medium';
    return 'low';
}

// ============================================================================
// Main Risk Forecast Function
// ============================================================================

/**
 * Calculates a risk forecast for the current moment based on historical data.
 *
 * Logic:
 * 1. Look at logs from the configured history window (default 30 days)
 * 2. Filter for logs that match the current day of week (e.g., all past Tuesdays)
 * 3. Apply recency weighting (recent data matters more)
 * 4. Analyze time-of-day patterns for high arousal events
 * 5. Boost score if currently entering a known risk time window
 */
export const calculateRiskForecast = (
    logs: LogEntry[],
    config: Partial<RiskPredictionConfig> = {}
): RiskForecast => {
    const cfg = { ...DEFAULT_RISK_CONFIG, ...config };

    if (logs.length === 0) {
        return { level: 'low', score: 0, contributingFactors: [] };
    }

    const now = new Date();
    const currentDay = getDay(now); // 0-6 (Sun-Sat)
    const currentHour = getHours(now);

    // 1. Get logs from configured history window
    const cutoffDate = subDays(now, cfg.historyDays);
    const recentLogs = logs.filter(log => new Date(log.timestamp) >= cutoffDate);

    // 2. Filter for same Day of Week
    const sameDayLogs = recentLogs.filter(log =>
        getDay(new Date(log.timestamp)) === currentDay
    );

    if (sameDayLogs.length < cfg.minSamplesForPrediction) {
        return {
            level: 'low',
            score: 0,
            contributingFactors: [{ key: 'risk.factors.notEnoughData' }],
            confidence: 'low',
            sampleSize: sameDayLogs.length,
        };
    }

    // 3. Analyze patterns with recency weighting
    let weightedHighArousalSum = 0;
    let totalWeight = 0;
    const timeBuckets: Record<number, { count: number; weightedSum: number }> = {};

    sameDayLogs.forEach(log => {
        const logDate = new Date(log.timestamp);
        const weight = calculateRecencyWeight(logDate, now, cfg.recencyDecayHalfLife);
        totalWeight += weight;

        if (log.arousal >= cfg.highArousalThreshold) {
            weightedHighArousalSum += weight;
            const hour = getHours(logDate);

            if (!timeBuckets[hour]) {
                timeBuckets[hour] = { count: 0, weightedSum: 0 };
            }
            timeBuckets[hour].count += 1;
            timeBuckets[hour].weightedSum += weight;
        }
    });

    // 4. Calculate weighted score
    const weightedHighArousalRate = totalWeight > 0
        ? weightedHighArousalSum / totalWeight
        : 0;
    let rawScore = Math.round(weightedHighArousalRate * 100);
    const recencyWeightedScore = rawScore;

    // 5. Find upcoming risk hours with proper midnight wraparound
    const upcomingRiskHours = Object.entries(timeBuckets)
        .map(([hour, data]) => ({
            hour: parseInt(hour, 10),
            count: data.count,
            weightedSum: data.weightedSum
        }))
        .filter(bucket => bucket.count >= cfg.minIncidentsForPattern)
        .filter(bucket => isHourInUpcomingWindow(bucket.hour, currentHour, cfg.hoursAheadWindow));

    if (upcomingRiskHours.length > 0) {
        rawScore += cfg.riskZoneBoost;
    }

    // Store uncapped score for detailed analysis
    const uncappedScore = rawScore;
    const score = Math.min(100, rawScore);

    // 6. Determine Level
    let level: RiskLevel = 'low';
    if (score >= cfg.highRiskThreshold) level = 'high';
    else if (score >= cfg.moderateRiskThreshold) level = 'moderate';

    // 7. Calculate confidence based on sample size
    const confidence = getConfidenceLevel(sameDayLogs.length, cfg.minSamplesForPrediction);

    // 8. Build contributing factors
    const contributingFactors: RiskFactor[] = [];
    if (upcomingRiskHours.length > 0) {
        const peakHour = upcomingRiskHours.reduce(
            (max, curr) => curr.weightedSum > max.weightedSum ? curr : max
        ).hour;
        const nextHour = (peakHour + 1) % 24;
        contributingFactors.push({
            key: 'risk.factors.highStressTime',
            params: {
                timeRange: `${peakHour.toString().padStart(2, '0')}:00-${nextHour.toString().padStart(2, '0')}:00`
            }
        });
    } else if (weightedHighArousalRate > 0.3) {
        contributingFactors.push({ key: 'risk.factors.elevatedStress' });
    } else {
        contributingFactors.push({ key: 'risk.factors.calmPeriod' });
    }

    // 9. Calculate precise peak time
    let predictedHighArousalTime: string | undefined;
    let peakTimeMinutes: number | undefined;

    if (upcomingRiskHours.length > 0) {
        const peak = upcomingRiskHours.reduce(
            (max, curr) => curr.weightedSum > max.weightedSum ? curr : max
        );
        const peakNextHour = (peak.hour + 1) % 24;
        predictedHighArousalTime = `${peak.hour.toString().padStart(2, '0')}:00 - ${peakNextHour.toString().padStart(2, '0')}:00`;

        // Calculate minute-level precision if we have enough data
        const peakTimeDetail = calculatePeakTimeWithMinutes(
            sameDayLogs.map(l => ({ timestamp: l.timestamp, arousal: l.arousal })),
            cfg.highArousalThreshold
        );
        if (peakTimeDetail) {
            peakTimeMinutes = peakTimeDetail.hour * 60 + peakTimeDetail.minute;
        }
    }

    // 10. Build hourly risk distribution
    const hourlyRiskDistribution: HourlyRisk[] = Object.entries(timeBuckets)
        .map(([hour, data]) => ({
            hour: parseInt(hour, 10),
            incidentCount: data.count,
            weightedScore: parseFloat((data.weightedSum * 100).toFixed(1)),
        }))
        .sort((a, b) => a.hour - b.hour);

    return {
        level,
        score,
        contributingFactors,
        predictedHighArousalTime,
        rawScore: uncappedScore,
        confidence,
        sampleSize: sameDayLogs.length,
        recencyWeightedScore,
        peakTimeMinutes,
        hourlyRiskDistribution,
    };
};

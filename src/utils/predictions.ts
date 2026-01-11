import type { LogEntry } from '../types';
import { getDay, getHours, subDays } from 'date-fns';
import {
    DEFAULT_RISK_CONFIG,
    type RiskPredictionConfig,
} from './analysisConfig';
import {
    wilsonScoreInterval,
    calibrationCheck
} from './statisticalUtils';

// ============================================================================
// Constants
// ============================================================================

const HOURS_PER_DAY = 24;
const MINUTES_PER_DAY = HOURS_PER_DAY * 60;
const MS_PER_DAY = MINUTES_PER_DAY * 60 * 1000;

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
    /** 95% confidence interval for risk score */
    scoreCI?: { lower: number; upper: number };
    /** Multi-factor score breakdown */
    multiFactorBreakdown?: {
        arousalScore: number;
        energyScore: number;
        contextScore: number;
        strategyScore: number;
        lagScore: number;
    };
    /** Personalized threshold used (if different from default) */
    personalizedThreshold?: number;
    /** Multiple peak times if bimodal distribution detected */
    secondaryPeaks?: Array<{ hour: number; intensity: number }>;
    /** Cross-day lag effect contribution */
    lagEffectContribution?: number;
}

/**
 * Calculate personalized arousal threshold based on child's historical data
 */
export function calculatePersonalizedThreshold(
    logs: LogEntry[],
    percentile: number = 75,
    minLogs: number = 20
): number | null {
    if (logs.length < minLogs) {
        return null;
    }

    const arousalValues = logs.map(l => l.arousal).sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * arousalValues.length);
    return arousalValues[Math.min(index, arousalValues.length - 1)];
}

/**
 * Calculate cross-day lag effects (yesterday's high arousal predicts today's risk)
 */
function calculateLagEffects(
    logs: LogEntry[],
    currentDate: Date,
    lagDays: number = 3
): { lagScore: number; lagFactor: RiskFactor | null } {
    let lagScore = 0;
    let lagFactor: RiskFactor | null = null;

    for (let dayOffset = 1; dayOffset <= lagDays; dayOffset++) {
        const targetDate = subDays(currentDate, dayOffset);
        const targetDayStart = new Date(targetDate);
        targetDayStart.setHours(0, 0, 0, 0);
        const targetDayEnd = new Date(targetDate);
        targetDayEnd.setHours(23, 59, 59, 999);

        const dayLogs = logs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate >= targetDayStart && logDate <= targetDayEnd;
        });

        if (dayLogs.length === 0) continue;

        // Calculate that day's average arousal
        const avgArousal = dayLogs.reduce((sum, l) => sum + l.arousal, 0) / dayLogs.length;
        const highArousalCount = dayLogs.filter(l => l.arousal >= 7).length;
        const highArousalRate = highArousalCount / dayLogs.length;

        // Weight by recency (yesterday = full weight, older = less)
        const weight = 1 / dayOffset;

        if (avgArousal >= 6 || highArousalRate > 0.3) {
            const dayContribution = (avgArousal - 5) * 5 * weight; // Scale to meaningful contribution
            lagScore += Math.max(0, dayContribution);

            if (!lagFactor && dayContribution > 5) {
                lagFactor = {
                    key: 'risk.factors.previousDayStress',
                    params: {
                        daysAgo: dayOffset,
                        avgArousal: Math.round(avgArousal * 10) / 10
                    }
                };
            }
        }
    }

    return { lagScore: Math.min(20, lagScore), lagFactor };
}

/**
 * Detect multiple peak hours (bimodal distribution)
 */
function detectMultiplePeaks(
    timeBuckets: Record<number, { count: number; weightedSum: number }>,
    minIncidents: number
): Array<{ hour: number; intensity: number }> {
    const peaks: Array<{ hour: number; intensity: number }> = [];

    // Convert to sorted array
    const bucketArray = Object.entries(timeBuckets)
        .map(([hour, data]) => ({ hour: parseInt(hour, 10), ...data }))
        .filter(b => b.count >= minIncidents)
        .sort((a, b) => b.weightedSum - a.weightedSum);

    if (bucketArray.length === 0) return peaks;

    // Find peaks (local maxima)
    for (const bucket of bucketArray) {
        // Check if this is a local maximum (higher than neighbors)
        const prevHour = (bucket.hour - 1 + 24) % 24;
        const nextHour = (bucket.hour + 1) % 24;

        const prevBucket = timeBuckets[prevHour];
        const nextBucket = timeBuckets[nextHour];

        const prevSum = prevBucket?.weightedSum || 0;
        const nextSum = nextBucket?.weightedSum || 0;

        if (bucket.weightedSum > prevSum && bucket.weightedSum > nextSum) {
            peaks.push({
                hour: bucket.hour,
                intensity: bucket.weightedSum
            });
        }
    }

    // If no clear peaks found, use top hours
    if (peaks.length === 0 && bucketArray.length > 0) {
        peaks.push({
            hour: bucketArray[0].hour,
            intensity: bucketArray[0].weightedSum
        });
    }

    // Return up to 3 peaks
    return peaks.slice(0, 3);
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
    const daysDiff = (now.getTime() - logDate.getTime()) / MS_PER_DAY;
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
        hoursUntil += HOURS_PER_DAY; // Wrap around midnight
    }
    return hoursUntil >= 0 && hoursUntil <= windowSize;
}

/**
 * Calculate peak time with minute-level precision using circular mean.
 * Uses circular statistics to properly handle times spanning midnight.
 * Weights incidents by arousal intensity for more accurate peak detection.
 */
function calculatePeakTimeWithMinutes(
    logs: { timestamp: string; arousal: number }[],
    highArousalThreshold: number
): { hour: number; minute: number } | null {
    const highArousalLogs = logs.filter(l => l.arousal >= highArousalThreshold);

    if (highArousalLogs.length === 0) return null;

    // Use circular mean to properly handle times spanning midnight
    // Convert time to angle (0-1440 minutes -> 0-2π radians)
    let sinSum = 0;
    let cosSum = 0;
    let totalWeight = 0;

    highArousalLogs.forEach(log => {
        const date = new Date(log.timestamp);
        const minutes = date.getHours() * 60 + date.getMinutes();
        // Convert to angle in radians
        const angle = (minutes / MINUTES_PER_DAY) * 2 * Math.PI;
        // Weight by arousal intensity (higher arousal = more weight)
        const weight = log.arousal - highArousalThreshold + 1;

        sinSum += Math.sin(angle) * weight;
        cosSum += Math.cos(angle) * weight;
        totalWeight += weight;
    });

    // Calculate circular mean angle
    const avgAngle = Math.atan2(sinSum / totalWeight, cosSum / totalWeight);

    // Convert back to minutes (handle negative angles)
    let avgMinutes = Math.round((avgAngle / (2 * Math.PI)) * MINUTES_PER_DAY);
    if (avgMinutes < 0) avgMinutes += MINUTES_PER_DAY;

    return {
        hour: Math.floor(avgMinutes / 60) % HOURS_PER_DAY,
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
 * 6. NEW: Multi-factor scoring (energy, context, strategy failures)
 * 7. NEW: Cross-day lag effects
 * 8. NEW: Personalized thresholds
 * 9. NEW: Confidence intervals
 * 10. NEW: Multi-modal peak detection
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

    // Calculate personalized threshold if enabled
    let effectiveHighArousalThreshold = cfg.highArousalThreshold;
    let personalizedThreshold: number | undefined;

    if (cfg.personalizedThresholds.enabled) {
        const calculated = calculatePersonalizedThreshold(
            logs,
            cfg.personalizedThresholds.highArousalPercentile,
            cfg.personalizedThresholds.minLogsForPersonalization
        );
        if (calculated !== null) {
            effectiveHighArousalThreshold = calculated;
            personalizedThreshold = calculated;
        }
    }

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

    // Track multi-factor data
    let lowEnergyCount = 0;
    let strategyFailureCount = 0;
    let contextRiskScore = 0;

    sameDayLogs.forEach(log => {
        const logDate = new Date(log.timestamp);
        const weight = calculateRecencyWeight(logDate, now, cfg.recencyDecayHalfLife);
        totalWeight += weight;

        if (log.arousal >= effectiveHighArousalThreshold) {
            weightedHighArousalSum += weight;
            const hour = getHours(logDate);

            if (!timeBuckets[hour]) {
                timeBuckets[hour] = { count: 0, weightedSum: 0 };
            }
            timeBuckets[hour].count += 1;
            timeBuckets[hour].weightedSum += weight;
        }

        // Multi-factor tracking
        if (log.energy < 4) lowEnergyCount++;
        if (log.strategyEffectiveness === 'escalated') strategyFailureCount++;

        // Context-specific risk (some children have higher risk at school)
        // This could be learned from data; for now, we track it
        if (log.arousal >= effectiveHighArousalThreshold) {
            contextRiskScore += log.context === 'school' ? 1.2 : 1.0;
        }
    });

    // 4. Calculate base weighted score (arousal component)
    const weightedHighArousalRate = totalWeight > 0
        ? weightedHighArousalSum / totalWeight
        : 0;
    let arousalScore = Math.round(weightedHighArousalRate * 100);
    const recencyWeightedScore = arousalScore;

    // 5. Calculate multi-factor scores
    let energyScore = 0;
    let contextScore = 0;
    let strategyScore = 0;
    let lagScore = 0;

    if (cfg.enableMultiFactorScoring) {
        // Energy factor: low energy correlates with risk
        const lowEnergyRate = lowEnergyCount / sameDayLogs.length;
        energyScore = Math.round(lowEnergyRate * 30 * cfg.energyFactorWeight);

        // Strategy failure factor: recent failures indicate elevated risk
        const strategyFailureRate = strategyFailureCount / sameDayLogs.length;
        strategyScore = Math.round(strategyFailureRate * 40 * cfg.strategyFailureWeight);

        // Context factor: if school is higher risk, boost score during school hours
        if (contextRiskScore > sameDayLogs.length) {
            contextScore = Math.round(10 * cfg.contextFactorWeight);
        }
    }

    // 6. Calculate lag effects
    let lagFactor: RiskFactor | null = null;
    let lagEffectContribution = 0;

    if (cfg.enableLagEffects) {
        const lagResult = calculateLagEffects(recentLogs, now, cfg.lagEffectDays);
        lagScore = Math.round(lagResult.lagScore);
        lagFactor = lagResult.lagFactor;
        lagEffectContribution = lagScore;
    }

    // 7. Combine scores
    let rawScore = arousalScore + energyScore + contextScore + strategyScore + lagScore;

    // 8. Find upcoming risk hours with proper midnight wraparound
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

    // 9. Calculate confidence interval using Wilson score
    const highArousalCount = sameDayLogs.filter(l => l.arousal >= effectiveHighArousalThreshold).length;
    const ciResult = wilsonScoreInterval(highArousalCount, sameDayLogs.length, 0.95);
    const scoreCI = {
        lower: Math.round(ciResult.lower * 100),
        upper: Math.round(ciResult.upper * 100)
    };

    // 10. Determine Level
    let level: RiskLevel = 'low';
    if (score >= cfg.highRiskThreshold) level = 'high';
    else if (score >= cfg.moderateRiskThreshold) level = 'moderate';

    // 11. Calculate confidence based on sample size
    const confidence = getConfidenceLevel(sameDayLogs.length, cfg.minSamplesForPrediction);

    // 12. Build contributing factors
    const contributingFactors: RiskFactor[] = [];

    // Calculate peak once and reuse
    const peak = upcomingRiskHours.length > 0
        ? upcomingRiskHours.reduce((max, curr) => curr.weightedSum > max.weightedSum ? curr : max)
        : null;

    if (peak) {
        const nextHour = (peak.hour + 1) % HOURS_PER_DAY;
        contributingFactors.push({
            key: 'risk.factors.highStressTime',
            params: {
                timeRange: `${peak.hour.toString().padStart(2, '0')}:00-${nextHour.toString().padStart(2, '0')}:00`
            }
        });
    } else if (weightedHighArousalRate > 0.3) {
        contributingFactors.push({ key: 'risk.factors.elevatedStress' });
    } else {
        contributingFactors.push({ key: 'risk.factors.calmPeriod' });
    }

    // Add multi-factor contributing factors
    if (energyScore > 5) {
        contributingFactors.push({ key: 'risk.factors.lowEnergy' });
    }
    if (strategyScore > 5) {
        contributingFactors.push({ key: 'risk.factors.strategyFailures' });
    }
    if (lagFactor) {
        contributingFactors.push(lagFactor);
    }

    // 13. Calculate precise peak time
    let predictedHighArousalTime: string | undefined;
    let peakTimeMinutes: number | undefined;

    if (peak) {
        const peakNextHour = (peak.hour + 1) % HOURS_PER_DAY;
        predictedHighArousalTime = `${peak.hour.toString().padStart(2, '0')}:00 - ${peakNextHour.toString().padStart(2, '0')}:00`;

        // Calculate minute-level precision if we have enough data
        const peakTimeDetail = calculatePeakTimeWithMinutes(
            sameDayLogs.map(l => ({ timestamp: l.timestamp, arousal: l.arousal })),
            effectiveHighArousalThreshold
        );
        if (peakTimeDetail) {
            peakTimeMinutes = peakTimeDetail.hour * 60 + peakTimeDetail.minute;
        }
    }

    // 14. Detect multiple peaks (bimodal distribution)
    const allPeaks = detectMultiplePeaks(timeBuckets, cfg.minIncidentsForPattern);
    const secondaryPeaks = allPeaks.length > 1 ? allPeaks.slice(1) : undefined;

    // 15. Build hourly risk distribution
    const hourlyRiskDistribution: HourlyRisk[] = Object.entries(timeBuckets)
        .map(([hour, data]) => ({
            hour: parseInt(hour, 10),
            incidentCount: data.count,
            weightedScore: parseFloat((data.weightedSum * 100).toFixed(1)),
        }))
        .sort((a, b) => a.hour - b.hour);

    // 16. Build multi-factor breakdown
    const multiFactorBreakdown = cfg.enableMultiFactorScoring ? {
        arousalScore,
        energyScore,
        contextScore,
        strategyScore,
        lagScore
    } : undefined;

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
        scoreCI,
        multiFactorBreakdown,
        personalizedThreshold,
        secondaryPeaks,
        lagEffectContribution
    };
};

/**
 * Validate prediction calibration - check if predictions match actual outcomes
 */
export function validatePredictionCalibration(
    historicalPredictions: Array<{ predicted: number; actualHighArousal: boolean }>
): {
    brierScore: number;
    isCalibrated: boolean;
    calibrationBins: Array<{ binCenter: number; predictedMean: number; actualMean: number; count: number }>;
} {
    const results = calibrationCheck(
        historicalPredictions.map(p => ({
            predicted: p.predicted / 100, // Convert from 0-100 to 0-1
            actual: p.actualHighArousal
        }))
    );

    return {
        brierScore: results.brierScore,
        isCalibrated: results.isCalibrated,
        calibrationBins: results.calibrationBins
    };
}

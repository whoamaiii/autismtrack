/**
 * Recovery Pattern Analysis
 * Analyze post-crisis recovery times, vulnerability windows, and factors affecting recovery
 *
 * Improvements implemented:
 * - Data-driven vulnerability window calculation
 * - Mann-Kendall statistical trend test
 * - Personalized recovery thresholds
 * - Confidence intervals for recovery times
 */

import type {
    LogEntry,
    CrisisEvent,
    CrisisType,
    RecoveryAnalysis,
    RecoveryFactor,
    RecoveryStats,
    VulnerabilityWindow,
    RecoveryIndicator
} from '../types';
import {
    DEFAULT_RECOVERY_CONFIG,
    type RecoveryAnalysisConfig
} from './analysisConfig';
import { safeParseTimestamp, safeParseTimestampWithFallback } from './dateUtils';
import { mannKendallTest, bootstrapMeanCI } from './statisticalUtils';

// ============================================
// PERSONALIZED THRESHOLDS
// ============================================

/**
 * Calculate personalized recovery thresholds based on child's baseline
 */
export function calculatePersonalizedRecoveryThresholds(
    logs: LogEntry[],
    _config: Partial<RecoveryAnalysisConfig> = {}
): { arousalThreshold: number; energyThreshold: number } | null {
    if (logs.length < 20) {
        return null;
    }

    // Use 25th percentile for arousal (lower = recovered)
    const arousalValues = logs.map(l => l.arousal).sort((a, b) => a - b);
    const arousalP25Index = Math.floor(arousalValues.length * 0.25);
    const arousalThreshold = arousalValues[arousalP25Index];

    // Use 75th percentile for energy (higher = recovered)
    const energyValues = logs.map(l => l.energy).sort((a, b) => a - b);
    const energyP75Index = Math.floor(energyValues.length * 0.75);
    const energyThreshold = energyValues[energyP75Index];

    return { arousalThreshold, energyThreshold };
}

// ============================================
// RECOVERY DETECTION
// ============================================

/**
 * Auto-detect recovery time from subsequent logs after a crisis
 * (Internal helper - used by analyzeRecoveryPatterns)
 */
function detectRecoveryFromLogs(
    crisisEvent: CrisisEvent,
    logs: LogEntry[],
    config: Partial<RecoveryAnalysisConfig> = {},
    personalizedThresholds?: { arousalThreshold: number; energyThreshold: number }
): RecoveryIndicator {
    const cfg = { ...DEFAULT_RECOVERY_CONFIG, ...config };

    // Use personalized thresholds if available and enabled
    const arousalThreshold = (cfg.usePersonalizedRecoveryThresholds && personalizedThresholds)
        ? personalizedThresholds.arousalThreshold
        : cfg.normalArousalThreshold;
    const energyThreshold = (cfg.usePersonalizedRecoveryThresholds && personalizedThresholds)
        ? personalizedThresholds.energyThreshold
        : cfg.normalEnergyThreshold;

    // Validate crisis timestamp - return early if invalid
    const crisisStartTime = safeParseTimestamp(crisisEvent.timestamp);
    if (crisisStartTime === null) {
        return {
            crisisId: crisisEvent.id,
            manualRecoveryTime: crisisEvent.recoveryTimeMinutes,
            recoveryConfidence: 'unknown'
        };
    }

    const crisisEndTime = crisisStartTime + (crisisEvent.durationSeconds * 1000);
    const maxWindowEnd = crisisEndTime + (cfg.maxRecoveryWindow * 60 * 1000);

    // Find logs after crisis within the recovery window (skip logs with invalid timestamps)
    const subsequentLogs = logs
        .filter(log => {
            const logTime = safeParseTimestamp(log.timestamp);
            if (logTime === null) return false; // Skip invalid timestamps
            return logTime > crisisEndTime && logTime <= maxWindowEnd;
        })
        .sort((a, b) => {
            const timeA = safeParseTimestampWithFallback(a.timestamp, 0);
            const timeB = safeParseTimestampWithFallback(b.timestamp, 0);
            return timeA - timeB;
        });

    // Find first "normal" log using appropriate thresholds
    const recoveryLog = subsequentLogs.find(log =>
        log.arousal <= arousalThreshold &&
        log.energy >= energyThreshold
    );

    if (recoveryLog) {
        const recoveryTime = safeParseTimestamp(recoveryLog.timestamp);
        if (recoveryTime === null) {
            return {
                crisisId: crisisEvent.id,
                manualRecoveryTime: crisisEvent.recoveryTimeMinutes,
                recoveryConfidence: crisisEvent.recoveryTimeMinutes ? 'confirmed' : 'unknown'
            };
        }
        const detectedMinutes = Math.round((recoveryTime - crisisEndTime) / (60 * 1000));

        return {
            crisisId: crisisEvent.id,
            detectedRecoveryTime: detectedMinutes,
            manualRecoveryTime: crisisEvent.recoveryTimeMinutes,
            recoveryConfidence: crisisEvent.recoveryTimeMinutes ? 'confirmed' : 'estimated',
            firstNormalLogId: recoveryLog.id,
            detectedAt: new Date().toISOString()
        };
    }

    // If there are logs but none show recovery, check if the last one is still elevated
    if (subsequentLogs.length > 0) {
        const lastLog = subsequentLogs[subsequentLogs.length - 1];
        if (lastLog.arousal > arousalThreshold) {
            // Still not recovered within window
            return {
                crisisId: crisisEvent.id,
                manualRecoveryTime: crisisEvent.recoveryTimeMinutes,
                recoveryConfidence: crisisEvent.recoveryTimeMinutes ? 'confirmed' : 'unknown'
            };
        }
    }

    return {
        crisisId: crisisEvent.id,
        manualRecoveryTime: crisisEvent.recoveryTimeMinutes,
        recoveryConfidence: crisisEvent.recoveryTimeMinutes ? 'confirmed' : 'unknown'
    };
}

/**
 * Get effective recovery time (prefer manual, fallback to detected)
 */
function getEffectiveRecoveryTime(
    crisis: CrisisEvent,
    indicator: RecoveryIndicator
): number | null {
    return indicator.manualRecoveryTime ??
           indicator.detectedRecoveryTime ??
           crisis.recoveryTimeMinutes ??
           null;
}

// ============================================
// VULNERABILITY WINDOW ANALYSIS
// ============================================

/**
 * Extended vulnerability window with data-driven calculation
 */
export interface ExtendedVulnerabilityWindow extends VulnerabilityWindow {
    /** Confidence interval for the vulnerability duration */
    durationCI?: { lower: number; upper: number };
    /** Whether the window was calculated from data or using defaults */
    isDataDriven: boolean;
    /** Time at which re-escalation probability drops below target */
    safeTimeMinutes?: number;
}

/**
 * Calculate post-crisis vulnerability window
 * Now with data-driven window calculation based on observed re-escalation times
 */
function calculateVulnerabilityWindow(
    crisisEvents: CrisisEvent[],
    _logs: LogEntry[],
    config: Partial<RecoveryAnalysisConfig> = {}
): ExtendedVulnerabilityWindow {
    const cfg = { ...DEFAULT_RECOVERY_CONFIG, ...config };

    if (crisisEvents.length < 2) {
        return {
            durationMinutes: cfg.vulnerabilityWindowMinutes,
            elevatedRiskPeriod: cfg.vulnerabilityWindowMinutes,
            recommendedBuffer: cfg.vulnerabilityWindowMinutes + 15,
            reEscalationRate: 0,
            isDataDriven: false
        };
    }

    // Sort crises by timestamp - precompute timestamps for performance
    // Filter out crises with invalid timestamps
    const sortedCrises = [...crisisEvents]
        .map(c => {
            const startMs = safeParseTimestamp(c.timestamp);
            return {
                ...c,
                startMs: startMs ?? 0,
                endMs: (startMs ?? 0) + (c.durationSeconds * 1000),
                hasValidTimestamp: startMs !== null
            };
        })
        .filter(c => c.hasValidTimestamp)
        .sort((a, b) => a.startMs - b.startMs);

    // Collect all gaps between crises
    const timeBetweenCrises: number[] = [];

    for (let i = 1; i < sortedCrises.length; i++) {
        const gap = (sortedCrises[i].startMs - sortedCrises[i - 1].endMs) / (60 * 1000); // minutes
        if (gap > 0 && gap < 480) { // Only include gaps up to 8 hours
            timeBetweenCrises.push(gap);
        }
    }

    if (timeBetweenCrises.length < 3) {
        return {
            durationMinutes: cfg.vulnerabilityWindowMinutes,
            elevatedRiskPeriod: cfg.vulnerabilityWindowMinutes,
            recommendedBuffer: cfg.vulnerabilityWindowMinutes + 15,
            reEscalationRate: 0,
            isDataDriven: false
        };
    }

    // Data-driven vulnerability window calculation
    let durationMinutes: number;
    let safeTimeMinutes: number | undefined;
    let durationCI: { lower: number; upper: number } | undefined;

    if (cfg.enableDataDrivenVulnerability) {
        // Sort gaps to find the time at which re-escalation probability drops below target
        const sortedGaps = [...timeBetweenCrises].sort((a, b) => a - b);

        // Find the percentile corresponding to target re-escalation probability
        // e.g., if target is 10%, find the 90th percentile of gaps
        const targetPercentile = 1 - cfg.targetReEscalationProbability;
        const targetIndex = Math.floor(targetPercentile * sortedGaps.length);
        safeTimeMinutes = sortedGaps[Math.min(targetIndex, sortedGaps.length - 1)];

        // Use the median of quick re-escalations as the vulnerability duration
        const quickGaps = sortedGaps.filter(g => g <= safeTimeMinutes!);
        durationMinutes = quickGaps.length > 0
            ? quickGaps[Math.floor(quickGaps.length / 2)]
            : cfg.vulnerabilityWindowMinutes;

        // Calculate bootstrap CI for the duration
        const ciResult = bootstrapMeanCI(quickGaps.length > 0 ? quickGaps : [cfg.vulnerabilityWindowMinutes], 0.95, 500);
        durationCI = { lower: Math.round(ciResult.lower), upper: Math.round(ciResult.upper) };
    } else {
        // Fallback to original calculation
        const quickReescalations = timeBetweenCrises.filter(t => t <= cfg.vulnerabilityWindowMinutes * 2);
        durationMinutes = quickReescalations.length > 0
            ? Math.round(quickReescalations.reduce((a, b) => a + b, 0) / quickReescalations.length)
            : cfg.vulnerabilityWindowMinutes;
    }

    // Count re-escalations within the calculated vulnerability window
    let reEscalations = 0;
    for (const gap of timeBetweenCrises) {
        if (gap <= durationMinutes) {
            reEscalations++;
        }
    }
    const reEscalationRate = Math.round((reEscalations / timeBetweenCrises.length) * 100);

    // Elevated risk period and recommended buffer
    const elevatedRiskPeriod = Math.round(durationMinutes);
    const recommendedBuffer = safeTimeMinutes
        ? Math.round(safeTimeMinutes)
        : Math.round(durationMinutes * 1.5);

    return {
        durationMinutes,
        elevatedRiskPeriod,
        recommendedBuffer,
        reEscalationRate,
        isDataDriven: cfg.enableDataDrivenVulnerability,
        durationCI,
        safeTimeMinutes
    };
}

// ============================================
// RECOVERY FACTOR ANALYSIS
// ============================================

interface FactorGroup {
    withFactor: number[];
    withoutFactor: number[];
}

/**
 * Analyze which factors correlate with faster or slower recovery
 * (Internal helper - used by analyzeRecoveryPatterns)
 */
function analyzeRecoveryFactors(
    crisisEvents: CrisisEvent[],
    logs: LogEntry[],
    config: Partial<RecoveryAnalysisConfig> = {}
): { accelerators: RecoveryFactor[]; delayers: RecoveryFactor[] } {
    const cfg = { ...DEFAULT_RECOVERY_CONFIG, ...config };

    // Get recovery times for each crisis
    const crisesWithRecovery: { crisis: CrisisEvent; recoveryTime: number }[] = [];

    crisisEvents.forEach(crisis => {
        const indicator = detectRecoveryFromLogs(crisis, logs, config);
        const recoveryTime = getEffectiveRecoveryTime(crisis, indicator);
        if (recoveryTime !== null && recoveryTime > 0) {
            crisesWithRecovery.push({ crisis, recoveryTime });
        }
    });

    if (crisesWithRecovery.length < cfg.minRecoveryDataPoints) {
        return { accelerators: [], delayers: [] };
    }

    const factors: RecoveryFactor[] = [];

    // Analyze by strategy used
    const strategyGroups = new Map<string, FactorGroup>();
    const allStrategies = new Set<string>();

    crisesWithRecovery.forEach(({ crisis }) => {
        crisis.strategiesUsed.forEach(s => allStrategies.add(s));
    });

    allStrategies.forEach(strategy => {
        const withFactor: number[] = [];
        const withoutFactor: number[] = [];

        crisesWithRecovery.forEach(({ crisis, recoveryTime }) => {
            if (crisis.strategiesUsed.includes(strategy)) {
                withFactor.push(recoveryTime);
            } else {
                withoutFactor.push(recoveryTime);
            }
        });

        if (withFactor.length >= cfg.minFactorSampleSize && withoutFactor.length >= cfg.minFactorSampleSize) {
            strategyGroups.set(strategy, { withFactor, withoutFactor });
        }
    });

    strategyGroups.forEach((group, strategy) => {
        const avgWith = group.withFactor.reduce((a, b) => a + b, 0) / group.withFactor.length;
        const avgWithout = group.withoutFactor.reduce((a, b) => a + b, 0) / group.withoutFactor.length;
        const impact = avgWith - avgWithout; // Positive = delays, Negative = accelerates

        factors.push({
            factor: strategy,
            factorType: 'strategy',
            avgRecoveryWithFactor: Math.round(avgWith),
            avgRecoveryWithoutFactor: Math.round(avgWithout),
            impactMinutes: Math.round(impact),
            sampleSize: group.withFactor.length
        });
    });

    // Analyze by context
    const homeRecoveries = crisesWithRecovery.filter(c => c.crisis.context === 'home').map(c => c.recoveryTime);
    const schoolRecoveries = crisesWithRecovery.filter(c => c.crisis.context === 'school').map(c => c.recoveryTime);

    if (homeRecoveries.length >= cfg.minFactorSampleSize && schoolRecoveries.length >= cfg.minFactorSampleSize) {
        const avgHome = homeRecoveries.reduce((a, b) => a + b, 0) / homeRecoveries.length;
        const avgSchool = schoolRecoveries.reduce((a, b) => a + b, 0) / schoolRecoveries.length;

        factors.push({
            factor: 'Hjemme',
            factorType: 'context',
            avgRecoveryWithFactor: Math.round(avgHome),
            avgRecoveryWithoutFactor: Math.round(avgSchool),
            impactMinutes: Math.round(avgHome - avgSchool),
            sampleSize: homeRecoveries.length
        });
    }

    // Analyze by time of day
    const morningRecoveries = crisesWithRecovery.filter(c =>
        c.crisis.timeOfDay === 'morning' || c.crisis.timeOfDay === 'midday'
    ).map(c => c.recoveryTime);
    const afternoonRecoveries = crisesWithRecovery.filter(c =>
        c.crisis.timeOfDay === 'afternoon' || c.crisis.timeOfDay === 'evening'
    ).map(c => c.recoveryTime);

    if (morningRecoveries.length >= cfg.minFactorSampleSize && afternoonRecoveries.length >= cfg.minFactorSampleSize) {
        const avgMorning = morningRecoveries.reduce((a, b) => a + b, 0) / morningRecoveries.length;
        const avgAfternoon = afternoonRecoveries.reduce((a, b) => a + b, 0) / afternoonRecoveries.length;

        factors.push({
            factor: 'Formiddag',
            factorType: 'time',
            avgRecoveryWithFactor: Math.round(avgMorning),
            avgRecoveryWithoutFactor: Math.round(avgAfternoon),
            impactMinutes: Math.round(avgMorning - avgAfternoon),
            sampleSize: morningRecoveries.length
        });
    }

    // Split into accelerators and delayers
    const accelerators = factors
        .filter(f => f.impactMinutes < -5) // At least 5 minutes faster
        .sort((a, b) => a.impactMinutes - b.impactMinutes); // Most negative first

    const delayers = factors
        .filter(f => f.impactMinutes > 5) // At least 5 minutes slower
        .sort((a, b) => b.impactMinutes - a.impactMinutes); // Most positive first

    return { accelerators, delayers };
}

// ============================================
// RECOVERY BY CRISIS TYPE
// ============================================

/**
 * Extended recovery stats with confidence intervals and statistical trend
 */
export interface ExtendedRecoveryStats extends RecoveryStats {
    /** 95% confidence interval for average recovery time */
    avgCI?: { lower: number; upper: number };
    /** Mann-Kendall trend p-value */
    trendPValue?: number;
    /** Kendall's tau correlation coefficient */
    trendTau?: number;
}

/**
 * Calculate recovery statistics grouped by crisis type
 * Now uses Mann-Kendall test for proper statistical trend detection
 */
function calculateRecoveryByType(
    crisisEvents: CrisisEvent[],
    logs: LogEntry[],
    config: Partial<RecoveryAnalysisConfig> = {},
    personalizedThresholds?: { arousalThreshold: number; energyThreshold: number }
): Partial<Record<CrisisType, ExtendedRecoveryStats>> {
    const cfg = { ...DEFAULT_RECOVERY_CONFIG, ...config };
    const result: Partial<Record<CrisisType, ExtendedRecoveryStats>> = {};

    const crisisTypes: CrisisType[] = ['meltdown', 'shutdown', 'anxiety', 'sensory_overload', 'other'];

    crisisTypes.forEach(type => {
        const typeCrises = crisisEvents.filter(c => c.type === type);
        const recoveryTimes: number[] = [];

        typeCrises.forEach(crisis => {
            const indicator = detectRecoveryFromLogs(crisis, logs, config, personalizedThresholds);
            const time = getEffectiveRecoveryTime(crisis, indicator);
            if (time !== null && time > 0) {
                recoveryTimes.push(time);
            }
        });

        if (recoveryTimes.length >= 2) {
            const sortedTimes = [...recoveryTimes].sort((a, b) => a - b);
            const median = sortedTimes.length % 2 === 0
                ? (sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2
                : sortedTimes[Math.floor(sortedTimes.length / 2)];

            // Calculate trend using appropriate method
            let trend: 'improving' | 'worsening' | 'stable' = 'stable';
            let trendPValue: number | undefined;
            let trendTau: number | undefined;

            if (cfg.useStatisticalTrendTest && recoveryTimes.length >= 4) {
                // Use Mann-Kendall test for proper statistical trend detection
                const mkResult = mannKendallTest(recoveryTimes);
                trendPValue = mkResult.pValue;
                trendTau = mkResult.tau;

                if (mkResult.trend === 'decreasing') {
                    trend = 'improving'; // Decreasing recovery time = improving
                } else if (mkResult.trend === 'increasing') {
                    trend = 'worsening'; // Increasing recovery time = worsening
                }
            } else {
                // Fallback to first half vs second half comparison
                const halfIndex = Math.floor(recoveryTimes.length / 2);
                const firstHalf = recoveryTimes.slice(0, halfIndex);
                const secondHalf = recoveryTimes.slice(-halfIndex);

                const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
                const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

                const trendThreshold = avgFirst * 0.15;
                if (avgSecond < avgFirst - trendThreshold) {
                    trend = 'improving';
                } else if (avgSecond > avgFirst + trendThreshold) {
                    trend = 'worsening';
                }
            }

            // Calculate confidence interval for average
            const avgCI = bootstrapMeanCI(recoveryTimes, 0.95, 500);

            result[type] = {
                avgMinutes: Math.round(recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length),
                minMinutes: Math.round(sortedTimes[0]),
                maxMinutes: Math.round(sortedTimes[sortedTimes.length - 1]),
                medianMinutes: Math.round(median),
                count: recoveryTimes.length,
                trend,
                avgCI: { lower: Math.round(avgCI.lower), upper: Math.round(avgCI.upper) },
                trendPValue,
                trendTau
            };
        }
    });

    return result;
}

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

/**
 * Extended recovery analysis with additional statistical metrics
 */
export interface ExtendedRecoveryAnalysis extends RecoveryAnalysis {
    /** 95% confidence interval for average recovery time */
    avgRecoveryTimeCI?: { lower: number; upper: number };
    /** Mann-Kendall trend test results */
    trendStatistics?: {
        pValue: number;
        tau: number;
    };
    /** Personalized thresholds used (if enabled) */
    personalizedThresholds?: {
        arousalThreshold: number;
        energyThreshold: number;
    };
}

/**
 * Perform comprehensive recovery analysis
 * Now includes personalized thresholds and statistical trend testing
 */
export function analyzeRecoveryPatterns(
    crisisEvents: CrisisEvent[],
    logs: LogEntry[],
    config: Partial<RecoveryAnalysisConfig> = {}
): ExtendedRecoveryAnalysis {
    const cfg = { ...DEFAULT_RECOVERY_CONFIG, ...config };

    // Calculate personalized thresholds if enabled
    const personalizedThresholds = cfg.usePersonalizedRecoveryThresholds
        ? calculatePersonalizedRecoveryThresholds(logs, config)
        : undefined;

    // Collect all recovery times
    const allRecoveryTimes: number[] = [];

    crisisEvents.forEach(crisis => {
        const indicator = detectRecoveryFromLogs(crisis, logs, config, personalizedThresholds ?? undefined);
        const time = getEffectiveRecoveryTime(crisis, indicator);
        if (time !== null && time > 0) {
            allRecoveryTimes.push(time);
        }
    });

    const crisesWithRecoveryData = allRecoveryTimes.length;
    const avgRecoveryTime = crisesWithRecoveryData > 0
        ? Math.round(allRecoveryTimes.reduce((a, b) => a + b, 0) / crisesWithRecoveryData)
        : 0;

    // Calculate confidence interval for average
    let avgRecoveryTimeCI: { lower: number; upper: number } | undefined;
    if (allRecoveryTimes.length >= 3) {
        const ciResult = bootstrapMeanCI(allRecoveryTimes, 0.95, 500);
        avgRecoveryTimeCI = { lower: Math.round(ciResult.lower), upper: Math.round(ciResult.upper) };
    }

    // Calculate overall trend using appropriate method
    let recoveryTrend: 'improving' | 'worsening' | 'stable' = 'stable';
    let trendStatistics: { pValue: number; tau: number } | undefined;

    if (allRecoveryTimes.length >= 4 && cfg.useStatisticalTrendTest) {
        // Use Mann-Kendall test
        const mkResult = mannKendallTest(allRecoveryTimes);
        trendStatistics = { pValue: mkResult.pValue, tau: mkResult.tau };

        if (mkResult.trend === 'decreasing') {
            recoveryTrend = 'improving';
        } else if (mkResult.trend === 'increasing') {
            recoveryTrend = 'worsening';
        }
    } else if (allRecoveryTimes.length >= 6) {
        // Fallback to first half vs second half
        const halfIndex = Math.floor(allRecoveryTimes.length / 2);
        const firstHalf = allRecoveryTimes.slice(0, halfIndex);
        const secondHalf = allRecoveryTimes.slice(-halfIndex);

        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        const trendThreshold = avgFirst * 0.15;
        if (avgSecond < avgFirst - trendThreshold) {
            recoveryTrend = 'improving';
        } else if (avgSecond > avgFirst + trendThreshold) {
            recoveryTrend = 'worsening';
        }
    }

    const { accelerators, delayers } = analyzeRecoveryFactors(crisisEvents, logs, config);
    const vulnerabilityWindow = calculateVulnerabilityWindow(crisisEvents, logs, config);
    const recoveryByType = calculateRecoveryByType(crisisEvents, logs, config, personalizedThresholds ?? undefined);

    return {
        avgRecoveryTime,
        recoveryTrend,
        factorsAcceleratingRecovery: accelerators,
        factorsDelayingRecovery: delayers,
        vulnerabilityWindow,
        recoveryByType,
        totalCrisesAnalyzed: crisisEvents.length,
        crisesWithRecoveryData,
        avgRecoveryTimeCI,
        trendStatistics,
        personalizedThresholds: personalizedThresholds ?? undefined
    };
}

/**
 * Get recovery summary text
 */
export function getRecoverySummary(analysis: RecoveryAnalysis): string {
    if (analysis.crisesWithRecoveryData === 0) {
        return 'Ingen gjenopprettingsdata tilgjengelig ennå. Logg gjenopprettingstider etter krisehendelser for innsikt.';
    }

    let summary = `Gjennomsnittlig gjenopprettingstid: ${analysis.avgRecoveryTime} minutter\n`;

    if (analysis.recoveryTrend !== 'stable') {
        const trendText = analysis.recoveryTrend === 'improving'
            ? 'Gjenoppretting forbedres over tid'
            : 'Gjenoppretting tar lengre tid enn før';
        summary += `Trend: ${trendText}\n`;
    }

    if (analysis.factorsAcceleratingRecovery.length > 0) {
        const top = analysis.factorsAcceleratingRecovery[0];
        summary += `\nRaskere gjenoppretting med: ${top.factor} (${Math.abs(top.impactMinutes)} min raskere)\n`;
    }

    if (analysis.vulnerabilityWindow.reEscalationRate > 20) {
        summary += `\nAdvarsel: ${analysis.vulnerabilityWindow.reEscalationRate}% av krisene følges av ny krise innen ${analysis.vulnerabilityWindow.durationMinutes} minutter.\n`;
        summary += `Anbefalt hviletid: ${analysis.vulnerabilityWindow.recommendedBuffer} minutter etter krise.\n`;
    }

    return summary;
}

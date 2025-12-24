/**
 * Recovery Pattern Analysis
 * Analyze post-crisis recovery times, vulnerability windows, and factors affecting recovery
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

// ============================================
// RECOVERY DETECTION
// ============================================

/**
 * Auto-detect recovery time from subsequent logs after a crisis
 */
export function detectRecoveryFromLogs(
    crisisEvent: CrisisEvent,
    logs: LogEntry[],
    config: Partial<RecoveryAnalysisConfig> = {}
): RecoveryIndicator {
    const cfg = { ...DEFAULT_RECOVERY_CONFIG, ...config };

    const crisisEndTime = new Date(crisisEvent.timestamp).getTime() + (crisisEvent.durationSeconds * 1000);
    const maxWindowEnd = crisisEndTime + (cfg.maxRecoveryWindow * 60 * 1000);

    // Find logs after crisis within the recovery window
    const subsequentLogs = logs
        .filter(log => {
            const logTime = new Date(log.timestamp).getTime();
            return logTime > crisisEndTime && logTime <= maxWindowEnd;
        })
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Find first "normal" log
    const recoveryLog = subsequentLogs.find(log =>
        log.arousal <= cfg.normalArousalThreshold &&
        log.energy >= cfg.normalEnergyThreshold
    );

    if (recoveryLog) {
        const recoveryTime = new Date(recoveryLog.timestamp).getTime();
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
        if (lastLog.arousal > cfg.normalArousalThreshold) {
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
 * Calculate post-crisis vulnerability window
 */
export function calculateVulnerabilityWindow(
    crisisEvents: CrisisEvent[],
    _logs: LogEntry[],
    config: Partial<RecoveryAnalysisConfig> = {}
): VulnerabilityWindow {
    const cfg = { ...DEFAULT_RECOVERY_CONFIG, ...config };

    if (crisisEvents.length < 2) {
        return {
            durationMinutes: cfg.vulnerabilityWindowMinutes,
            elevatedRiskPeriod: cfg.vulnerabilityWindowMinutes,
            recommendedBuffer: cfg.vulnerabilityWindowMinutes + 15,
            reEscalationRate: 0
        };
    }

    // Sort crises by timestamp
    const sortedCrises = [...crisisEvents].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Count re-escalations within vulnerability window
    let reEscalations = 0;
    const timeBetweenCrises: number[] = [];

    for (let i = 1; i < sortedCrises.length; i++) {
        const prevEnd = new Date(sortedCrises[i - 1].timestamp).getTime() +
                        (sortedCrises[i - 1].durationSeconds * 1000);
        const nextStart = new Date(sortedCrises[i].timestamp).getTime();
        const gap = (nextStart - prevEnd) / (60 * 1000); // minutes

        timeBetweenCrises.push(gap);

        if (gap <= cfg.vulnerabilityWindowMinutes) {
            reEscalations++;
        }
    }

    const reEscalationRate = sortedCrises.length > 1
        ? Math.round((reEscalations / (sortedCrises.length - 1)) * 100)
        : 0;

    // Calculate median time between crises for those that re-escalated quickly
    const quickReescalations = timeBetweenCrises.filter(t => t <= cfg.vulnerabilityWindowMinutes * 2);
    const avgQuickReescalation = quickReescalations.length > 0
        ? quickReescalations.reduce((a, b) => a + b, 0) / quickReescalations.length
        : cfg.vulnerabilityWindowMinutes;

    // Elevated risk period is average quick re-escalation time
    const elevatedRiskPeriod = Math.round(avgQuickReescalation);

    // Recommended buffer adds safety margin
    const recommendedBuffer = Math.round(elevatedRiskPeriod * 1.5);

    return {
        durationMinutes: Math.round(avgQuickReescalation),
        elevatedRiskPeriod,
        recommendedBuffer,
        reEscalationRate
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
 */
export function analyzeRecoveryFactors(
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
 * Calculate recovery statistics grouped by crisis type
 */
export function calculateRecoveryByType(
    crisisEvents: CrisisEvent[],
    logs: LogEntry[],
    config: Partial<RecoveryAnalysisConfig> = {}
): Partial<Record<CrisisType, RecoveryStats>> {
    const result: Partial<Record<CrisisType, RecoveryStats>> = {};

    const crisisTypes: CrisisType[] = ['meltdown', 'shutdown', 'anxiety', 'sensory_overload', 'other'];

    crisisTypes.forEach(type => {
        const typeCrises = crisisEvents.filter(c => c.type === type);
        const recoveryTimes: number[] = [];

        typeCrises.forEach(crisis => {
            const indicator = detectRecoveryFromLogs(crisis, logs, config);
            const time = getEffectiveRecoveryTime(crisis, indicator);
            if (time !== null && time > 0) {
                recoveryTimes.push(time);
            }
        });

        if (recoveryTimes.length >= 2) {
            recoveryTimes.sort((a, b) => a - b);
            const median = recoveryTimes.length % 2 === 0
                ? (recoveryTimes[recoveryTimes.length / 2 - 1] + recoveryTimes[recoveryTimes.length / 2]) / 2
                : recoveryTimes[Math.floor(recoveryTimes.length / 2)];

            // Calculate trend (compare first half to second half)
            const halfIndex = Math.floor(recoveryTimes.length / 2);
            const firstHalf = recoveryTimes.slice(0, halfIndex);
            const secondHalf = recoveryTimes.slice(-halfIndex);

            const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
            const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

            let trend: 'improving' | 'worsening' | 'stable' = 'stable';
            const trendThreshold = avgFirst * 0.15; // 15% change threshold
            if (avgSecond < avgFirst - trendThreshold) {
                trend = 'improving';
            } else if (avgSecond > avgFirst + trendThreshold) {
                trend = 'worsening';
            }

            result[type] = {
                avgMinutes: Math.round(recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length),
                minMinutes: Math.round(recoveryTimes[0]),
                maxMinutes: Math.round(recoveryTimes[recoveryTimes.length - 1]),
                medianMinutes: Math.round(median),
                count: recoveryTimes.length,
                trend
            };
        }
    });

    return result;
}

// ============================================
// MAIN ANALYSIS FUNCTION
// ============================================

/**
 * Perform comprehensive recovery analysis
 */
export function analyzeRecoveryPatterns(
    crisisEvents: CrisisEvent[],
    logs: LogEntry[],
    config: Partial<RecoveryAnalysisConfig> = {}
): RecoveryAnalysis {
    // Collect all recovery times
    const allRecoveryTimes: number[] = [];

    crisisEvents.forEach(crisis => {
        const indicator = detectRecoveryFromLogs(crisis, logs, config);
        const time = getEffectiveRecoveryTime(crisis, indicator);
        if (time !== null && time > 0) {
            allRecoveryTimes.push(time);
        }
    });

    const crisesWithRecoveryData = allRecoveryTimes.length;
    const avgRecoveryTime = crisesWithRecoveryData > 0
        ? Math.round(allRecoveryTimes.reduce((a, b) => a + b, 0) / crisesWithRecoveryData)
        : 0;

    // Calculate overall trend
    let recoveryTrend: 'improving' | 'worsening' | 'stable' = 'stable';
    if (allRecoveryTimes.length >= 6) {
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
    const recoveryByType = calculateRecoveryByType(crisisEvents, logs, config);

    return {
        avgRecoveryTime,
        recoveryTrend,
        factorsAcceleratingRecovery: accelerators,
        factorsDelayingRecovery: delayers,
        vulnerabilityWindow,
        recoveryByType,
        totalCrisesAnalyzed: crisisEvents.length,
        crisesWithRecoveryData
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

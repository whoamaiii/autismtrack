/**
 * Configuration types and defaults for analysis utilities.
 * These configurations allow fine-tuning of statistical thresholds
 * and algorithm parameters without code changes.
 */

/**
 * Configuration for transition analysis
 */
export interface TransitionAnalysisConfig {
  /** Minimum data points required for trend detection (default: 6) */
  minSamplesForTrend: number;
  /** Minimum data points required for high-confidence trend (default: 12) */
  minSamplesForHighConfidence: number;
  /** Minimum difference in averages to report a trend (default: 0.5 on 1-10 scale) */
  trendSignificanceThreshold: number;
  /** Maximum history entries to retain per activity (default: 90) */
  maxHistoryEntries: number;
  /** Number of recent entries to show in chart (default: 14) */
  recentEntriesLimit: number;
  /** Number of hardest/easiest transitions to return (default: 5) */
  topTransitionsLimit: number;
}

/**
 * Configuration for personalized thresholds (adaptive to child's baseline)
 */
export interface PersonalizedThresholdConfig {
  /** Whether to use personalized thresholds based on child's percentiles */
  enabled: boolean;
  /** Percentile for high arousal (default: 75 = top 25%) */
  highArousalPercentile: number;
  /** Percentile for recovery (default: 25 = bottom 25%) */
  recoveryPercentile: number;
  /** Minimum logs required to calculate personalized thresholds */
  minLogsForPersonalization: number;
}

/**
 * Configuration for risk prediction
 */
export interface RiskPredictionConfig {
  /** Minimum samples on same weekday for prediction (default: 10) */
  minSamplesForPrediction: number;
  /** Minimum incidents at an hour to count as a pattern (default: 2) */
  minIncidentsForPattern: number;
  /** Hours ahead to check for upcoming risk (default: 4) */
  hoursAheadWindow: number;
  /** Score boost when entering a risk zone (default: 30) */
  riskZoneBoost: number;
  /** Threshold for high risk level (default: 60) */
  highRiskThreshold: number;
  /** Threshold for moderate risk level (default: 30) */
  moderateRiskThreshold: number;
  /** Days of historical data to analyze (default: 30) */
  historyDays: number;
  /** Recency decay half-life in days - newer data weighted more (default: 7) */
  recencyDecayHalfLife: number;
  /** High arousal threshold - >= this value counts as high arousal (default: 7) */
  highArousalThreshold: number;
  /** Personalized threshold configuration */
  personalizedThresholds: PersonalizedThresholdConfig;
  /** Enable multi-factor risk scoring (energy, context, triggers) */
  enableMultiFactorScoring: boolean;
  /** Weight for energy factor in risk calculation (0-1) */
  energyFactorWeight: number;
  /** Weight for context factor in risk calculation (0-1) */
  contextFactorWeight: number;
  /** Weight for recent strategy failure in risk calculation (0-1) */
  strategyFailureWeight: number;
  /** Enable cross-day lag effects in prediction */
  enableLagEffects: boolean;
  /** Days to look back for lag effects (default: 3) */
  lagEffectDays: number;
}

/**
 * Default configuration for transition analysis
 */
export const DEFAULT_TRANSITION_CONFIG: TransitionAnalysisConfig = {
  minSamplesForTrend: 6,
  minSamplesForHighConfidence: 12,
  trendSignificanceThreshold: 0.5,
  maxHistoryEntries: 90,
  recentEntriesLimit: 14,
  topTransitionsLimit: 5,
};

/**
 * Default configuration for personalized thresholds
 */
export const DEFAULT_PERSONALIZED_THRESHOLD_CONFIG: PersonalizedThresholdConfig = {
  enabled: true,
  highArousalPercentile: 75,
  recoveryPercentile: 25,
  minLogsForPersonalization: 20,
};

/**
 * Default configuration for risk prediction
 */
export const DEFAULT_RISK_CONFIG: RiskPredictionConfig = {
  minSamplesForPrediction: 10, // Increased from 5 for better accuracy
  minIncidentsForPattern: 2,
  hoursAheadWindow: 4,
  riskZoneBoost: 30,
  highRiskThreshold: 60,
  moderateRiskThreshold: 30,
  historyDays: 30,
  recencyDecayHalfLife: 7,
  highArousalThreshold: 7,
  personalizedThresholds: DEFAULT_PERSONALIZED_THRESHOLD_CONFIG,
  enableMultiFactorScoring: true,
  energyFactorWeight: 0.2,
  contextFactorWeight: 0.15,
  strategyFailureWeight: 0.15,
  enableLagEffects: true,
  lagEffectDays: 3,
};

/**
 * Configuration for multi-factor pattern analysis
 */
export interface MultiFactorConfig {
  /** Minimum pattern occurrences to report (default: 5) - increased for accuracy */
  minOccurrencesForPattern: number;
  /** Minimum probability to consider pattern significant (default: 0.6 = 60%) */
  minConfidenceThreshold: number;
  /** Statistical significance level for p-value (default: 0.05) */
  significanceLevel: number;
  /** Maximum factors per pattern to prevent combinatorial explosion (default: 4) */
  maxFactorsPerPattern: number;
  /** Energy thresholds for categorization */
  energyThresholds: {
    low: number;  // Below this = low energy (default: 4)
    high: number; // Above this = high energy (default: 7)
  };
  /** Time windows for pattern detection */
  timeWindows: {
    beforeCrisis: number; // Minutes to look back for patterns (default: 60)
    afterStrategy: number; // Minutes to evaluate strategy outcome (default: 30)
  };
  /** Minimum logs required to run analysis (default: 10) */
  minLogsForAnalysis: number;
  /** Enable multiple comparison correction (Benjamini-Hochberg FDR) */
  enableMultipleComparisonCorrection: boolean;
  /** False discovery rate level for FDR correction (default: 0.1) */
  fdrLevel: number;
  /** Enable adaptive quantile-based discretization */
  enableAdaptiveDiscretization: boolean;
  /** Enable interaction effect testing between factors */
  enableInteractionTesting: boolean;
  /** Enable stratified analysis by context (home/school) */
  enableStratifiedAnalysis: boolean;
}

/**
 * Configuration for recovery pattern analysis
 */
export interface RecoveryAnalysisConfig {
  /** Arousal level considered "recovered" - at or below (default: 5) */
  normalArousalThreshold: number;
  /** Energy level considered "recovered" - at or above (default: 5) */
  normalEnergyThreshold: number;
  /** Maximum minutes after crisis to look for recovery (default: 240) */
  maxRecoveryWindow: number;
  /** Minimum crisis events with recovery data for analysis (default: 3) */
  minRecoveryDataPoints: number;
  /** Minutes after crisis to consider vulnerability window (default: 60) */
  vulnerabilityWindowMinutes: number;
  /** Minimum sample size for factor significance (default: 3) */
  minFactorSampleSize: number;
  /** Enable data-driven vulnerability window calculation */
  enableDataDrivenVulnerability: boolean;
  /** Target re-escalation probability for vulnerability window (default: 0.1 = 10%) */
  targetReEscalationProbability: number;
  /** Use personalized recovery thresholds based on child's baseline */
  usePersonalizedRecoveryThresholds: boolean;
  /** Enable Mann-Kendall trend test instead of simple first/second half comparison */
  useStatisticalTrendTest: boolean;
}

/**
 * Configuration for context comparison analysis
 */
export interface ContextComparisonConfig {
  /** Minimum logs in each context for comparison (default: 5) */
  minLogsPerContext: number;
  /** Number of top triggers to return (default: 5) */
  topTriggersLimit: number;
  /** Number of top strategies to return (default: 5) */
  topStrategiesLimit: number;
  /** Minimum percentage difference to flag as significant (default: 20) */
  significantDifferenceThreshold: number;
  /** Minimum sample size for statistical comparison (default: 10) */
  minSampleForStatisticalTest: number;
}

/**
 * Default configuration for multi-factor analysis
 */
export const DEFAULT_MULTI_FACTOR_CONFIG: MultiFactorConfig = {
  minOccurrencesForPattern: 5, // Increased from 3 for better accuracy
  minConfidenceThreshold: 0.6,
  significanceLevel: 0.05,
  maxFactorsPerPattern: 4,
  energyThresholds: {
    low: 4,
    high: 7,
  },
  timeWindows: {
    beforeCrisis: 60,
    afterStrategy: 30,
  },
  minLogsForAnalysis: 10,
  enableMultipleComparisonCorrection: true,
  fdrLevel: 0.1,
  enableAdaptiveDiscretization: true,
  enableInteractionTesting: true,
  enableStratifiedAnalysis: true,
};

/**
 * Default configuration for recovery analysis
 */
export const DEFAULT_RECOVERY_CONFIG: RecoveryAnalysisConfig = {
  normalArousalThreshold: 5,
  normalEnergyThreshold: 5,
  maxRecoveryWindow: 240,
  minRecoveryDataPoints: 3,
  vulnerabilityWindowMinutes: 60,
  minFactorSampleSize: 3,
  enableDataDrivenVulnerability: true,
  targetReEscalationProbability: 0.1,
  usePersonalizedRecoveryThresholds: true,
  useStatisticalTrendTest: true,
};

/**
 * Default configuration for context comparison
 */
export const DEFAULT_CONTEXT_COMPARISON_CONFIG: ContextComparisonConfig = {
  minLogsPerContext: 5,
  topTriggersLimit: 5,
  topStrategiesLimit: 5,
  significantDifferenceThreshold: 20,
  minSampleForStatisticalTest: 10,
};

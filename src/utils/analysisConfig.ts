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
 * Configuration for risk prediction
 */
export interface RiskPredictionConfig {
  /** Minimum samples on same weekday for prediction (default: 5) */
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
 * Default configuration for risk prediction
 */
export const DEFAULT_RISK_CONFIG: RiskPredictionConfig = {
  minSamplesForPrediction: 5,
  minIncidentsForPattern: 2,
  hoursAheadWindow: 4,
  riskZoneBoost: 30,
  highRiskThreshold: 60,
  moderateRiskThreshold: 30,
  historyDays: 30,
  recencyDecayHalfLife: 7,
  highArousalThreshold: 7,
};

/**
 * Statistical Utility Functions
 * Provides proper statistical calculations for analysis accuracy
 */

// ============================================
// CHI-SQUARED DISTRIBUTION
// ============================================

/**
 * Compute chi-squared p-value using the gamma function approximation.
 * More accurate than the simple exponential approximation.
 * Uses the regularized incomplete gamma function for df=1.
 */
export function chiSquaredPValue(chiSquared: number, df: number = 1): number {
    if (chiSquared <= 0) return 1;
    if (df <= 0) return 1;

    // For df=1, use the complementary error function approximation
    if (df === 1) {
        // P-value = 1 - Φ(sqrt(χ²)) where Φ is the normal CDF
        // Approximation using the error function relationship
        const z = Math.sqrt(chiSquared);
        return 2 * (1 - normalCDF(z));
    }

    // For other df, use gamma function approximation
    return 1 - gammaCDF(chiSquared / 2, df / 2);
}

/**
 * Normal distribution CDF using Abramowitz and Stegun approximation
 */
function normalCDF(x: number): number {
    if (x < -8) return 0;
    if (x > 8) return 1;

    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1 + sign * y);
}

/**
 * Gamma CDF using series expansion
 */
function gammaCDF(x: number, a: number): number {
    if (x <= 0) return 0;
    if (a <= 0) return 0;

    // Use series expansion for lower incomplete gamma
    let sum = 0;
    let term = 1 / a;
    sum = term;

    for (let n = 1; n < 100; n++) {
        term *= x / (a + n);
        sum += term;
        if (Math.abs(term) < 1e-10) break;
    }

    const gammaA = gammaFunction(a);
    return (Math.pow(x, a) * Math.exp(-x) * sum) / gammaA;
}

/**
 * Gamma function using Lanczos approximation
 */
function gammaFunction(z: number): number {
    if (z < 0.5) {
        return Math.PI / (Math.sin(Math.PI * z) * gammaFunction(1 - z));
    }

    z -= 1;
    const g = 7;
    const c = [
        0.99999999999980993,
        676.5203681218851,
        -1259.1392167224028,
        771.32342877765313,
        -176.61502916214059,
        12.507343278686905,
        -0.13857109526572012,
        9.9843695780195716e-6,
        1.5056327351493116e-7
    ];

    let x = c[0];
    for (let i = 1; i < g + 2; i++) {
        x += c[i] / (z + i);
    }

    const t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

// ============================================
// MULTIPLE COMPARISON CORRECTION
// ============================================

/**
 * Apply Bonferroni correction to p-values
 * Divides significance level by number of tests
 */
export function bonferroniCorrection(
    pValues: number[],
    significanceLevel: number = 0.05
): { correctedAlpha: number; significant: boolean[] } {
    const numTests = pValues.length;
    const correctedAlpha = significanceLevel / numTests;
    const significant = pValues.map(p => p < correctedAlpha);

    return { correctedAlpha, significant };
}

/**
 * Apply Benjamini-Hochberg FDR correction
 * Controls false discovery rate rather than family-wise error
 */
export function benjaminiHochbergCorrection(
    pValues: number[],
    fdrLevel: number = 0.05
): { adjustedPValues: number[]; significant: boolean[] } {
    const n = pValues.length;

    // Create indexed array and sort by p-value
    const indexed = pValues.map((p, i) => ({ p, originalIndex: i }));
    indexed.sort((a, b) => a.p - b.p);

    // Calculate adjusted p-values
    const adjustedPValues = new Array(n).fill(1);
    let minPSoFar = 1;

    for (let i = n - 1; i >= 0; i--) {
        const rank = i + 1;
        const adjustedP = Math.min(minPSoFar, (indexed[i].p * n) / rank);
        minPSoFar = adjustedP;
        adjustedPValues[indexed[i].originalIndex] = adjustedP;
    }

    // Determine significance
    const significant = adjustedPValues.map(p => p < fdrLevel);

    return { adjustedPValues, significant };
}

// ============================================
// CONFIDENCE INTERVALS
// ============================================

/**
 * Wilson score interval for proportions
 * More accurate than normal approximation for small samples
 */
export function wilsonScoreInterval(
    successes: number,
    total: number,
    confidence: number = 0.95
): { lower: number; upper: number; point: number } {
    if (total === 0) {
        return { lower: 0, upper: 1, point: 0 };
    }

    const z = normalQuantile((1 + confidence) / 2);
    const p = successes / total;
    const n = total;

    const denominator = 1 + (z * z) / n;
    const center = p + (z * z) / (2 * n);
    const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);

    return {
        lower: Math.max(0, (center - margin) / denominator),
        upper: Math.min(1, (center + margin) / denominator),
        point: p
    };
}

/**
 * Bootstrap confidence interval for means
 */
export function bootstrapMeanCI(
    data: number[],
    confidence: number = 0.95,
    iterations: number = 1000
): { lower: number; upper: number; point: number } {
    if (data.length === 0) {
        return { lower: 0, upper: 0, point: 0 };
    }

    if (data.length === 1) {
        return { lower: data[0], upper: data[0], point: data[0] };
    }

    const mean = data.reduce((a, b) => a + b, 0) / data.length;

    // Generate bootstrap samples
    const bootstrapMeans: number[] = [];
    for (let i = 0; i < iterations; i++) {
        const sample: number[] = [];
        for (let j = 0; j < data.length; j++) {
            const idx = Math.floor(Math.random() * data.length);
            sample.push(data[idx]);
        }
        bootstrapMeans.push(sample.reduce((a, b) => a + b, 0) / sample.length);
    }

    // Sort and find percentiles
    bootstrapMeans.sort((a, b) => a - b);
    const alpha = (1 - confidence) / 2;
    const lowerIdx = Math.floor(alpha * iterations);
    const upperIdx = Math.floor((1 - alpha) * iterations);

    return {
        lower: bootstrapMeans[lowerIdx],
        upper: bootstrapMeans[Math.min(upperIdx, iterations - 1)],
        point: mean
    };
}

/**
 * Normal distribution quantile function (inverse CDF)
 */
function normalQuantile(p: number): number {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (p === 0.5) return 0;

    // Rational approximation for central region
    const a = [
        -3.969683028665376e+01,
        2.209460984245205e+02,
        -2.759285104469687e+02,
        1.383577518672690e+02,
        -3.066479806614716e+01,
        2.506628277459239e+00
    ];
    const b = [
        -5.447609879822406e+01,
        1.615858368580409e+02,
        -1.556989798598866e+02,
        6.680131188771972e+01,
        -1.328068155288572e+01
    ];
    const c = [
        -7.784894002430293e-03,
        -3.223964580411365e-01,
        -2.400758277161838e+00,
        -2.549732539343734e+00,
        4.374664141464968e+00,
        2.938163982698783e+00
    ];
    const d = [
        7.784695709041462e-03,
        3.224671290700398e-01,
        2.445134137142996e+00,
        3.754408661907416e+00
    ];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    let q: number, r: number;

    if (p < pLow) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
               ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
        q = p - 0.5;
        r = q * q;
        return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
               (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
        q = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
                ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
}

// ============================================
// QUANTILE-BASED DISCRETIZATION
// ============================================

/**
 * Calculate quantile thresholds for adaptive binning
 */
export function calculateQuantileThresholds(
    values: number[],
    numBins: number = 3
): number[] {
    if (values.length === 0) return [];

    const sorted = [...values].sort((a, b) => a - b);
    const thresholds: number[] = [];

    for (let i = 1; i < numBins; i++) {
        const quantile = i / numBins;
        const index = Math.floor(quantile * sorted.length);
        thresholds.push(sorted[Math.min(index, sorted.length - 1)]);
    }

    return thresholds;
}

/**
 * Assign value to bin based on quantile thresholds
 */
export function assignToBin(
    value: number,
    thresholds: number[]
): number {
    for (let i = 0; i < thresholds.length; i++) {
        if (value < thresholds[i]) return i;
    }
    return thresholds.length;
}

// ============================================
// TREND DETECTION
// ============================================

/**
 * Mann-Kendall trend test
 * Non-parametric test for monotonic trends in time series
 */
export function mannKendallTest(data: number[]): {
    tau: number;
    pValue: number;
    trend: 'increasing' | 'decreasing' | 'no_trend';
} {
    const n = data.length;

    if (n < 4) {
        return { tau: 0, pValue: 1, trend: 'no_trend' };
    }

    // Calculate S statistic
    let s = 0;
    for (let i = 0; i < n - 1; i++) {
        for (let j = i + 1; j < n; j++) {
            const diff = data[j] - data[i];
            if (diff > 0) s++;
            else if (diff < 0) s--;
        }
    }

    // Calculate variance
    const variance = (n * (n - 1) * (2 * n + 5)) / 18;

    // Calculate Z statistic
    let z: number;
    if (s > 0) z = (s - 1) / Math.sqrt(variance);
    else if (s < 0) z = (s + 1) / Math.sqrt(variance);
    else z = 0;

    // Calculate p-value
    const pValue = 2 * (1 - normalCDF(Math.abs(z)));

    // Calculate Kendall's tau
    const tau = (2 * s) / (n * (n - 1));

    // Determine trend direction
    let trend: 'increasing' | 'decreasing' | 'no_trend' = 'no_trend';
    if (pValue < 0.05) {
        trend = tau > 0 ? 'increasing' : 'decreasing';
    }

    return { tau, pValue, trend };
}

// ============================================
// OUTLIER DETECTION
// ============================================

/**
 * Detect outliers using IQR method
 */
export function detectOutliersIQR(
    values: number[],
    multiplier: number = 1.5
): { outliers: number[]; indices: number[]; bounds: { lower: number; upper: number } } {
    if (values.length < 4) {
        return { outliers: [], indices: [], bounds: { lower: -Infinity, upper: Infinity } };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);

    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    const lowerBound = q1 - multiplier * iqr;
    const upperBound = q3 + multiplier * iqr;

    const outliers: number[] = [];
    const indices: number[] = [];

    values.forEach((v, i) => {
        if (v < lowerBound || v > upperBound) {
            outliers.push(v);
            indices.push(i);
        }
    });

    return {
        outliers,
        indices,
        bounds: { lower: lowerBound, upper: upperBound }
    };
}

/**
 * Detect data quality issues in log entries
 */
export interface DataQualityIssue {
    type: 'constant_arousal' | 'invalid_timestamp' | 'missing_context' | 'extreme_duration' | 'suspicious_pattern';
    description: string;
    affectedLogIds: string[];
    severity: 'low' | 'medium' | 'high';
}

export function detectDataQualityIssues(
    logs: Array<{ id: string; timestamp: string; arousal: number; duration: number; context?: string }>
): DataQualityIssue[] {
    const issues: DataQualityIssue[] = [];

    // Check for constant arousal (all same value)
    const arousalValues = logs.map(l => l.arousal);
    const uniqueArousal = new Set(arousalValues);
    if (logs.length >= 10 && uniqueArousal.size === 1) {
        issues.push({
            type: 'constant_arousal',
            description: `All ${logs.length} logs have identical arousal level (${arousalValues[0]}). This may indicate data entry issues.`,
            affectedLogIds: logs.map(l => l.id),
            severity: 'high'
        });
    }

    // Check for invalid timestamps
    const invalidTimestamps = logs.filter(l => {
        const date = new Date(l.timestamp);
        return isNaN(date.getTime());
    });
    if (invalidTimestamps.length > 0) {
        issues.push({
            type: 'invalid_timestamp',
            description: `${invalidTimestamps.length} logs have invalid timestamps.`,
            affectedLogIds: invalidTimestamps.map(l => l.id),
            severity: 'high'
        });
    }

    // Check for missing context
    const missingContext = logs.filter(l => !l.context);
    if (missingContext.length > logs.length * 0.1) {
        issues.push({
            type: 'missing_context',
            description: `${missingContext.length} logs (${Math.round(missingContext.length / logs.length * 100)}%) are missing context.`,
            affectedLogIds: missingContext.map(l => l.id),
            severity: 'medium'
        });
    }

    // Check for extreme durations
    const durations = logs.map(l => l.duration).filter(d => d > 0);
    if (durations.length > 0) {
        const { indices } = detectOutliersIQR(durations, 3);
        if (indices.length > 0) {
            const affectedLogs = indices.map(i => logs[i]);
            issues.push({
                type: 'extreme_duration',
                description: `${indices.length} logs have extreme duration values that may be errors.`,
                affectedLogIds: affectedLogs.map(l => l.id),
                severity: 'low'
            });
        }
    }

    return issues;
}

// ============================================
// EFFECT SIZE CALCULATIONS
// ============================================

/**
 * Calculate Cohen's d effect size
 */
export function cohensD(group1: number[], group2: number[]): number {
    if (group1.length === 0 || group2.length === 0) return 0;

    const mean1 = group1.reduce((a, b) => a + b, 0) / group1.length;
    const mean2 = group2.reduce((a, b) => a + b, 0) / group2.length;

    const var1 = group1.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (group1.length - 1);
    const var2 = group2.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (group2.length - 1);

    // Pooled standard deviation
    const pooledSD = Math.sqrt(
        ((group1.length - 1) * var1 + (group2.length - 1) * var2) /
        (group1.length + group2.length - 2)
    );

    if (pooledSD === 0) return 0;

    return (mean1 - mean2) / pooledSD;
}

/**
 * Interpret Cohen's d effect size
 */
export function interpretEffectSize(d: number): 'negligible' | 'small' | 'medium' | 'large' {
    const absD = Math.abs(d);
    if (absD < 0.2) return 'negligible';
    if (absD < 0.5) return 'small';
    if (absD < 0.8) return 'medium';
    return 'large';
}

// ============================================
// CROSS-VALIDATION
// ============================================

/**
 * Split data for cross-validation
 */
export function trainTestSplit<T>(
    data: T[],
    testRatio: number = 0.2,
    seed?: number
): { train: T[]; test: T[] } {
    const shuffled = [...data];

    // Simple seeded random for reproducibility
    let random = seed !== undefined
        ? () => {
            seed = (seed! * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        }
        : Math.random;

    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const splitIndex = Math.floor(shuffled.length * (1 - testRatio));

    return {
        train: shuffled.slice(0, splitIndex),
        test: shuffled.slice(splitIndex)
    };
}

// ============================================
// CALIBRATION CHECK
// ============================================

/**
 * Check if predicted probabilities are calibrated
 * Returns Brier score and calibration bins
 */
export function calibrationCheck(
    predictions: Array<{ predicted: number; actual: boolean }>
): {
    brierScore: number;
    calibrationBins: Array<{ binCenter: number; predictedMean: number; actualMean: number; count: number }>;
    isCalibrated: boolean;
} {
    if (predictions.length === 0) {
        return { brierScore: 0, calibrationBins: [], isCalibrated: true };
    }

    // Brier score
    const brierScore = predictions.reduce((sum, p) => {
        const actual = p.actual ? 1 : 0;
        return sum + Math.pow(p.predicted - actual, 2);
    }, 0) / predictions.length;

    // Calibration bins (10 bins)
    const numBins = 10;
    const bins: Array<{ predictions: number[]; actuals: boolean[] }> =
        Array.from({ length: numBins }, () => ({ predictions: [], actuals: [] }));

    predictions.forEach(p => {
        const binIndex = Math.min(Math.floor(p.predicted * numBins), numBins - 1);
        bins[binIndex].predictions.push(p.predicted);
        bins[binIndex].actuals.push(p.actual);
    });

    const calibrationBins = bins.map((bin, i) => {
        const count = bin.predictions.length;
        if (count === 0) {
            return { binCenter: (i + 0.5) / numBins, predictedMean: 0, actualMean: 0, count: 0 };
        }

        return {
            binCenter: (i + 0.5) / numBins,
            predictedMean: bin.predictions.reduce((a, b) => a + b, 0) / count,
            actualMean: bin.actuals.filter(a => a).length / count,
            count
        };
    });

    // Check if calibrated (within 10% for bins with enough samples)
    const significantBins = calibrationBins.filter(b => b.count >= 5);
    const maxDeviation = significantBins.reduce((max, b) => {
        return Math.max(max, Math.abs(b.predictedMean - b.actualMean));
    }, 0);

    return {
        brierScore,
        calibrationBins,
        isCalibrated: maxDeviation < 0.1
    };
}

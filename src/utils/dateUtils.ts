/**
 * Date Utility Functions
 * Safe timestamp parsing and validation utilities
 */

/**
 * Safely parse a timestamp and return milliseconds since epoch.
 * Returns null if the timestamp is invalid.
 *
 * @param timestamp - ISO string, Date object, or null/undefined
 * @returns milliseconds since epoch, or null if invalid
 */
export function safeParseTimestamp(timestamp: string | Date | undefined | null): number | null {
    if (!timestamp) return null;

    const date = new Date(timestamp);
    const time = date.getTime();

    // getTime() returns NaN for Invalid Date
    if (Number.isNaN(time)) return null;

    return time;
}

/**
 * Safely parse a timestamp with a fallback value.
 * Use when you need a guaranteed number result.
 *
 * @param timestamp - ISO string, Date object, or null/undefined
 * @param fallback - Value to return if timestamp is invalid (default: 0)
 * @returns milliseconds since epoch, or fallback if invalid
 */
export function safeParseTimestampWithFallback(
    timestamp: string | Date | undefined | null,
    fallback: number = 0
): number {
    return safeParseTimestamp(timestamp) ?? fallback;
}

/**
 * Check if a timestamp string is valid
 *
 * @param timestamp - ISO string to validate
 * @returns true if the timestamp is valid
 */
export function isValidTimestamp(timestamp: string | undefined | null): boolean {
    return safeParseTimestamp(timestamp) !== null;
}

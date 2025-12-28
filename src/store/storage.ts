/**
 * Storage utilities for localStorage with validation and error handling
 */
import { z } from 'zod';

/**
 * Simple debounce utility for storage refresh events
 */
export function debounce<T extends (...args: unknown[]) => void>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Custom event dispatched when localStorage quota is exceeded
 * Can be caught by UI components to show user notifications
 */
export const STORAGE_ERROR_EVENT = 'storage-quota-exceeded';

/**
 * Custom event to trigger data refresh across all providers.
 * Dispatched by refreshData() to reload all contexts from localStorage.
 */
export const STORAGE_REFRESH_EVENT = 'storage-refresh-all';

/**
 * Safely retrieves and parses an item from localStorage with optional Zod validation.
 * For arrays, invalid items are filtered out rather than returning the fallback.
 */
export function getStorageItem<T>(key: string, fallback: T, schema?: z.ZodType<T>): T {
    try {
        const item = localStorage.getItem(key);
        if (!item) return fallback;

        const parsed = JSON.parse(item);

        if (schema) {
            const result = schema.safeParse(parsed);
            if (result.success) {
                return result.data;
            }

            // For arrays, filter out only invalid items
            if (Array.isArray(parsed) && Array.isArray(fallback)) {
                const validItems: unknown[] = [];
                for (const arrayItem of parsed) {
                    try {
                        const singleItemResult = schema.safeParse([arrayItem]);
                        if (singleItemResult.success && Array.isArray(singleItemResult.data) && singleItemResult.data.length === 1) {
                            validItems.push(singleItemResult.data[0]);
                        } else if (import.meta.env.DEV) {
                            console.warn(`[getStorageItem] Invalid item in ${key}:`, arrayItem);
                        }
                    } catch {
                        if (import.meta.env.DEV) {
                            console.warn(`[getStorageItem] Invalid item in ${key}:`, arrayItem);
                        }
                    }
                }

                if (import.meta.env.DEV && validItems.length !== parsed.length) {
                    console.warn(`[getStorageItem] Filtered ${parsed.length - validItems.length} invalid items from ${key}`);
                }
                return validItems as T;
            }

            if (import.meta.env.DEV) {
                console.warn(`[getStorageItem] Invalid data in ${key}, using fallback:`, result.error.issues[0]);
            }
            return fallback;
        }

        return parsed;
    } catch (e) {
        if (import.meta.env.DEV) {
            console.warn(`[getStorageItem] Failed to parse ${key}:`, e);
        }
        return fallback;
    }
}

/**
 * Retrieves a context type string from localStorage
 */
export function getStorageContext(key: string, fallback: 'home' | 'school'): 'home' | 'school' {
    try {
        const item = localStorage.getItem(key);
        if (item === 'home' || item === 'school') {
            return item;
        }
        return fallback;
    } catch {
        return fallback;
    }
}

/**
 * Safely sets an item in localStorage with quota error handling.
 * Dispatches STORAGE_ERROR_EVENT if quota is exceeded.
 * @returns true if successful, false if failed
 */
export function safeSetItem(key: string, value: string): boolean {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        if (error instanceof DOMException &&
            (error.name === 'QuotaExceededError' ||
             error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
            if (import.meta.env.DEV) {
                console.error(`localStorage quota exceeded when saving ${key}`);
            }
            window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, {
                detail: { key, error: 'quota_exceeded' }
            }));
        } else {
            if (import.meta.env.DEV) {
                console.error(`Failed to save ${key} to localStorage:`, error);
            }
            window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, {
                detail: { key, error: 'save_failed' }
            }));
        }
        return false;
    }
}

/**
 * Removes an item from localStorage with error handling
 */
export function safeRemoveItem(key: string): boolean {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`Failed to remove ${key} from localStorage:`, error);
        }
        return false;
    }
}

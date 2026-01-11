/**
 * Storage Service
 * Centralized localStorage operations with error handling and type safety
 */

import type { ZodSchema } from 'zod';
import { STORAGE_KEYS, type StorageKey } from '../constants/storage';

// Re-export for backwards compatibility
export { STORAGE_KEYS, type StorageKey };

interface StorageResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Safely get an item from localStorage with Zod validation
 */
export function getStorageItem<T>(key: StorageKey, schema: ZodSchema<T>): StorageResult<T> {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return { success: true, data: undefined };
        }

        const parsed = JSON.parse(raw);
        const result = schema.safeParse(parsed);

        if (result.success) {
            return { success: true, data: result.data };
        } else {
            if (import.meta.env.DEV) {
                console.warn(`[Storage] Invalid data for key "${key}":`, result.error.issues);
            }
            return { success: false, error: 'Validation failed' };
        }
    } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`[Storage] Error reading key "${key}":`, error);
        }
        return { success: false, error: 'Parse error' };
    }
}

/**
 * Safely set an item in localStorage with quota handling
 */
export function setStorageItem<T>(key: StorageKey, value: T): StorageResult<void> {
    try {
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);
        return { success: true };
    } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            if (import.meta.env.DEV) {
                console.error(`[Storage] Quota exceeded for key "${key}"`);
            }
            return { success: false, error: 'Storage quota exceeded' };
        }
        if (import.meta.env.DEV) {
            console.error(`[Storage] Error writing key "${key}":`, error);
        }
        return { success: false, error: 'Write error' };
    }
}

/**
 * Safely remove an item from localStorage
 */
export function removeStorageItem(key: StorageKey): StorageResult<void> {
    try {
        localStorage.removeItem(key);
        return { success: true };
    } catch (error) {
        if (import.meta.env.DEV) {
            console.error(`[Storage] Error removing key "${key}":`, error);
        }
        return { success: false, error: 'Remove error' };
    }
}

/**
 * Load and validate array data from localStorage, filtering out invalid items
 */
export function loadValidatedArray<T>(
    key: StorageKey,
    schema: ZodSchema<T[]>,
    itemSchema: ZodSchema<T>
): T[] {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        // Try to parse the entire array first
        const fullResult = schema.safeParse(parsed);
        if (fullResult.success) {
            return fullResult.data;
        }

        // If full parse fails, filter valid items individually
        const validItems: T[] = [];
        for (const item of parsed) {
            const itemResult = itemSchema.safeParse(item);
            if (itemResult.success) {
                validItems.push(itemResult.data);
            }
        }

        if (import.meta.env.DEV && validItems.length !== parsed.length) {
            console.warn(
                `[Storage] Filtered ${parsed.length - validItems.length} invalid items from "${key}"`
            );
        }

        return validItems;
    } catch {
        return [];
    }
}

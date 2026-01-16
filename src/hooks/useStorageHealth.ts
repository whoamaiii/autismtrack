/**
 * useStorageHealth Hook
 *
 * Monitors localStorage usage and provides warnings before storage limits are reached.
 * Checks storage health on mount and after each storage change.
 */

import { useState, useEffect, useCallback } from 'react';
import {
    getStorageHealth,
    type StorageHealthStatus,
    type StorageUsage
} from '../utils/storageHealth';
import { STORAGE_ERROR_EVENT } from '../store/storage';

interface UseStorageHealthReturn {
    /** Current storage health status */
    health: StorageHealthStatus;
    /** Current storage usage details */
    usage: StorageUsage;
    /** Force refresh storage measurements */
    refresh: () => void;
    /** Whether user has dismissed the warning this session */
    isDismissed: boolean;
    /** Dismiss the warning for this session */
    dismiss: () => void;
}

// Session key for dismissed state (resets on app restart)
const DISMISSED_SESSION_KEY = 'storage_warning_dismissed';

export const useStorageHealth = (): UseStorageHealthReturn => {
    const [health, setHealth] = useState<StorageHealthStatus>(() => getStorageHealth());
    const [isDismissed, setIsDismissed] = useState<boolean>(() => {
        // Check sessionStorage (not localStorage) so it resets each session
        if (typeof sessionStorage !== 'undefined') {
            return sessionStorage.getItem(DISMISSED_SESSION_KEY) === 'true';
        }
        return false;
    });

    const refresh = useCallback(() => {
        setHealth(getStorageHealth());
    }, []);

    const dismiss = useCallback(() => {
        setIsDismissed(true);
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(DISMISSED_SESSION_KEY, 'true');
        }
    }, []);

    useEffect(() => {
        // Listen for storage quota errors
        const handleStorageError = () => {
            refresh();
            // Reset dismissed state on actual quota error - user needs to see it
            setIsDismissed(false);
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem(DISMISSED_SESSION_KEY);
            }
        };

        // Listen for storage changes (from other tabs)
        const handleStorageChange = (event: StorageEvent) => {
            if (event.key?.startsWith('kreativium_')) {
                refresh();
            }
        };

        window.addEventListener(STORAGE_ERROR_EVENT, handleStorageError);
        window.addEventListener('storage', handleStorageChange);

        // Initial state is set via lazy initialization in useState
        // Periodic check handles updates while app is open
        const intervalId = setInterval(refresh, 30000);

        return () => {
            window.removeEventListener(STORAGE_ERROR_EVENT, handleStorageError);
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(intervalId);
        };
    }, [refresh]);

    return {
        health,
        usage: health.usage,
        refresh,
        isDismissed,
        dismiss
    };
};

export default useStorageHealth;

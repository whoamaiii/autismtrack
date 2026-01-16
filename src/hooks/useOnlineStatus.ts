/**
 * useOnlineStatus Hook
 *
 * Detects and tracks the browser's online/offline status in real-time.
 * Uses the Navigator.onLine API with event listeners for changes.
 *
 * @returns {boolean} isOnline - true when connected, false when offline
 */

import { useState, useEffect } from 'react';

export const useOnlineStatus = (): boolean => {
    // Initialize with current status (SSR-safe with fallback to true)
    const [isOnline, setIsOnline] = useState<boolean>(() => {
        if (typeof navigator !== 'undefined') {
            return navigator.onLine;
        }
        return true; // Assume online during SSR
    });

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        // Listen for online/offline events
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Sync initial state in case it changed before effect ran
        setIsOnline(navigator.onLine);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
};

export default useOnlineStatus;

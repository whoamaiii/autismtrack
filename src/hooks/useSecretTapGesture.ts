import { useState, useRef, useCallback } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isNative } from '../utils/platform';

const DEV_MODE_STORAGE_KEY = 'kreativium_dev_mode_unlocked';
const REQUIRED_TAPS = 7;
const TAP_WINDOW_MS = 3000; // 3 seconds to complete 7 taps

interface UseSecretTapGestureOptions {
    onUnlock?: () => void;
    onTap?: (tapCount: number) => void;
}

interface UseSecretTapGestureReturn {
    tapCount: number;
    isUnlocked: boolean;
    handleTap: () => void;
    resetUnlock: () => void;
}

/**
 * Hook for detecting a secret tap gesture (7 taps within 3 seconds)
 * Used to unlock developer tools in production builds
 */
export const useSecretTapGesture = (options: UseSecretTapGestureOptions = {}): UseSecretTapGestureReturn => {
    const { onUnlock, onTap } = options;

    // Initialize from localStorage
    const [isUnlocked, setIsUnlocked] = useState(() => {
        return localStorage.getItem(DEV_MODE_STORAGE_KEY) === 'true';
    });

    const [tapCount, setTapCount] = useState(0);
    const tapTimestamps = useRef<number[]>([]);
    const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerHapticFeedback = useCallback(async (isSuccess: boolean = false) => {
        if (isNative()) {
            try {
                if (isSuccess) {
                    // Success pattern: two quick pulses
                    await Haptics.impact({ style: ImpactStyle.Heavy });
                    await new Promise(resolve => setTimeout(resolve, 100));
                    await Haptics.impact({ style: ImpactStyle.Heavy });
                } else {
                    // Regular tap feedback
                    await Haptics.impact({ style: ImpactStyle.Light });
                }
            } catch {
                // Haptics not available, fail silently
                if (import.meta.env.DEV) {
                    console.log('[useSecretTapGesture] Haptics not available');
                }
            }
        } else if (navigator.vibrate) {
            // Web fallback
            if (isSuccess) {
                navigator.vibrate([50, 50, 50]);
            } else {
                navigator.vibrate(10);
            }
        }
    }, []);

    const handleTap = useCallback(() => {
        const now = Date.now();

        // Clear any pending reset timeout
        if (resetTimeoutRef.current) {
            clearTimeout(resetTimeoutRef.current);
        }

        // Filter out taps that are too old
        const recentTaps = tapTimestamps.current.filter(
            timestamp => now - timestamp < TAP_WINDOW_MS
        );

        // Add the current tap
        recentTaps.push(now);
        tapTimestamps.current = recentTaps;

        const newTapCount = recentTaps.length;
        setTapCount(newTapCount);

        // Notify about tap
        onTap?.(newTapCount);

        // Provide haptic feedback
        void triggerHapticFeedback(newTapCount >= REQUIRED_TAPS);

        // Check if we've reached the required number of taps
        if (newTapCount >= REQUIRED_TAPS && !isUnlocked) {
            localStorage.setItem(DEV_MODE_STORAGE_KEY, 'true');
            setIsUnlocked(true);
            onUnlock?.();
            // Reset tap count after successful unlock
            tapTimestamps.current = [];
            setTapCount(0);
        }

        // Set timeout to reset tap count after the window expires
        resetTimeoutRef.current = setTimeout(() => {
            tapTimestamps.current = [];
            setTapCount(0);
        }, TAP_WINDOW_MS);
    }, [isUnlocked, onUnlock, onTap, triggerHapticFeedback]);

    const resetUnlock = useCallback(() => {
        localStorage.removeItem(DEV_MODE_STORAGE_KEY);
        setIsUnlocked(false);
        tapTimestamps.current = [];
        setTapCount(0);
    }, []);

    return {
        tapCount,
        isUnlocked,
        handleTap,
        resetUnlock
    };
};

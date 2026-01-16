/**
 * useReducedMotion Hook
 *
 * Detects if the user prefers reduced motion based on their OS settings.
 * Updates when the preference changes.
 *
 * @returns {boolean} true if user prefers reduced motion
 */

import { useState, useEffect } from 'react';

export const useReducedMotion = (): boolean => {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
        // SSR-safe check
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

        const handleChange = (event: MediaQueryListEvent) => {
            setPrefersReducedMotion(event.matches);
        };

        // Initial value is set via lazy initialization in useState
        // Event listener handles any subsequent changes

        // Listen for changes
        mediaQuery.addEventListener('change', handleChange);

        return () => {
            mediaQuery.removeEventListener('change', handleChange);
        };
    }, []);

    return prefersReducedMotion;
};

export default useReducedMotion;

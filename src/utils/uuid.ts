/**
 * UUID generation utility with browser fallback
 * Provides crypto.randomUUID() when available, with a fallback for older browsers
 */

export function generateUUID(): string {
    // Use native crypto.randomUUID() if available (Chrome 92+, Firefox 76+, Safari 15.2+)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Fallback: UUID v4 implementation
    // Uses crypto.getRandomValues() if available, Math.random() as last resort
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        let r: number;

        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const array = new Uint8Array(1);
            crypto.getRandomValues(array);
            r = array[0] % 16;
        } else {
            r = Math.random() * 16 | 0;
        }

        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

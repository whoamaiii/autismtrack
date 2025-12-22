/**
 * Utility functions for AI model handling
 */

/**
 * Extracts the display name from a model ID in "provider/model" format
 * @param modelUsed - The full model ID (e.g., "openai/gpt-4" or "gpt-4")
 * @param fallback - Fallback string if modelUsed is undefined
 * @returns The model name portion (e.g., "gpt-4") or the fallback
 */
export function getModelDisplayName(modelUsed: string | undefined, fallback: string): string {
    if (!modelUsed) return fallback;
    const parts = modelUsed.split('/');
    return parts.length > 1 ? (parts[1] || modelUsed) : modelUsed;
}

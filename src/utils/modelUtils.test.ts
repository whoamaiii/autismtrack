import { describe, it, expect } from 'vitest';
import { getModelDisplayName } from './modelUtils';

describe('getModelDisplayName', () => {
    it('should extract model name from provider/model format', () => {
        expect(getModelDisplayName('openai/gpt-4', 'Default')).toBe('gpt-4');
        expect(getModelDisplayName('google/gemini-2.5-pro', 'Default')).toBe('gemini-2.5-pro');
        expect(getModelDisplayName('x-ai/grok-4', 'Default')).toBe('grok-4');
    });

    it('should return model name as-is when no provider prefix', () => {
        expect(getModelDisplayName('gpt-4', 'Default')).toBe('gpt-4');
        expect(getModelDisplayName('gemini-pro', 'Default')).toBe('gemini-pro');
    });

    it('should return fallback when modelUsed is undefined', () => {
        expect(getModelDisplayName(undefined, 'Default')).toBe('Default');
        expect(getModelDisplayName(undefined, 'Premium')).toBe('Premium');
    });

    it('should return fallback for empty string (falsy)', () => {
        // Empty string is falsy, so returns fallback
        expect(getModelDisplayName('', 'Fallback')).toBe('Fallback');
    });

    it('should only take the second segment when multiple slashes exist', () => {
        // split('/') on 'a/b/c' returns ['a','b','c'], parts[1] = 'b'
        expect(getModelDisplayName('provider/model/version', 'Default')).toBe('model');
    });

    it('should handle edge cases with slashes', () => {
        // '/model' splits to ['', 'model'], parts[1] = 'model'
        expect(getModelDisplayName('/model', 'Default')).toBe('model');
        // 'provider/' splits to ['provider', ''], parts[1] = '' (falsy), so returns modelUsed
        expect(getModelDisplayName('provider/', 'Default')).toBe('provider/');
    });
});

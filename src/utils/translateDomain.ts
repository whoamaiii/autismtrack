import i18n from 'i18next';

/**
 * Translates domain-specific terms (triggers, strategies) to the current language.
 * Falls back to the original value if no translation is found.
 */
export function translateTrigger(trigger: string): string {
    const key = `domain.triggers.${trigger}`;
    const translated = i18n.t(key);
    // If key not found, i18next returns the key itself
    return translated === key ? trigger : translated;
}

export function translateStrategy(strategy: string): string {
    const key = `domain.strategies.${strategy}`;
    const translated = i18n.t(key);
    return translated === key ? strategy : translated;
}

/**
 * Translates an array of triggers/strategies
 */
export function translateTriggers(triggers: string[]): string[] {
    return triggers.map(translateTrigger);
}

export function translateStrategies(strategies: string[]): string[] {
    return strategies.map(translateStrategy);
}

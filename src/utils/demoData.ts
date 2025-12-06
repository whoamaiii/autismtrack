/**
 * Demo Data Generator for Kaggle Competition
 * Creates realistic 3-month behavioral dataset with clear patterns
 * to showcase Gemini 3 Pro's analysis capabilities
 */

import type {
    LogEntry,
    CrisisEvent,
    Goal,
    GoalProgress,
    ChildProfile,
    ContextType,
    SensoryTrigger,
    ContextTrigger,
    Strategy,
    CrisisType,
    CrisisResolution,
    WarningSign,
    GoalCategory
} from '../types';
import { enrichLogEntry, enrichCrisisEvent } from '../types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEMO_CHILD_PROFILE: ChildProfile = {
    id: 'demo-child-1',
    name: 'Oliver',
    age: 8,
    diagnoses: ['autism', 'adhd', 'sensory_processing'],
    communicationStyle: 'verbal',
    sensorySensitivities: ['Auditiv', 'Taktil', 'Visuell'],
    seekingSensory: ['Vestibulær', 'Dypt Trykk'],
    effectiveStrategies: ['Skjerming', 'Hodetelefoner', 'Dypt Trykk', 'Timer/Visuell Støtte'],
    additionalContext: 'Liker dinosaurer og Minecraft. Fungerer best med forutsigbarhet og varsler før overganger.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

// Pattern weights - These create discoverable patterns for AI analysis
const PATTERNS = {
    // Time-based patterns
    morningRisk: 0.3, // Higher arousal in mornings (transition from home)
    afternoonRisk: 0.6, // Peak risk in afternoons (fatigue + demands)
    fridayRisk: 0.4, // Fridays are harder (anticipation of weekend change)

    // Trigger combinations that lead to high arousal
    dangerousCombos: [
        ['Auditiv', 'Krav'],
        ['Overgang', 'Sosialt'],
        ['Sliten', 'Krav'],
        ['Auditiv', 'Trengsel']
    ],

    // Strategy effectiveness (realistic rates)
    strategySuccess: {
        'Skjerming': 0.85,
        'Hodetelefoner': 0.80,
        'Dypt Trykk': 0.75,
        'Timer/Visuell Støtte': 0.70,
        'Samregulering': 0.65,
        'Bevegelse': 0.60,
        'Pusting': 0.40, // Less effective when already dysregulated
        'Fidget': 0.55,
        'Musikk': 0.50,
        'Eget Rom': 0.75,
        'Vektteppe': 0.70,
        'Mørkt Rom': 0.65,
        'Kjent Aktivitet': 0.60
    } as Record<string, number>
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const randomId = (): string => crypto.randomUUID();

const randomInt = (min: number, max: number): number =>
    Math.floor(Math.random() * (max - min + 1)) + min;

const randomFloat = (min: number, max: number): number =>
    Math.random() * (max - min) + min;

const randomChoice = <T>(arr: T[]): T =>
    arr[Math.floor(Math.random() * arr.length)];

const randomChoices = <T>(arr: T[], count: number): T[] => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

const probability = (p: number): boolean => Math.random() < p;

// =============================================================================
// LOG GENERATION
// =============================================================================

const SENSORY_TRIGGERS: SensoryTrigger[] = [
    'Auditiv', 'Visuell', 'Taktil', 'Vestibulær', 'Interosepsjon',
    'Lukt', 'Smak', 'Lys', 'Temperatur', 'Trengsel'
];

const CONTEXT_TRIGGERS: ContextTrigger[] = [
    'Krav', 'Overgang', 'Sosialt', 'Uventet Hendelse', 'Sliten',
    'Sult', 'Ventetid', 'Gruppearbeid', 'Prøve/Test', 'Ny Situasjon'
];

const STRATEGIES: Strategy[] = [
    'Skjerming', 'Dypt Trykk', 'Samregulering', 'Pusting', 'Eget Rom',
    'Vektteppe', 'Hodetelefoner', 'Fidget', 'Bevegelse', 'Mørkt Rom',
    'Kjent Aktivitet', 'Musikk', 'Timer/Visuell Støtte'
];

const WARNING_SIGNS: WarningSign[] = [
    'Økt motorisk uro', 'Verbal eskalering', 'Tilbaketrekning',
    'Repetitive bevegelser', 'Dekker ører', 'Unngår øyekontakt',
    'Rødme/svetting', 'Klamrer seg', 'Nekter instrukser', 'Gråt'
];

function generateLogEntry(date: Date, context: ContextType): LogEntry {
    const hour = date.getHours();
    const dayOfWeek = date.getDay();

    // Base arousal with time-based patterns
    let baseArousal = randomInt(3, 6);

    // Morning transitions (7-9 AM) - higher risk
    if (hour >= 7 && hour <= 9) {
        baseArousal += probability(PATTERNS.morningRisk) ? randomInt(1, 3) : 0;
    }

    // Afternoon fatigue (14-16) - peak risk
    if (hour >= 14 && hour <= 16) {
        baseArousal += probability(PATTERNS.afternoonRisk) ? randomInt(2, 4) : 0;
    }

    // Friday effect
    if (dayOfWeek === 5) {
        baseArousal += probability(PATTERNS.fridayRisk) ? randomInt(1, 2) : 0;
    }

    // Cap arousal
    const arousal = Math.min(10, Math.max(1, baseArousal));

    // Energy inversely related to arousal + time of day effect
    let energy = 10 - arousal + randomInt(-2, 2);
    if (hour >= 14) energy -= randomInt(1, 2); // Afternoon energy dip
    energy = Math.min(10, Math.max(1, energy));

    // Valence based on arousal
    const valence = arousal > 7 ? randomInt(1, 4) : arousal > 5 ? randomInt(3, 6) : randomInt(5, 9);

    // Generate triggers based on arousal level
    const numSensoryTriggers = arousal > 7 ? randomInt(2, 3) : arousal > 5 ? randomInt(1, 2) : randomInt(0, 1);
    const numContextTriggers = arousal > 7 ? randomInt(2, 3) : arousal > 5 ? randomInt(1, 2) : randomInt(0, 1);

    // Bias towards known sensitivities
    let sensoryTriggers = randomChoices(SENSORY_TRIGGERS, numSensoryTriggers);
    if (arousal > 6 && probability(0.7)) {
        // Include known sensitivities
        const knownSensitivities = DEMO_CHILD_PROFILE.sensorySensitivities as SensoryTrigger[];
        sensoryTriggers = [...new Set([...sensoryTriggers, randomChoice(knownSensitivities)])];
    }

    const contextTriggers = randomChoices(CONTEXT_TRIGGERS, numContextTriggers);

    // Check for dangerous combinations
    const hasDangerousCombo = PATTERNS.dangerousCombos.some(combo => {
        const allTriggers = [...sensoryTriggers, ...contextTriggers];
        return combo.every(t => allTriggers.includes(t as SensoryTrigger | ContextTrigger));
    });

    // If dangerous combo, increase arousal
    const finalArousal = hasDangerousCombo ? Math.min(10, arousal + randomInt(1, 2)) : arousal;

    // Generate strategies
    const numStrategies = finalArousal > 6 ? randomInt(1, 3) : randomInt(0, 2);

    // Bias towards known effective strategies
    let strategies = randomChoices(STRATEGIES, numStrategies);
    if (finalArousal > 5 && probability(0.6)) {
        const knownEffective = DEMO_CHILD_PROFILE.effectiveStrategies as Strategy[];
        strategies = [...new Set([...strategies, randomChoice(knownEffective)])];
    }

    // Determine strategy effectiveness
    let strategyEffectiveness: 'helped' | 'no_change' | 'escalated' | undefined;
    if (strategies.length > 0) {
        // Calculate based on strategy success rates
        const avgSuccessRate = strategies.reduce((sum, s) =>
            sum + (PATTERNS.strategySuccess[s] || 0.5), 0) / strategies.length;

        // But if arousal is very high, strategies are less effective
        const effectiveRate = finalArousal > 8 ? avgSuccessRate * 0.5 : avgSuccessRate;

        if (probability(effectiveRate)) {
            strategyEffectiveness = 'helped';
        } else if (probability(0.2)) {
            strategyEffectiveness = 'escalated';
        } else {
            strategyEffectiveness = 'no_change';
        }
    }

    // Generate contextual notes
    const notes = generateNote(finalArousal, sensoryTriggers, contextTriggers, context, hour);

    const baseLog: Omit<LogEntry, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'> = {
        id: randomId(),
        timestamp: date.toISOString(),
        context,
        arousal: finalArousal,
        valence,
        energy,
        sensoryTriggers,
        contextTriggers,
        strategies,
        strategyEffectiveness,
        duration: randomInt(15, 120),
        note: notes
    };

    return enrichLogEntry(baseLog);
}

function generateNote(
    arousal: number,
    sensoryTriggers: string[],
    contextTriggers: string[],
    context: ContextType,
    hour: number
): string {
    const notes: string[] = [];

    if (arousal > 7) {
        notes.push(randomChoice([
            'Vanskelig episode',
            'Trengte mye støtte',
            'Utfordrende situasjon',
            'Høyt stressnivå observert'
        ]));
    } else if (arousal < 4) {
        notes.push(randomChoice([
            'Rolig og avslappet',
            'God dag så langt',
            'Mestret situasjonen fint',
            'Positiv stemning'
        ]));
    }

    if (sensoryTriggers.includes('Auditiv')) {
        notes.push(randomChoice([
            'Mye støy i rommet',
            'Reagerte på høye lyder',
            'Dekket ørene flere ganger'
        ]));
    }

    if (contextTriggers.includes('Overgang')) {
        notes.push(randomChoice([
            'Vanskelig overgang mellom aktiviteter',
            'Trengte ekstra tid på overgangen',
            'Protesterte ved bytte av aktivitet'
        ]));
    }

    if (contextTriggers.includes('Sosialt') && context === 'school') {
        notes.push(randomChoice([
            'Gruppearbeid var krevende',
            'Konflikter med medelever',
            'Ville helst jobbe alene'
        ]));
    }

    if (hour >= 14 && hour <= 16) {
        notes.push(randomChoice([
            'Tydelig sliten etter lang dag',
            'Energien begynte å synke',
            'Trenger pause'
        ]));
    }

    return notes.join('. ') || '';
}

// =============================================================================
// CRISIS EVENT GENERATION
// =============================================================================

function generateCrisisEvent(date: Date, context: ContextType, precedingLog?: LogEntry): CrisisEvent {
    // Weight towards sensory_overload and meltdown based on profile
    const type: CrisisType = probability(0.4) ? 'sensory_overload' :
        probability(0.3) ? 'meltdown' :
            probability(0.2) ? 'shutdown' : 'anxiety';

    const durationSeconds = type === 'meltdown' ? randomInt(300, 1800) :
        type === 'shutdown' ? randomInt(600, 2400) :
            type === 'anxiety' ? randomInt(180, 900) : randomInt(120, 600);

    const peakIntensity = randomInt(7, 10);

    // Warning signs - more likely to include motor restlessness
    const numWarningSigns = randomInt(2, 4);
    let warningSigns: WarningSign[] = randomChoices(WARNING_SIGNS, numWarningSigns);
    if (probability(0.8) && !warningSigns.includes('Økt motorisk uro')) {
        warningSigns = ['Økt motorisk uro' as WarningSign, ...warningSigns];
    }

    // Triggers leading to crisis
    const sensoryTriggers = randomChoices(SENSORY_TRIGGERS, randomInt(1, 3));
    const contextTriggers = randomChoices(CONTEXT_TRIGGERS, randomInt(1, 2));

    // Strategies used during crisis
    const strategiesUsed = randomChoices(STRATEGIES, randomInt(2, 4));

    // Resolution
    const resolutions: CrisisResolution[] = ['self_regulated', 'co_regulated', 'timed_out'];
    const resolution = randomChoice(resolutions);

    const recoveryTimeMinutes = resolution === 'self_regulated' ? randomInt(10, 30) :
        resolution === 'co_regulated' ? randomInt(15, 45) : randomInt(30, 90);

    const baseCrisis: Omit<CrisisEvent, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'> = {
        id: randomId(),
        timestamp: date.toISOString(),
        context,
        type,
        durationSeconds,
        peakIntensity,
        precedingArousal: precedingLog?.arousal || randomInt(7, 9),
        precedingEnergy: precedingLog?.energy || randomInt(2, 4),
        warningSignsObserved: warningSigns,
        sensoryTriggers,
        contextTriggers,
        strategiesUsed,
        resolution,
        hasAudioRecording: probability(0.2),
        notes: generateCrisisNote(type, context),
        recoveryTimeMinutes
    };

    return enrichCrisisEvent(baseCrisis);
}

function generateCrisisNote(type: CrisisType, context: ContextType): string {
    const typeNotes: Record<CrisisType, string[]> = {
        'meltdown': [
            'Full nedsmelting etter akkumulert stress',
            'Mistet kontrollen etter mange krav',
            'Trengte å rydde rommet for andre'
        ],
        'shutdown': [
            'Stoppet helt opp, responderte ikke',
            'Trakk seg inn i seg selv',
            'Nektet all kontakt en periode'
        ],
        'anxiety': [
            'Sterk angstreaksjon',
            'Hyperventilerte og gråt',
            'Klamret seg til voksen'
        ],
        'sensory_overload': [
            'For mye stimuli på en gang',
            'Dekket ører og øyne',
            'Flyktet fra situasjonen'
        ],
        'other': ['Utfordrende episode']
    };

    const contextNote = context === 'school' ?
        ' Skjedde i skoletiden.' : ' Skjedde hjemme.';

    return randomChoice(typeNotes[type]) + contextNote;
}

// =============================================================================
// GOAL GENERATION
// =============================================================================

function generateGoals(startDate: Date): Goal[] {
    const goals: Goal[] = [
        {
            id: randomId(),
            title: 'Redusere nedsmeltinger',
            description: 'Mål om færre nedsmeltinger per uke gjennom proaktive strategier',
            category: 'regulation' as GoalCategory,
            targetValue: 1,
            targetUnit: 'per uke',
            targetDirection: 'decrease',
            startDate: startDate.toISOString(),
            targetDate: new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            currentValue: 2,
            status: 'in_progress',
            progressHistory: generateProgressHistory(startDate, 4, 1, 'decrease'),
            notes: 'Fokus på tidlig intervensjon og forvarsler'
        },
        {
            id: randomId(),
            title: 'Øke selvregulering',
            description: 'Kunne bruke pusteteknikker selvstendig når arousal øker',
            category: 'regulation' as GoalCategory,
            targetValue: 80,
            targetUnit: 'prosent',
            targetDirection: 'increase',
            startDate: startDate.toISOString(),
            targetDate: new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            currentValue: 45,
            status: 'in_progress',
            progressHistory: generateProgressHistory(startDate, 20, 80, 'increase'),
            notes: 'Trener daglig på pusteøvelser'
        },
        {
            id: randomId(),
            title: 'Tåle overganger bedre',
            description: 'Gjennomføre overganger mellom aktiviteter med færre protester',
            category: 'independence' as GoalCategory,
            targetValue: 8,
            targetUnit: 'av 10 overganger',
            targetDirection: 'increase',
            startDate: startDate.toISOString(),
            targetDate: new Date(startDate.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            currentValue: 5,
            status: 'in_progress',
            progressHistory: generateProgressHistory(startDate, 3, 8, 'increase'),
            notes: 'Bruker timer og visuell støtte'
        },
        {
            id: randomId(),
            title: 'Delta i gruppearbeid',
            description: 'Kunne delta i gruppearbeid i minst 15 minutter',
            category: 'social' as GoalCategory,
            targetValue: 15,
            targetUnit: 'minutter',
            targetDirection: 'increase',
            startDate: startDate.toISOString(),
            targetDate: new Date(startDate.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString(),
            currentValue: 8,
            status: 'at_risk',
            progressHistory: generateProgressHistory(startDate, 5, 15, 'increase'),
            notes: 'Utfordrende mål, trenger mer støtte'
        }
    ];

    return goals;
}

function generateProgressHistory(
    startDate: Date,
    startValue: number,
    targetValue: number,
    direction: 'increase' | 'decrease'
): GoalProgress[] {
    const history: GoalProgress[] = [];
    const numEntries = randomInt(8, 15);
    const daySpan = 90;

    let currentValue = startValue;

    for (let i = 0; i < numEntries; i++) {
        const daysOffset = Math.floor((i / numEntries) * daySpan);
        const progressDate = new Date(startDate.getTime() + daysOffset * 24 * 60 * 60 * 1000);

        // Progress with some variation (not always improving)
        if (direction === 'increase') {
            currentValue += randomFloat(-0.5, 2);
            currentValue = Math.min(targetValue * 0.9, Math.max(startValue * 0.8, currentValue));
        } else {
            currentValue -= randomFloat(-0.3, 0.8);
            currentValue = Math.max(targetValue * 1.2, Math.min(startValue * 1.1, currentValue));
        }

        history.push({
            id: randomId(),
            goalId: '',
            date: progressDate.toISOString(),
            value: Math.round(currentValue * 10) / 10,
            context: randomChoice(['home', 'school'] as ContextType[]),
            notes: probability(0.3) ? randomChoice([
                'God fremgang denne uken',
                'Litt tilbakegang etter ferie',
                'Stabil utvikling',
                'Trengte ekstra støtte'
            ]) : undefined
        });
    }

    return history;
}

// =============================================================================
// MAIN GENERATION FUNCTION
// =============================================================================

export interface DemoData {
    logs: LogEntry[];
    crisisEvents: CrisisEvent[];
    goals: Goal[];
    childProfile: ChildProfile;
}

export function generateDemoData(daysBack: number = 90): DemoData {
    const logs: LogEntry[] = [];
    const crisisEvents: CrisisEvent[] = [];

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Generate logs for each day
    for (let d = 0; d < daysBack; d++) {
        const currentDate = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
        const dayOfWeek = currentDate.getDay();

        // Skip some weekends (less logging)
        if ((dayOfWeek === 0 || dayOfWeek === 6) && probability(0.4)) {
            continue;
        }

        // Generate 2-4 logs per day
        const logsPerDay = randomInt(2, 4);
        const times = [
            [7, 9],   // Morning
            [10, 12], // Mid-morning
            [13, 15], // Early afternoon
            [16, 18]  // Late afternoon
        ];

        const dayLogs: LogEntry[] = [];

        for (let i = 0; i < logsPerDay; i++) {
            const [minHour, maxHour] = times[i] || [8, 18];
            const hour = randomInt(minHour, maxHour);
            const logDate = new Date(currentDate);
            logDate.setHours(hour, randomInt(0, 59), 0, 0);

            const context: ContextType = hour >= 8 && hour <= 15 && dayOfWeek >= 1 && dayOfWeek <= 5
                ? 'school' : 'home';

            const log = generateLogEntry(logDate, context);
            dayLogs.push(log);

            // Chance of crisis event if arousal is high
            if (log.arousal >= 8 && probability(0.25)) {
                const crisisDate = new Date(logDate.getTime() + randomInt(5, 30) * 60 * 1000);
                const crisis = generateCrisisEvent(crisisDate, context, log);
                crisisEvents.push(crisis);
            }
        }

        logs.push(...dayLogs);
    }

    // Sort by timestamp
    logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    crisisEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Generate goals
    const goals = generateGoals(startDate);

    return {
        logs,
        crisisEvents,
        goals,
        childProfile: DEMO_CHILD_PROFILE
    };
}

/**
 * Loads demo data into localStorage
 */
export function loadDemoData(): DemoData {
    const data = generateDemoData(90);

    // Save to localStorage using the same keys as the app
    localStorage.setItem('kreativium_logs', JSON.stringify(data.logs));
    localStorage.setItem('kreativium_crisis_events', JSON.stringify(data.crisisEvents));
    localStorage.setItem('kreativium_goals', JSON.stringify(data.goals));
    localStorage.setItem('kreativium_child_profile', JSON.stringify(data.childProfile));
    localStorage.setItem('kreativium_onboarding_completed', 'true');

    console.log(`[Demo Data] Loaded ${data.logs.length} logs, ${data.crisisEvents.length} crisis events, ${data.goals.length} goals`);

    return data;
}

/**
 * Clears demo data from localStorage
 */
export function clearDemoData(): void {
    localStorage.removeItem('kreativium_logs');
    localStorage.removeItem('kreativium_crisis_events');
    localStorage.removeItem('kreativium_goals');
    localStorage.removeItem('kreativium_child_profile');
    localStorage.removeItem('kreativium_onboarding_completed');
    localStorage.removeItem('kreativium_schedule_entries');
    localStorage.removeItem('kreativium_schedule_templates');
    localStorage.removeItem('kreativium_current_context');

    console.log('[Demo Data] Cleared all demo data');
}

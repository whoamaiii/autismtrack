/**
 * Mock Data Generator for NeuroLogg Pro
 * Generates realistic behavioral data for a neurodivergent child over 2 weeks
 *
 * Patterns modeled:
 * - Higher arousal in afternoons (sensory fatigue)
 * - Lower energy as week progresses
 * - Auditory triggers more impactful when tired
 * - Transitions are consistently challenging
 * - Weekends show better regulation (less demands)
 * - Crisis events correlate with low energy + high demands
 */

import type { LogEntry, CrisisEvent, ScheduleEntry } from '../types';
import { enrichLogEntry, enrichCrisisEvent } from '../types';
import { STORAGE_KEYS } from '../constants/storage';

// Weighted random selection
const weightedRandom = <T>(items: T[], weights: number[]): T => {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    for (let i = 0; i < items.length; i++) {
        random -= weights[i];
        if (random <= 0) return items[i];
    }
    return items[items.length - 1];
};

// Random number in range
const randomInRange = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Pick random items from array
const pickRandom = <T>(items: T[], count: number): T[] => {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
};

// Sensory triggers with weights (higher = more common for this profile)
const SENSORY_TRIGGERS = [
    { trigger: 'Auditiv', weight: 8 },      // Primary sensitivity
    { trigger: 'Visuell', weight: 4 },
    { trigger: 'Taktil', weight: 5 },
    { trigger: 'Vestibulær', weight: 2 },
    { trigger: 'Interosepsjon', weight: 6 }, // Often misses hunger/tiredness cues
    { trigger: 'Lys', weight: 5 },
    { trigger: 'Trengsel', weight: 7 },      // Crowded spaces difficult
    { trigger: 'Temperatur', weight: 2 },
];

const CONTEXT_TRIGGERS = [
    { trigger: 'Overgang', weight: 9 },      // Transitions very challenging
    { trigger: 'Krav', weight: 7 },
    { trigger: 'Sosialt', weight: 5 },
    { trigger: 'Uventet Hendelse', weight: 8 },
    { trigger: 'Sliten', weight: 6 },
    { trigger: 'Sult', weight: 4 },
    { trigger: 'Ventetid', weight: 6 },
    { trigger: 'Gruppearbeid', weight: 5 },
    { trigger: 'Prøve/Test', weight: 4 },
    { trigger: 'Ny Situasjon', weight: 7 },
];

const STRATEGIES = [
    { strategy: 'Hodetelefoner', weight: 9, effectiveness: 0.8 },
    { strategy: 'Skjerming', weight: 8, effectiveness: 0.75 },
    { strategy: 'Dypt Trykk', weight: 6, effectiveness: 0.85 },
    { strategy: 'Eget Rom', weight: 7, effectiveness: 0.7 },
    { strategy: 'Timer/Visuell Støtte', weight: 8, effectiveness: 0.65 },
    { strategy: 'Samregulering', weight: 5, effectiveness: 0.6 },
    { strategy: 'Pusting', weight: 4, effectiveness: 0.4 },
    { strategy: 'Fidget', weight: 6, effectiveness: 0.5 },
    { strategy: 'Bevegelse', weight: 5, effectiveness: 0.7 },
    { strategy: 'Musikk', weight: 4, effectiveness: 0.6 },
];

const WARNING_SIGNS = [
    'Økt motorisk uro',
    'Verbal eskalering',
    'Tilbaketrekning',
    'Repetitive bevegelser',
    'Dekker ører',
    'Unngår øyekontakt',
    'Rødme/svetting',
    'Nekter instrukser',
];

const NOTES_SCHOOL = [
    'Vanskelig overgang fra friminutt til undervisning.',
    'Reagerte på høy lyd i kantinen.',
    'Klarte gruppearbeid bedre enn forventet med hodetelefoner.',
    'Sliten etter lang skoledag.',
    'Uventet vikar utløste uro.',
    'God morgen, men eskalerte etter lunsj.',
    'Trengte pause midt i mattetimen.',
    'Mestret ny rutine med visuell støtte.',
    'Følte seg overveldet i gymtimen.',
    'Rolig dag med forutsigbar timeplan.',
    'Reagerte på parfyme fra medelev.',
    'Vanskelig å komme i gang etter helgen.',
    'Ventetid før SFO var utfordrende.',
    'Klarte seg bra i liten gruppe.',
];

const NOTES_HOME = [
    'Trenger lang tid å lande etter skolen.',
    'Rolig ettermiddag med skjermtid.',
    'Utbrudd før leggetid, sliten.',
    'God kveld med forutsigbare rutiner.',
    'Reagerte på endring i middagsplaner.',
    'Trengte mye dypt trykk i kveld.',
    'Vanskelig overgang fra spilling til middag.',
    'Sovnet sent, mye tanker.',
    'Fin helgemorgen, lavt tempo.',
    'Sosial aktivitet tappet energi.',
    'Klarte tannpuss uten protest.',
    'Behov for alenetid før middag.',
    'Reagerte på støy fra nabolaget.',
    'Avslappet dag hjemme.',
];

/**
 * Generate log entries for the past N days
 */
export const generateMockLogs = (days: number = 14): LogEntry[] => {
    const logs: LogEntry[] = [];
    const now = new Date();

    for (let dayOffset = days - 1; dayOffset >= 0; dayOffset--) {
        const date = new Date(now);
        date.setDate(date.getDate() - dayOffset);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dayInWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // 1-7 where 7 is Sunday

        // Energy decreases through the week (school fatigue)
        const baseEnergy = isWeekend ? randomInRange(6, 9) : Math.max(3, 8 - Math.floor(dayInWeek / 2));

        // Generate 2-4 logs per day
        const logsPerDay = isWeekend ? randomInRange(1, 3) : randomInRange(2, 4);

        const timeSlots = isWeekend
            ? [
                { hour: randomInRange(9, 11), context: 'home' as const },
                { hour: randomInRange(14, 16), context: 'home' as const },
                { hour: randomInRange(18, 20), context: 'home' as const },
            ]
            : [
                { hour: randomInRange(8, 9), context: 'school' as const },
                { hour: randomInRange(11, 12), context: 'school' as const },
                { hour: randomInRange(14, 15), context: 'school' as const },
                { hour: randomInRange(17, 19), context: 'home' as const },
            ];

        const selectedSlots = timeSlots.slice(0, logsPerDay);

        selectedSlots.forEach((slot, slotIndex) => {
            const timestamp = new Date(date);
            timestamp.setHours(slot.hour, randomInRange(0, 59), 0, 0);

            // Arousal patterns:
            // - Higher in afternoon (sensory fatigue)
            // - Lower on weekends
            // - Higher when energy is low
            const isAfternoon = slot.hour >= 13 && slot.hour <= 16;
            const energyForSlot = Math.max(1, baseEnergy - slotIndex);

            let arousalBase = isWeekend ? randomInRange(2, 5) : randomInRange(3, 6);
            if (isAfternoon && !isWeekend) arousalBase += randomInRange(1, 3);
            if (energyForSlot <= 3) arousalBase += randomInRange(1, 2);
            const arousal = Math.min(10, Math.max(1, arousalBase));

            // Valence inversely correlated with arousal
            const valence = Math.min(10, Math.max(1, 11 - arousal + randomInRange(-1, 1)));

            // Select triggers based on context and arousal
            const numSensoryTriggers = arousal > 6 ? randomInRange(1, 3) : randomInRange(0, 2);
            const numContextTriggers = arousal > 5 ? randomInRange(1, 2) : randomInRange(0, 1);

            const sensoryTriggers = pickRandom(
                SENSORY_TRIGGERS.map(t => t.trigger),
                numSensoryTriggers
            );

            const contextTriggers = pickRandom(
                CONTEXT_TRIGGERS.map(t => t.trigger),
                numContextTriggers
            );

            // Select strategies
            const numStrategies = arousal > 5 ? randomInRange(1, 3) : randomInRange(0, 2);
            const selectedStrategies = pickRandom(
                STRATEGIES.map(s => s.strategy),
                numStrategies
            );

            // Determine effectiveness
            let effectiveness: 'helped' | 'no_change' | 'escalated' | undefined;
            if (selectedStrategies.length > 0) {
                const rand = Math.random();
                if (rand < 0.6) effectiveness = 'helped';
                else if (rand < 0.85) effectiveness = 'no_change';
                else effectiveness = 'escalated';
            }

            // Select note
            const notes = slot.context === 'school' ? NOTES_SCHOOL : NOTES_HOME;
            const note = notes[randomInRange(0, notes.length - 1)];

            const log: Omit<LogEntry, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'> = {
                id: crypto.randomUUID(),
                timestamp: timestamp.toISOString(),
                context: slot.context,
                arousal,
                valence,
                energy: energyForSlot,
                sensoryTriggers,
                contextTriggers,
                strategies: selectedStrategies,
                strategyEffectiveness: effectiveness,
                duration: randomInRange(15, 120),
                note,
            };

            logs.push(enrichLogEntry(log));
        });
    }

    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

/**
 * Generate crisis events (meltdowns, shutdowns, etc.)
 */
export const generateMockCrisisEvents = (days: number = 14): CrisisEvent[] => {
    const events: CrisisEvent[] = [];
    const now = new Date();

    // Generate 2-4 crisis events over the period (realistic for managed neurodivergence)
    const numEvents = randomInRange(2, 4);
    const eventDays = pickRandom(
        Array.from({ length: days }, (_, i) => i),
        numEvents
    ).sort((a, b) => b - a);

    eventDays.forEach(dayOffset => {
        const date = new Date(now);
        date.setDate(date.getDate() - dayOffset);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Crisis events more likely at school or during transitions
        const hour = isWeekend
            ? randomInRange(16, 20) // Evenings on weekends
            : randomInRange(13, 16); // Afternoon at school

        const timestamp = new Date(date);
        timestamp.setHours(hour, randomInRange(0, 59), 0, 0);

        const crisisTypes: Array<'meltdown' | 'shutdown' | 'anxiety' | 'sensory_overload'> = [
            'meltdown', 'shutdown', 'anxiety', 'sensory_overload'
        ];
        const type = weightedRandom(crisisTypes, [3, 2, 2, 3]);

        const event: Omit<CrisisEvent, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'> = {
            id: crypto.randomUUID(),
            timestamp: timestamp.toISOString(),
            context: isWeekend ? 'home' : weightedRandom(['school', 'home'] as const, [7, 3]),
            type,
            durationSeconds: type === 'meltdown'
                ? randomInRange(300, 1200) // 5-20 min
                : type === 'shutdown'
                    ? randomInRange(600, 2400) // 10-40 min
                    : randomInRange(180, 600), // 3-10 min
            peakIntensity: randomInRange(7, 10),
            precedingArousal: randomInRange(6, 9),
            precedingEnergy: randomInRange(1, 4), // Low energy usually precedes crisis
            warningSignsObserved: pickRandom(WARNING_SIGNS, randomInRange(2, 4)),
            sensoryTriggers: pickRandom(
                SENSORY_TRIGGERS.map(t => t.trigger),
                randomInRange(1, 3)
            ),
            contextTriggers: pickRandom(
                CONTEXT_TRIGGERS.map(t => t.trigger),
                randomInRange(1, 2)
            ),
            strategiesUsed: pickRandom(
                STRATEGIES.map(s => s.strategy),
                randomInRange(2, 4)
            ),
            resolution: weightedRandom(
                ['co_regulated', 'self_regulated', 'timed_out'] as const,
                [5, 3, 2]
            ),
            hasAudioRecording: false,
            notes: type === 'meltdown'
                ? 'Full nedsmelting etter akkumulert stress. Trengte samregulering og rolig rom.'
                : type === 'shutdown'
                    ? 'Trakk seg helt inn. Satt stille i 30+ minutter. Ikke responsiv på kontakt.'
                    : type === 'anxiety'
                        ? 'Panikklignende reaksjon. Rask pust, klamret seg. Pusteøvelser hjalp noe.'
                        : 'Overveldet av sanseinntrykk. Dekket ører og lukket øynene.',
            recoveryTimeMinutes: type === 'shutdown'
                ? randomInRange(45, 90)
                : randomInRange(15, 45),
        };

        events.push(enrichCrisisEvent(event));
    });

    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

/**
 * Generate schedule entries for testing
 */
export const generateMockSchedule = (days: number = 7): ScheduleEntry[] => {
    const entries: ScheduleEntry[] = [];
    const now = new Date();

    const schoolActivities = [
        { title: 'Skolestart', icon: '🏫', duration: 30 },
        { title: 'Norsk', icon: '📖', duration: 45 },
        { title: 'Matte', icon: '🔢', duration: 45 },
        { title: 'Friminutt', icon: '🌳', duration: 20 },
        { title: 'Kunst', icon: '🎨', duration: 45 },
        { title: 'Gym', icon: '⚽', duration: 45 },
        { title: 'Lunsj', icon: '🍎', duration: 30 },
        { title: 'SFO', icon: '🎮', duration: 120 },
    ];

    const homeActivities = [
        { title: 'Frokost', icon: '🥣', duration: 30 },
        { title: 'Rolig tid', icon: '😌', duration: 60 },
        { title: 'Lekser', icon: '📝', duration: 30 },
        { title: 'Middag', icon: '🍽️', duration: 30 },
        { title: 'Skjermtid', icon: '📱', duration: 60 },
        { title: 'Kveldsrutine', icon: '🛁', duration: 45 },
        { title: 'Leggetid', icon: '😴', duration: 30 },
    ];

    for (let dayOffset = days - 1; dayOffset >= 0; dayOffset--) {
        const date = new Date(now);
        date.setDate(date.getDate() - dayOffset);
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const activities = isWeekend
            ? pickRandom(homeActivities, randomInRange(4, 6))
            : [...pickRandom(schoolActivities, 5), ...pickRandom(homeActivities, 3)];

        let currentHour = isWeekend ? 9 : 8;
        let currentMinute = 0;

        activities.forEach(activity => {
            const startTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
            currentMinute += activity.duration;
            if (currentMinute >= 60) {
                currentHour += Math.floor(currentMinute / 60);
                currentMinute = currentMinute % 60;
            }
            const endTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

            // Past entries are completed, future/current based on time
            const isPast = dayOffset > 0;
            const status = isPast
                ? weightedRandom(['completed', 'completed', 'skipped'] as const, [8, 8, 1])
                : 'upcoming';

            entries.push({
                id: crypto.randomUUID(),
                date: dateStr,
                context: isWeekend ? 'home' : (currentHour < 15 ? 'school' : 'home'),
                activity: {
                    id: crypto.randomUUID(),
                    title: activity.title,
                    icon: activity.icon,
                    scheduledStart: startTime,
                    scheduledEnd: endTime,
                    durationMinutes: activity.duration,
                },
                status,
                transitionDifficulty: activity.title.includes('Friminutt') || activity.title.includes('Gym')
                    ? randomInRange(5, 8)
                    : randomInRange(2, 5),
            });

            // Add small gap between activities
            currentMinute += randomInRange(5, 15);
            if (currentMinute >= 60) {
                currentHour += 1;
                currentMinute = currentMinute % 60;
            }
        });
    }

    return entries;
};

/**
 * Load mock data into localStorage
 */
export const loadMockData = () => {
    const logs = generateMockLogs(14);
    const crisisEvents = generateMockCrisisEvents(14);
    const scheduleEntries = generateMockSchedule(7);

    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
    localStorage.setItem(STORAGE_KEYS.CRISIS_EVENTS, JSON.stringify(crisisEvents));
    localStorage.setItem(STORAGE_KEYS.SCHEDULE_ENTRIES, JSON.stringify(scheduleEntries));

    if (import.meta.env.DEV) {
        console.log(`Loaded mock data:
- ${logs.length} log entries
- ${crisisEvents.length} crisis events
- ${scheduleEntries.length} schedule entries`);
    }

    // Return summary
    return {
        logs: logs.length,
        crisisEvents: crisisEvents.length,
        scheduleEntries: scheduleEntries.length,
    };
};

/**
 * Clear all mock data
 */
export const clearMockData = () => {
    localStorage.removeItem(STORAGE_KEYS.LOGS);
    localStorage.removeItem(STORAGE_KEYS.CRISIS_EVENTS);
    localStorage.removeItem(STORAGE_KEYS.SCHEDULE_ENTRIES);
    if (import.meta.env.DEV) {
        console.log('Cleared all mock data');
    }
};

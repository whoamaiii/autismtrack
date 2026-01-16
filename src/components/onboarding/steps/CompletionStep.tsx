/**
 * CompletionStep Component
 *
 * Celebration screen shown after completing onboarding.
 * Features confetti-like particles and next steps hints.
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Rocket, Sparkles, ClipboardList, TrendingUp, AlertTriangle } from 'lucide-react';
import { useChildProfile } from '../../../store';

interface CompletionStepProps {
    onComplete: () => void;
}

const PARTICLE_COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];

// Celebration particle component - all random values passed as props
const CelebrationParticle: React.FC<{
    delay: number;
    x: number;
    targetX: number;
    colorIndex: number;
}> = ({ delay, x, targetX, colorIndex }) => (
    <motion.div
        initial={{ y: 0, x: x, opacity: 1, scale: 1 }}
        animate={{
            y: [-10, -150],
            x: [x, targetX],
            opacity: [1, 0],
            scale: [1, 0.5]
        }}
        transition={{
            duration: 2,
            delay: delay,
            ease: "easeOut"
        }}
        className="absolute top-1/2"
        style={{
            left: `${50 + x}%`,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: PARTICLE_COLORS[colorIndex]
        }}
    />
);

interface FeatureHintProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    delay: number;
}

const FeatureHint: React.FC<FeatureHintProps> = ({ icon, title, description, delay }) => (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay }}
        className="flex items-start gap-3 text-left"
    >
        <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
            {icon}
        </div>
        <div>
            <h4 className="text-white font-medium text-sm">{title}</h4>
            <p className="text-white/50 text-xs">{description}</p>
        </div>
    </motion.div>
);

// Generate random particle data - called only once via useState initializer
function generateParticles() {
    return Array.from({ length: 20 }, (_, i) => ({
        id: i,
        delay: Math.random() * 0.5,
        x: (Math.random() - 0.5) * 100,
        targetX: (Math.random() - 0.5) * 100,
        colorIndex: Math.floor(Math.random() * PARTICLE_COLORS.length)
    }));
}

export const CompletionStep: React.FC<CompletionStepProps> = ({ onComplete }) => {
    const { childProfile } = useChildProfile();
    const [showParticles, setShowParticles] = useState(true);
    // useState lazy initializer is the safe place for impure functions
    const [particles] = useState(generateParticles);

    // Hide particles after animation
    useEffect(() => {
        const timer = setTimeout(() => setShowParticles(false), 3000);
        return () => clearTimeout(timer);
    }, []);

    const childName = childProfile?.name || 'barnet';

    return (
        <div className="flex flex-col items-center text-center space-y-6 w-full relative">
            {/* Celebration Particles */}
            {showParticles && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {particles.map(p => (
                        <CelebrationParticle
                            key={p.id}
                            delay={p.delay}
                            x={p.x}
                            targetX={p.targetX}
                            colorIndex={p.colorIndex}
                        />
                    ))}
                </div>
            )}

            {/* Success Icon */}
            <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.2 }}
                className="w-20 h-20 bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 rounded-2xl flex items-center justify-center backdrop-blur-md border border-emerald-500/30 shadow-lg shadow-emerald-500/20"
            >
                <Rocket className="text-emerald-300 w-10 h-10" />
            </motion.div>

            {/* Title */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-2"
            >
                <div className="flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <h2 className="text-2xl font-bold text-white">
                        Alt klart!
                    </h2>
                    <Sparkles className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-white/60">
                    Kreativium er klar for {childName}
                </p>
            </motion.div>

            {/* Quick Tips */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 space-y-4"
            >
                <p className="text-white/40 text-xs uppercase tracking-wider">
                    Kom i gang
                </p>

                <FeatureHint
                    icon={<ClipboardList className="w-5 h-5 text-cyan-400" />}
                    title="Logg med ett trykk"
                    description="Trykk på trafikklysene for rask logging"
                    delay={0.7}
                />

                <FeatureHint
                    icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
                    title="Se trender over tid"
                    description="Dashboard viser mønstre automatisk"
                    delay={0.8}
                />

                <FeatureHint
                    icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
                    title="Krisemodus"
                    description="Rask tilgang når ting eskalerer"
                    delay={0.9}
                />
            </motion.div>

            {/* Complete Button */}
            <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onComplete}
                className="
                    w-full py-4 px-6 rounded-xl
                    bg-gradient-to-r from-emerald-500 to-cyan-500
                    text-white font-semibold text-lg
                    flex items-center justify-center gap-2
                    shadow-lg shadow-emerald-500/25
                    transition-all hover:shadow-emerald-500/40
                "
            >
                <Sparkles className="w-5 h-5" />
                La oss begynne!
            </motion.button>
        </div>
    );
};

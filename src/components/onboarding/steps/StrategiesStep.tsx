import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Check, Rocket } from 'lucide-react';
import { useChildProfile, useSettings } from '../../../store';

interface StrategiesStepProps {
    onComplete: () => void;
}

const COMMON_STRATEGIES = [
    'Skjermtid', 'Tungt teppe', 'Alenetid', 'Dyp pust',
    'Klemmeball', 'Hørselvern', 'Trampoline',
    'Varm kakao', 'Musikk', 'Lese bok'
];

export const StrategiesStep: React.FC<StrategiesStepProps> = ({ onComplete }) => {
    const { childProfile, updateChildProfile } = useChildProfile();
    const { completeOnboarding } = useSettings();
    const [selectedStrategies, setSelectedStrategies] = useState<string[]>(childProfile?.effectiveStrategies || []);

    const toggleStrategy = (strategy: string) => {
        if (selectedStrategies.includes(strategy)) {
            setSelectedStrategies(prev => prev.filter(s => s !== strategy));
        } else {
            setSelectedStrategies(prev => [...prev, strategy]);
        }
    };

    const handleComplete = () => {
        updateChildProfile({ effectiveStrategies: selectedStrategies });
        completeOnboarding();
        onComplete();
    };

    return (
        <div className="flex flex-col items-center text-center space-y-6 w-full max-w-md">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center backdrop-blur-md mb-2 border border-green-500/30"
            >
                <Heart className="text-green-300 w-8 h-8" />
            </motion.div>

            <h2 className="text-2xl font-bold text-white">Effektive Strategier</h2>

            <p className="text-slate-300 text-sm">
                Hva hjelper vanligvis for å roe ned eller fylle energi?
            </p>

            <div className="flex flex-wrap gap-3 justify-center pt-2">
                {COMMON_STRATEGIES.map((strategy) => {
                    const isSelected = selectedStrategies.includes(strategy);
                    return (
                        <button
                            key={strategy}
                            onClick={() => toggleStrategy(strategy)}
                            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border flex items-center gap-2 ${isSelected
                                    ? 'bg-green-500/20 text-green-100 border-green-500/40 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                                    : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                                }`}
                        >
                            {isSelected && <Check size={14} />}
                            {strategy}
                        </button>
                    );
                })}
            </div>

            <button
                onClick={handleComplete}
                className="mt-8 flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg hover:shadow-green-500/30 transition-all transform hover:scale-105"
            >
                <Rocket size={20} />
                Fullfør
            </button>
        </div>
    );
};

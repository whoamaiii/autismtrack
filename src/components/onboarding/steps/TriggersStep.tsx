import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, Check } from 'lucide-react';
import { useChildProfile } from '../../../store';

interface TriggersStepProps {
    onNext: () => void;
}

const COMMON_TRIGGERS = [
    'Høye lyder', 'Sterkt lys', 'Sult', 'Trøtthet',
    'Overganger', 'Uventede endringer', 'Sosialt press',
    'Klesmerker', 'Mange inntrykk', 'Kravsituasjoner'
];

export const TriggersStep: React.FC<TriggersStepProps> = ({ onNext }) => {
    const { childProfile, updateChildProfile } = useChildProfile();
    const [selectedTriggers, setSelectedTriggers] = useState<string[]>(childProfile?.sensorySensitivities || []);

    const toggleTrigger = (trigger: string) => {
        if (selectedTriggers.includes(trigger)) {
            setSelectedTriggers(prev => prev.filter(t => t !== trigger));
        } else {
            setSelectedTriggers(prev => [...prev, trigger]);
        }
    };

    const handleNext = () => {
        updateChildProfile({ sensorySensitivities: selectedTriggers });
        onNext();
    };

    return (
        <div className="flex flex-col items-center text-center space-y-6 w-full max-w-md">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center backdrop-blur-md mb-2 border border-red-500/30"
            >
                <Zap className="text-red-300 w-8 h-8" />
            </motion.div>

            <h2 className="text-2xl font-bold text-white">Vanlige Triggere</h2>

            <p className="text-slate-300 text-sm">
                Velg det som ofte skaper stress (du kan endre dette senere).
            </p>

            <div className="flex flex-wrap gap-3 justify-center pt-2">
                {COMMON_TRIGGERS.map((trigger) => {
                    const isSelected = selectedTriggers.includes(trigger);
                    return (
                        <button
                            key={trigger}
                            onClick={() => toggleTrigger(trigger)}
                            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 border flex items-center gap-2 ${isSelected
                                    ? 'bg-red-500/20 text-red-100 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                                    : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                                }`}
                        >
                            {isSelected && <Check size={14} />}
                            {trigger}
                        </button>
                    );
                })}
            </div>

            <button
                onClick={handleNext}
                className="mt-8 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg transition-all"
            >
                {selectedTriggers.length === 0 ? 'Hopp over' : 'Neste'}
                <ArrowRight size={20} />
            </button>
        </div>
    );
};

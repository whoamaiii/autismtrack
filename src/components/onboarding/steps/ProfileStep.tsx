import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, ArrowRight } from 'lucide-react';
import { useChildProfile } from '../../../store';

interface ProfileStepProps {
    onNext: () => void;
}

export const ProfileStep: React.FC<ProfileStepProps> = ({ onNext }) => {
    const { childProfile, setChildProfile } = useChildProfile();
    const [name, setName] = useState(childProfile?.name || '');

    const handleNext = () => {
        if (!name.trim()) return;

        setChildProfile({
            id: childProfile?.id || crypto.randomUUID(),
            name: name,
            diagnoses: childProfile?.diagnoses || [],
            communicationStyle: childProfile?.communicationStyle || 'verbal',
            sensorySensitivities: childProfile?.sensorySensitivities || [],
            seekingSensory: childProfile?.seekingSensory || [],
            effectiveStrategies: childProfile?.effectiveStrategies || [],
            createdAt: childProfile?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        onNext();
    };

    return (
        <div className="flex flex-col items-center text-center space-y-6 w-full max-w-md">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center backdrop-blur-md mb-2 border border-blue-500/30"
            >
                <User className="text-blue-300 w-8 h-8" />
            </motion.div>

            <h2 className="text-2xl font-bold text-white">Hvem er dette for?</h2>

            <p className="text-slate-300">
                Vi tilpasser opplevelsen basert på barnets navn.
            </p>

            <div className="w-full space-y-4 pt-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                    <label className="block text-slate-400 text-sm font-medium mb-2 text-left">Barnets Navn</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="F.eks. Lukas"
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg"
                        autoFocus
                    />
                </div>
            </div>

            <button
                onClick={handleNext}
                disabled={!name.trim()}
                className={`mt-8 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg transition-all ${!name.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
            >
                Neste
                <ArrowRight size={20} />
            </button>
        </div>
    );
};

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';

interface StartStepProps {
    onNext: () => void;
}

export const StartStep: React.FC<StartStepProps> = ({ onNext }) => {
    return (
        <div className="flex flex-col items-center text-center space-y-6">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
                className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md mb-4 shadow-lg border border-white/20"
            >
                <Sparkles className="text-primary-300 w-12 h-12" />
            </motion.div>

            <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-bold text-white"
            >
                Velkommen til NeuroLogg Pro
            </motion.h2>

            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-slate-200 text-lg max-w-sm"
            >
                Ditt verktøy for å forstå, spore og mestre energi og følelser.
            </motion.p>

            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-slate-400 text-sm max-w-xs"
            >
                La oss sette opp profilen din på 2 minutter.
            </motion.p>

            <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ delay: 0.6 }}
                onClick={onNext}
                className="mt-8 flex items-center gap-2 bg-primary hover:bg-primary-600 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-primary/30 transition-all"
            >
                Start Oppsett
                <ArrowRight size={20} />
            </motion.button>
        </div>
    );
};

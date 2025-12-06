import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StartStep } from './steps/StartStep';
import { ProfileStep } from './steps/ProfileStep';
import { TriggersStep } from './steps/TriggersStep';
import { StrategiesStep } from './steps/StrategiesStep';

export const OnboardingWizard: React.FC = () => {
    const [currentStep, setCurrentStep] = useState(0);

    const nextStep = () => setCurrentStep(prev => prev + 1);

    const steps = [
        <StartStep onNext={nextStep} />,
        <ProfileStep onNext={nextStep} />,
        <TriggersStep onNext={nextStep} />,
        <StrategiesStep onComplete={() => { }} />
        // onComplete is handled inside StrategiesStep via store + App re-render
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xl">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden -z-10">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-900/40 via-purple-900/40 to-slate-900/40" />
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3]
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px]"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.2, 0.4, 0.2]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-rose-500/20 rounded-full blur-[100px]"
                />
            </div>

            <div className="w-full max-w-2xl px-6 relative z-10">
                {/* Progress Indicators */}
                {currentStep > 0 && (
                    <div className="flex justify-center gap-2 mb-12">
                        {[1, 2, 3].map((step) => (
                            <div
                                key={step}
                                className={`h-1.5 rounded-full transition-all duration-500 ${step <= currentStep
                                        ? 'w-12 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                                        : 'w-2 bg-white/20'
                                    }`}
                            />
                        ))}
                    </div>
                )}

                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col items-center"
                    >
                        {steps[currentStep]}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

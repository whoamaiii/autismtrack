/**
 * OnboardingWizard Component
 *
 * A streamlined 3-step onboarding flow for new users:
 * 1. Welcome - Quick value proposition with explore option
 * 2. Profile - Child's name (required)
 * 3. Personalize - Optional triggers/strategies setup
 * 4. Completion - Celebration and next steps
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StartStep } from './steps/StartStep';
import { ProfileStep } from './steps/ProfileStep';
import { PersonalizeStep } from './steps/PersonalizeStep';
import { CompletionStep } from './steps/CompletionStep';
import { useSettings } from '../../store';

type OnboardingStep = 'start' | 'profile' | 'personalize' | 'completion';

// Steps that show in the progress indicator (excludes start and completion)
const PROGRESS_STEPS = ['profile', 'personalize'] as const;

export const OnboardingWizard: React.FC = () => {
    const { t } = useTranslation();
    const [currentStep, setCurrentStep] = useState<OnboardingStep>('start');
    const navigate = useNavigate();
    const { completeOnboarding } = useSettings();

    // Step order for progress calculation
    const stepOrder: OnboardingStep[] = ['start', 'profile', 'personalize', 'completion'];
    const currentStepIndex = stepOrder.indexOf(currentStep);
    const progress = ((currentStepIndex) / (stepOrder.length - 1)) * 100;

    // Get step labels for progress indicator
    const stepLabels: Record<typeof PROGRESS_STEPS[number], string> = {
        profile: t('onboarding.steps.profile', 'Profile'),
        personalize: t('onboarding.steps.personalize', 'Personalize'),
    };

    // Calculate which step we're on (1-based, for display)
    const progressStepIndex = PROGRESS_STEPS.indexOf(currentStep as typeof PROGRESS_STEPS[number]);
    const displayStepNumber = progressStepIndex >= 0 ? progressStepIndex + 1 : 0;

    const handleQuickStart = () => {
        // User chose to explore without setup - complete onboarding
        completeOnboarding();
        navigate('/', { replace: true });
    };

    const handleComplete = () => {
        navigate('/', { replace: true });
    };

    const renderStep = () => {
        switch (currentStep) {
            case 'start':
                return (
                    <StartStep
                        onNext={() => setCurrentStep('profile')}
                        onQuickStart={handleQuickStart}
                    />
                );
            case 'profile':
                return (
                    <ProfileStep
                        onNext={() => setCurrentStep('personalize')}
                        onBack={() => setCurrentStep('start')}
                    />
                );
            case 'personalize':
                return (
                    <PersonalizeStep
                        onNext={() => setCurrentStep('completion')}
                        onSkip={() => setCurrentStep('completion')}
                        onBack={() => setCurrentStep('profile')}
                    />
                );
            case 'completion':
                return (
                    <CompletionStep onComplete={handleComplete} />
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-gray-900 via-gray-900 to-black overflow-y-auto">
            {/* Animated Background Orbs */}
            <div className="absolute inset-0 overflow-hidden -z-10">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.2, 0.3, 0.2]
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-1/4 -left-20 w-80 h-80 bg-cyan-500/20 rounded-full blur-[100px]"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.15, 0.25, 0.15]
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px]"
                />
            </div>

            <div className="w-full max-w-md px-6 py-8 relative z-10">
                {/* Progress Indicator - Only show during profile and personalize steps */}
                {currentStep !== 'start' && currentStep !== 'completion' && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        {/* Step Counter */}
                        <div className="text-center mb-4">
                            <span className="text-xs font-medium text-white/60">
                                {t('onboarding.stepCounter', 'Step {{current}} of {{total}}', {
                                    current: displayStepNumber,
                                    total: PROGRESS_STEPS.length,
                                })}
                            </span>
                        </div>

                        {/* Step Dots with Labels */}
                        <div className="flex justify-center items-center gap-4">
                            {PROGRESS_STEPS.map((step, index) => {
                                const isCompleted = progressStepIndex > index;
                                const isCurrent = progressStepIndex === index;

                                return (
                                    <div key={step} className="flex flex-col items-center gap-2">
                                        {/* Step Dot */}
                                        <motion.div
                                            className={`
                                                w-8 h-8 rounded-full flex items-center justify-center
                                                font-semibold text-sm transition-all duration-300
                                                ${isCompleted
                                                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'
                                                    : isCurrent
                                                        ? 'bg-primary text-white ring-4 ring-primary/30'
                                                        : 'bg-white/10 text-white/40'
                                                }
                                            `}
                                            initial={false}
                                            animate={{
                                                scale: isCurrent ? 1.1 : 1,
                                            }}
                                        >
                                            {isCompleted ? (
                                                <Check size={16} strokeWidth={3} />
                                            ) : (
                                                index + 1
                                            )}
                                        </motion.div>
                                        {/* Step Label */}
                                        <span className={`
                                            text-xs font-medium transition-colors
                                            ${isCurrent ? 'text-white' : isCompleted ? 'text-white/60' : 'text-white/40'}
                                        `}>
                                            {stepLabels[step]}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                        </div>
                    </motion.div>
                )}

                {/* Step Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="flex flex-col items-center"
                    >
                        {renderStep()}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

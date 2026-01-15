import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedLogo } from './AnimatedLogo';

/**
 * Splash Screen Component
 *
 * Full-screen animated splash with the KREATIVIUM logo.
 * Features:
 * - Smooth fade in/out transitions
 * - Animated background gradient
 * - Optional loading indicator
 * - Auto-dismisses or waits for signal
 */

interface SplashScreenProps {
  /** Whether the splash screen is visible */
  isVisible: boolean;
  /** Show loading dots indicator */
  showLoadingIndicator?: boolean;
  /** Optional tagline under logo */
  tagline?: string;
  /** Callback when splash finishes and exits */
  onComplete?: () => void;
}

export function SplashScreen({
  isVisible,
  showLoadingIndicator = true,
  tagline,
  onComplete
}: SplashScreenProps) {
  return (
    <AnimatePresence onExitComplete={onComplete}>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-slate-950"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          {/* Animated gradient background */}
          <div className="absolute inset-0">
            {/* Animated gradient orbs */}
            <motion.div
              className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl"
              animate={{
                x: [0, 40, 0],
                y: [0, 20, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
            <motion.div
              className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-purple-500/10 blur-3xl"
              animate={{
                x: [0, -30, 0],
                y: [0, -15, 0],
                scale: [1, 1.15, 1]
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center gap-6">
            {/* Animated Logo */}
            <AnimatedLogo width={300} showBackground={true} />

            {/* Tagline */}
            {tagline && (
              <motion.p
                className="text-slate-400 text-sm tracking-widest uppercase mt-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
              >
                {tagline}
              </motion.p>
            )}

            {/* Loading indicator */}
            {showLoadingIndicator && (
              <motion.div
                className="flex gap-2 mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-cyan-400/60"
                    animate={{
                      y: [0, -8, 0],
                      opacity: [0.4, 1, 0.4]
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: 'easeInOut'
                    }}
                  />
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SplashScreen;

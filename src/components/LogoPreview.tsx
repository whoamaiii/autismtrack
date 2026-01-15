import { useState } from 'react';
import { AnimatedLogo } from './AnimatedLogo';
import { SplashScreen } from './SplashScreen';

/**
 * Logo Preview Page
 *
 * Test page to preview the animated logo and splash screen.
 * Access at: /logo-preview
 */
export function LogoPreview() {
  const [showSplash, setShowSplash] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 gap-12">
      {/* Controls */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => setShowSplash(true)}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
        >
          Show Splash Screen
        </button>
        <button
          onClick={() => setIsAnimating(!isAnimating)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
        >
          {isAnimating ? 'Pause Animation' : 'Play Animation'}
        </button>
      </div>

      {/* Logo Preview */}
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-slate-400 text-sm uppercase tracking-widest">Animated Logo Preview</h2>
        <AnimatedLogo
          width={320}
          showBackground={true}
          isAnimating={isAnimating}
        />
      </div>

      {/* Without background glow */}
      <div className="flex flex-col items-center gap-4 mt-8">
        <h2 className="text-slate-400 text-sm uppercase tracking-widest">Without Background Glow</h2>
        <AnimatedLogo
          width={280}
          showBackground={false}
          isAnimating={isAnimating}
        />
      </div>

      {/* Smaller sizes */}
      <div className="flex flex-col items-center gap-4 mt-8">
        <h2 className="text-slate-400 text-sm uppercase tracking-widest">Smaller Sizes</h2>
        <div className="flex items-center gap-8">
          <AnimatedLogo width={200} showBackground={false} isAnimating={isAnimating} />
          <AnimatedLogo width={120} showBackground={false} isAnimating={isAnimating} />
        </div>
      </div>

      {/* Splash Screen Overlay */}
      <SplashScreen
        isVisible={showSplash}
        tagline="Creativity Unleashed"
        onComplete={() => setShowSplash(false)}
      />

      {/* Click to dismiss splash */}
      {showSplash && (
        <button
          onClick={() => setShowSplash(false)}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000] text-slate-400 text-sm"
        >
          Click anywhere to dismiss
        </button>
      )}
    </div>
  );
}

export default LogoPreview;

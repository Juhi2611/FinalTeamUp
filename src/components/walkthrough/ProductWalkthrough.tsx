import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { walkthroughSteps } from './WalkthroughSteps';
import { MockUI } from './MockUI';

export const ProductWalkthrough: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [infoPos, setInfoPos] = useState({ x: window.innerWidth / 2 - 160, y: -1000 }); // default offscreen
  
  const currentStep = walkthroughSteps[currentIndex];

  const updateRect = useCallback(() => {
    if (!currentStep) return;
    
    if (currentStep.targetId) {
      const el = document.getElementById(currentStep.targetId);
      if (el) {
        const rect = el.getBoundingClientRect();
        const padding = 12;
        setTargetRect({
          x: rect.left - padding,
          y: rect.top - padding,
          w: rect.width + padding * 2,
          h: rect.height + padding * 2
        });

        // Position info box
        const cardW = 320;
        const cardH = 220;
        let pX = 0, pY = 0;

        if (currentStep.position === 'right') {
          pX = rect.right + 24;
          pY = rect.top + rect.height / 2 - cardH / 2;
        } else if (currentStep.position === 'left') {
          pX = rect.left - 24 - cardW;
          pY = rect.top + rect.height / 2 - cardH / 2;
        } else if (currentStep.position === 'bottom') {
          pX = rect.left + rect.width / 2 - cardW / 2;
          pY = rect.bottom + 24;
        } else if (currentStep.position === 'top') {
          pX = rect.left + rect.width / 2 - cardW / 2;
          pY = rect.top - 24 - cardH;
        } else {
          pX = window.innerWidth / 2 - cardW / 2;
          pY = window.innerHeight / 2 + 100;
        }

        // Clamp to screen bounds
        const screenPad = 16;
        if (pX + cardW > window.innerWidth - screenPad) pX = window.innerWidth - cardW - screenPad;
        if (pX < screenPad) pX = screenPad;
        if (pY + cardH > window.innerHeight - screenPad) pY = window.innerHeight - cardH - screenPad;
        if (pY < screenPad) pY = screenPad;

        setInfoPos({ x: pX, y: pY });
      } else {
        // Fallback to center if target not found yet (maybe rendering)
        setTargetRect(null);
        setInfoPos({ x: window.innerWidth / 2 - 160, y: window.innerHeight / 2 + 100 });
      }
    } else {
      // Mock UI mode - center a generic spotlight or no spotlight
      setTargetRect({
        x: window.innerWidth / 2 - 250,
        y: window.innerHeight / 2 - 150,
        w: 500,
        h: 300
      });
      setInfoPos({ x: window.innerWidth / 2 - 160, y: window.innerHeight / 2 + 170 });
    }
  }, [currentStep]);

  useEffect(() => {
    updateRect();
    window.addEventListener('resize', updateRect);
    // Poll continuously just in case the DOM shifts or elements mount
    const interval = setInterval(updateRect, 100);
    return () => {
      window.removeEventListener('resize', updateRect);
      clearInterval(interval);
    };
  }, [updateRect]);

  useEffect(() => {
    if (!currentStep) return;
    // Auto-scroll logic
    if (currentStep.targetId) {
      const el = document.getElementById(currentStep.targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    
    const duration = currentStep.duration || 5000;
    const timer = setTimeout(() => {
      if (currentIndex < walkthroughSteps.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        onComplete();
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [currentIndex, currentStep, onComplete]);

  if (!currentStep) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto overflow-hidden">
      {/* Full screen blur for mock steps */}
      <AnimatePresence>
        {currentStep.mockId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#0F172A]/20 backdrop-blur-md pointer-events-none"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* The Spotlight Mask */}
        {targetRect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: 1,
              left: targetRect.x, 
              top: targetRect.y, 
              width: targetRect.w, 
              height: targetRect.h 
            }}
            transition={{
              left: { type: 'spring', stiffness: 70, damping: 20 },
              top: { type: 'spring', stiffness: 70, damping: 20 },
              width: { type: 'spring', stiffness: 70, damping: 20 },
              height: { type: 'spring', stiffness: 70, damping: 20 },
              opacity: { duration: 0.5 }
            }}
            className="absolute rounded-xl pointer-events-none"
            style={{
              boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.75)', // Strong Navy blue tint dimming
            }}
          />
        )}
      </AnimatePresence>

      {/* Render Mock UI if needed */}
      <AnimatePresence mode="wait">
        {currentStep.mockId && (
          <motion.div 
            key={currentStep.mockId}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] pointer-events-none"
          >
            <MockUI mockId={currentStep.mockId} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Card */}
      <motion.div
        animate={{
          left: infoPos.x,
          top: infoPos.y,
        }}
        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        className="absolute w-[320px] bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 z-[10000]"
      >
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#14B8A6]">
            Step {currentIndex + 1} of {walkthroughSteps.length}
          </span>
        </div>
        <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-2">
          {currentStep.title}
        </h2>
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mb-6 leading-relaxed">
          {currentStep.description}
        </p>

        <div className="flex justify-between items-center">
          <button 
            onClick={onComplete}
            className="text-sm font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-white transition-colors"
          >
            Skip Tour
          </button>
          
          <div className="flex gap-2">
            <button 
              onClick={() => {
                if (currentIndex < walkthroughSteps.length - 1) {
                  setCurrentIndex(currentIndex + 1);
                } else {
                  onComplete();
                }
              }}
              className="bg-[#0F172A] dark:bg-white text-white dark:text-[#0F172A] text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#1E293B] dark:hover:bg-[#F1F5F9] transition-colors"
            >
              {currentIndex === walkthroughSteps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 h-1 bg-[#F1F5F9] dark:bg-[#334155] w-full rounded-b-2xl overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / walkthroughSteps.length) * 100}%` }}
            className="h-full bg-[#14B8A6]"
          />
        </div>
      </motion.div>
    </div>
  );
};

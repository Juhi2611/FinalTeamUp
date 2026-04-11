import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { WalkthroughStep } from './WalkthroughSteps';
import { MockUI } from './MockUI';
import { cn } from '@/lib/utils';

interface ProductWalkthroughProps {
  pageId: string;
  steps: WalkthroughStep[];
  onComplete: (pageId: string) => void;
}

export const ProductWalkthrough: React.FC<ProductWalkthroughProps> = ({
  pageId,
  steps,
  onComplete
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    if (currentStep.targetId) {
      const element = document.getElementById(currentStep.targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentStepIndex]);

  useEffect(() => {
    if (currentStep.targetId) {
      const updateRect = () => {
        const element = document.getElementById(currentStep.targetId!);
        if (element) {
          setTargetRect(element.getBoundingClientRect());
        } else {
          setTargetRect(null);
        }
      };

      updateRect();
      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect);
      
      return () => {
        window.removeEventListener('resize', updateRect);
        window.removeEventListener('scroll', updateRect);
      };
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    setTimeout(() => onComplete(pageId), 300);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop with hole */}
      <div className="absolute inset-0 pointer-events-auto">
        <svg className="w-full h-full">
          <defs>
            <mask id="walkthrough-mask">
              <rect width="100%" height="100%" fill="white" />
              {targetRect && (
                <rect
                  x={targetRect.x - 8}
                  y={targetRect.y - 8}
                  width={targetRect.width + 16}
                  height={targetRect.height + 16}
                  rx="16"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.85)" mask="url(#walkthrough-mask)" className="backdrop-blur-[2px]" />
        </svg>
      </div>

      {/* Pulsing Highlight Ring */}
      {targetRect && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute z-[101] pointer-events-none"
          style={{
            top: targetRect.y - 12,
            left: targetRect.x - 12,
            width: targetRect.width + 24,
            height: targetRect.height + 24,
          }}
        >
          <div className="absolute inset-0 border-2 border-primary rounded-[20px] animate-pulse shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
          <div className="absolute inset-0 border-4 border-primary/20 rounded-[20px] animate-[ping_2s_infinite]" />
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
          <div className="flex flex-col items-center gap-6 w-full max-w-lg">
            {/* Mock UI section if exists */}
            {currentStep.mockId && (
              <motion.div
                key={`mock-${currentStep.mockId}`}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                className="pointer-events-auto"
              >
                <MockUI mockId={currentStep.mockId} />
              </motion.div>
            )}

            {/* Tooltip Card */}
            <motion.div
              key={`step-${currentStep.id}`}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              className={cn(
                "bg-card/90 backdrop-blur-xl border border-white/20 rounded-[2rem] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] pointer-events-auto w-full max-w-[320px] relative",
                !currentStep.mockId && targetRect ? "absolute" : "relative"
              )}
              style={!currentStep.mockId && targetRect ? {
                top: targetRect.bottom + 32 > window.innerHeight - 250 ? 'auto' : targetRect.bottom + 32,
                bottom: targetRect.bottom + 32 > window.innerHeight - 250 ? window.innerHeight - targetRect.top + 32 : 'auto',
                left: Math.min(Math.max(20, targetRect.left + targetRect.width / 2 - 160), window.innerWidth - 340),
              } : undefined}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  Step {currentStepIndex + 1} / {steps.length}
                </span>
                <button 
                  onClick={handleComplete}
                  className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-muted-foreground/60 hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <h3 className="text-lg font-bold text-foreground font-display mb-2 leading-tight">
                {currentStep.title}
              </h3>

              <p className="text-[13px] text-muted-foreground/90 leading-relaxed mb-6">
                {currentStep.description}
              </p>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {currentStepIndex > 0 && (
                    <button
                      onClick={handleBack}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3 h-3" /> Back
                    </button>
                  )}
                </div>
                
                <button
                  onClick={handleNext}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white shadow-[0_8px_16px_rgba(var(--primary),0.3)] hover:shadow-[0_12px_20px_rgba(var(--primary),0.4)] hover:-translate-y-0.5 transition-all flex items-center gap-1.5"
                >
                  {currentStepIndex === steps.length - 1 ? (
                    <>Finish <CheckCircle2 className="w-3.5 h-3.5" /></>
                  ) : (
                    <>Next <ChevronRight className="w-3.5 h-3.5" /></>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </AnimatePresence>
    </div>
  );
};

// Skill Score Card Component
// Displays overall score and individual metrics with animations
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  SkillScoreCardProps, 
  getScoreLabel, 
  getScoreColor 
} from '@/types/skillVerification.types';
import { cn } from '@/lib/utils';
// Metric labels and colors
const METRIC_CONFIG = {
  activity: { label: 'Activity', color: 'bg-blue-500' },
  consistency: { label: 'Consistency', color: 'bg-purple-500' },
  recency: { label: 'Recency', color: 'bg-emerald-500' },
  diversity: { label: 'Diversity', color: 'bg-amber-500' },
} as const;
// Animated circular progress for overall score
function CircularProgress({ 
  value, 
  animate = true,
  size = 120,
  strokeWidth = 10,
}: { 
  value: number; 
  animate?: boolean;
  size?: number;
  strokeWidth?: number;
}) {
  const [displayValue, setDisplayValue] = useState(animate ? 0 : value);
  
  useEffect(() => {
    if (!animate) {
      setDisplayValue(value);
      return;
    }
    
    const duration = 1500; // 1.5 seconds
    const startTime = Date.now();
    const startValue = 0;
    
    const animateValue = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(startValue + (value - startValue) * easeOut);
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animateValue);
      }
    };
    
    requestAnimationFrame(animateValue);
  }, [value, animate]);
  
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (displayValue / 100) * circumference;
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        {/* Background circle */}
        <circle
          className="text-muted"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <circle
          className={cn(
            "transition-all duration-300",
            getScoreColor(displayValue).replace('text-', 'stroke-')
          )}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            transition: animate ? 'stroke-dashoffset 0.1s ease-out' : 'none',
          }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-3xl font-bold", getScoreColor(displayValue))}>
          {displayValue}
        </span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}
// Individual metric bar
function MetricBar({ 
  label, 
  value, 
  maxValue = 25,
  colorClass,
  animate = true,
}: { 
  label: string; 
  value: number; 
  maxValue?: number;
  colorClass: string;
  animate?: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(animate ? 0 : value);
  
  useEffect(() => {
    if (!animate) {
      setDisplayValue(value);
      return;
    }
    
    const timeout = setTimeout(() => {
      setDisplayValue(value);
    }, 300);
    
    return () => clearTimeout(timeout);
  }, [value, animate]);
  
  const percentage = (displayValue / maxValue) * 100;
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{displayValue}/{maxValue}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", colorClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
// Main Score Card Component
export function SkillScoreCard({ 
  overallScore, 
  metrics, 
  animate = true 
}: SkillScoreCardProps) {
  const scoreLabel = getScoreLabel(overallScore);
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-center">
          Verification Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score Circle */}
        <div className="flex flex-col items-center gap-2">
          <CircularProgress value={overallScore} animate={animate} />
          <span className={cn("text-sm font-medium", getScoreColor(overallScore))}>
            {scoreLabel}
          </span>
        </div>
        
        {/* Individual Metrics */}
        <div className="space-y-3">
          <MetricBar
            label={METRIC_CONFIG.activity.label}
            value={metrics.activity}
            colorClass={METRIC_CONFIG.activity.color}
            animate={animate}
          />
          <MetricBar
            label={METRIC_CONFIG.consistency.label}
            value={metrics.consistency}
            colorClass={METRIC_CONFIG.consistency.color}
            animate={animate}
          />
          <MetricBar
            label={METRIC_CONFIG.recency.label}
            value={metrics.recency}
            colorClass={METRIC_CONFIG.recency.color}
            animate={animate}
          />
          <MetricBar
            label={METRIC_CONFIG.diversity.label}
            value={metrics.diversity}
            colorClass={METRIC_CONFIG.diversity.color}
            animate={animate}
          />
        </div>
        
        {/* Score explanation */}
        <p className="text-xs text-muted-foreground text-center">
          Score based on GitHub activity, consistency, recency, and technology diversity
        </p>
      </CardContent>
    </Card>
  );
}
// Compact inline score display for profiles
export function InlineScoreDisplay({ 
  score, 
  className 
}: { 
  score: number; 
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className={cn("font-bold", getScoreColor(score))}>
        {score}
      </span>
      <span className="text-muted-foreground text-sm">/100</span>
    </div>
  );
}
export default SkillScoreCard;
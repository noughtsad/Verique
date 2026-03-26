'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

interface Factor {
  label: string;
  impact: number; // +/- percentage
  description: string;
}

interface ConfidenceBreakdownProps {
  confidence: number;
  factors: Factor[];
}

export function ConfidenceBreakdown({ 
  confidence,
  factors 
}: ConfidenceBreakdownProps) {
  return (
    <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-slate-900 flex items-center gap-2">
            Confidence: {Math.round(confidence * 100)}%
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
            <span>
              Weights are heuristic, designed for transparency
              <br />— not a claim of statistical certainty.
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {factors.map((factor, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-2 text-sm"
          >
            <div className={cn(
              "w-1 h-8 rounded flex-shrink-0",
              factor.impact > 0 ? "bg-green-500" : "bg-red-500"
            )} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-slate-700 font-medium">{factor.label}</span>
                <span className={cn(
                  "font-mono text-xs",
                  factor.impact > 0 ? "text-green-600" : "text-red-600"
                )}>
                  {factor.impact > 0 ? '+' : ''}{factor.impact}%
                </span>
              </div>
              <div className="text-xs text-slate-500 truncate">{factor.description}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

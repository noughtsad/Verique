'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressStep {
  label: string;
  status: 'pending' | 'active' | 'complete';
  detail?: string;
}

interface LiveProgressProps {
  steps: ProgressStep[];
}

export function LiveProgress({ steps }: LiveProgressProps) {
  return (
    <div className="space-y-3 py-4">
      {steps.map((step, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex items-start gap-3"
        >
          {step.status === 'complete' ? (
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
          ) : step.status === 'active' ? (
            <Loader2 className="h-5 w-5 text-emerald-600 animate-spin mt-0.5 flex-shrink-0" />
          ) : (
            <div className="h-5 w-5 border-2 border-slate-300 rounded-full mt-0.5 flex-shrink-0" />
          )}
          
          <div className="flex-1 min-w-0">
            <div className={cn(
              "font-medium text-sm",
              step.status === 'active' && "text-emerald-600",
              step.status === 'complete' && "text-slate-700",
              step.status === 'pending' && "text-slate-400"
            )}>
              {step.label}
            </div>
            {step.detail && (
              <div className="text-xs text-slate-500 mt-0.5">{step.detail}</div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

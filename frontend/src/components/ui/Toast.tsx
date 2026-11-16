'use client';

import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { Check } from 'lucide-react';

const ToastContext = createContext<(message: string) => void>(() => {});

/** Brief confirmation shown at the bottom of the screen ("Link copied"). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[110] flex justify-center sm:bottom-8">
        {message && (
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface-strong px-4 py-2.5 text-sm font-medium text-white shadow-xl animate-slide-in">
            <Check aria-hidden className="h-4 w-4 text-emerald-300" />
            {message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

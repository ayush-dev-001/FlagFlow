import { Check, AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { transition } from './motion';
import { cx } from './primitives';

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

const ToastContext = createContext<((message: string, tone?: Toast['tone']) => void) | null>(null);

/**
 * Confirms a change happened (Product principle 1). Toasts stack bottom-right (bottom-centre on phones),
 * are announced politely to screen readers, and leave after a few seconds.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(0);

  const push = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = ++next.current;
    setToasts((list) => [...list.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 6000 : 3500);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={transition.base}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex max-w-[380px] items-center gap-2.5 rounded-control border border-white/[0.08] bg-raised px-4 py-3 text-[15px] text-white shadow-[0_20px_50px_-20px_rgb(0_0_0/0.9)]"
            >
              {t.tone === 'success' ? (
                <Check className="size-4 shrink-0 text-lime" aria-hidden="true" />
              ) : (
                <AlertCircle className={cx('size-4 shrink-0 text-danger')} aria-hidden="true" />
              )}
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error('useToast must be used inside <ToastProvider>');
  return push;
}

import type { Transition } from 'motion/react';

// One motion vocabulary for the whole dashboard: exponential ease-out from an already-visible state,
// short enough to explain a change without delaying the work. Reduced motion is honoured globally by
// <MotionConfig reducedMotion="user"> in main.tsx, which turns transforms off and keeps opacity.

export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const duration = {
  fast: 0.16,
  base: 0.24,
  slow: 0.42,
} as const;

export const transition = {
  fast: { duration: duration.fast, ease: EASE_OUT },
  base: { duration: duration.base, ease: EASE_OUT },
  slow: { duration: duration.slow, ease: EASE_OUT },
  /** For things that settle into place, like a toggle knob. */
  spring: { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 },
} satisfies Record<string, Transition>;

/** A small rise for content arriving on a page: 6px is enough to read as motion, not enough to travel. */
export const rise = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: transition.base,
};

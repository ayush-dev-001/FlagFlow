import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { EASE_OUT as EASE } from '../../ui/motion';
import { Artwork, SCREEN_PANEL, SCREEN_PARTS, type ScreenPart } from './artwork';

export type MirrorStatus = 'idle' | 'submitting' | 'success' | 'error';

export interface FormMirror {
  /** Characters across all the text fields (email, names), so moving between them never empties line 1. */
  field1: number;
  /** Characters in the password field. */
  field2: number;
  /** Which mirrored field has focus: 1, 2, or 0 for none. */
  focus: 0 | 1 | 2;
  status: MirrorStatus;
}

const INK = '#0b0d0c';
const FLAME = '#ff5a24';

// How many characters fill a line: the text fields together run long, a password short.
const FULL_AT = { 1: 30, 2: 14 } as const;
// The field lines are ~140 drawing units wide, centred on their anchor.
const LINE = { left: -73, width: 141, top: -8, height: 16 };

function Field({
  part,
  id,
  progress,
  focused,
}: {
  part: ScreenPart;
  id: string;
  progress: number;
  focused: boolean;
}) {
  const reduce = useReducedMotion();
  const width = Math.max(0, Math.min(1, progress)) * LINE.width;
  return (
    <g transform={`translate(${part.x},${part.y})`}>
      <clipPath id={id}>
        <motion.rect
          x={LINE.left}
          y={LINE.top}
          height={LINE.height}
          initial={false}
          animate={{ width }}
          transition={{ duration: reduce ? 0 : 0.25, ease: EASE }}
        />
      </clipPath>
      {/* The empty field, then the typed part, then a caret where typing continues. */}
      <path d={part.d} fill={INK} opacity={focused ? 0.32 : 0.22} />
      <path d={part.d} fill={INK} clipPath={`url(#${id})`} />
      {focused && (
        <motion.rect
          x={LINE.left + width + 3}
          y={-11}
          width={4}
          height={22}
          rx={2}
          fill={INK}
          animate={reduce ? { opacity: 1 } : { opacity: [1, 1, 0, 0] }}
          transition={reduce ? undefined : { duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
        />
      )}
    </g>
  );
}

/** The monitor's form, mirroring the real one: fields fill as you type, the button reacts to submit. */
function Screen({ mirror }: { mirror: FormMirror }) {
  const reduce = useReducedMotion();
  const { avatar, field1, field2, button } = SCREEN_PARTS;
  const { status } = mirror;
  return (
    <motion.g
      animate={status === 'error' && !reduce ? { x: [0, -14, 12, -8, 5, 0] } : { x: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      {/* Success brightens the screen; an error turns it flame, the lines and button staying ink on top. */}
      <g transform={`translate(${SCREEN_PANEL.x},${SCREEN_PANEL.y})`}>
        <motion.path
          d={SCREEN_PANEL.d}
          fill={status === 'error' ? FLAME : '#ffffff'}
          initial={false}
          animate={{ opacity: status === 'success' ? 0.35 : status === 'error' ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
        />
      </g>
      <g transform={`translate(${avatar.x},${avatar.y})`}>
        <motion.path
          d={avatar.d}
          fill={INK}
          animate={status === 'idle' && !reduce ? { y: [0, -6, 0] } : { y: 0 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </g>
      <Field
        part={field1}
        id="ffl-field-1"
        progress={mirror.field1 / FULL_AT[1]}
        focused={mirror.focus === 1}
      />
      <Field
        part={field2}
        id="ffl-field-2"
        progress={mirror.field2 / FULL_AT[2]}
        focused={mirror.focus === 2}
      />
      <g transform={`translate(${button.x},${button.y})`}>
        <motion.path
          d={button.d}
          fill={INK}
          animate={status === 'submitting' && !reduce ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
          transition={status === 'submitting' ? { duration: 0.8, repeat: Infinity } : { duration: 0.2 }}
        />
      </g>
    </motion.g>
  );
}

/**
 * The owner's login illustration, repainted in the site palette. The person keeps the drawing's own gentle
 * loop; the monitor shows the form you are filling in. Decorative: the real form is the accessible one.
 */
export function LoginIllustration({ mirror, className }: { mirror: FormMirror; className?: string }) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  // The drawing's own SMIL loops (the person, the plant) hold still when reduced motion is asked for.
  useEffect(() => {
    const svg = box.current?.querySelector('svg');
    if (reduce) svg?.pauseAnimations();
    else svg?.unpauseAnimations();
  }, [reduce]);
  return (
    <div ref={box} className={className}>
      <Artwork className="block w-full" screen={<Screen mirror={mirror} />} />
    </div>
  );
}

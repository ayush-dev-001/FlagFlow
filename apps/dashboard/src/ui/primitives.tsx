import { AlertCircle, Loader2 } from 'lucide-react';
import {
  type ButtonHTMLAttributes,
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  useId,
} from 'react';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'lg';

// Matches the home page: lime with ink text for the main action, a soft white fill for the second one.
const buttonStyles: Record<ButtonVariant, string> = {
  // Disabled, the main action is neutral: lime only appears once it can actually go.
  primary:
    'bg-lime text-ink font-semibold hover:brightness-110 disabled:bg-white/[0.06] disabled:text-white/40 disabled:opacity-100',
  secondary: 'bg-white/[0.05] text-white font-semibold hover:bg-white/[0.09]',
  ghost: 'text-muted hover:text-white hover:bg-white/[0.06]',
  danger: 'bg-danger-soft text-danger font-semibold border border-flame/30 hover:bg-flame/20',
};

const buttonSizes: Record<ButtonSize, string> = {
  md: 'h-10 px-4 text-sm',
  lg: 'h-[47px] px-5 text-[17px]',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-control',
        'transition-[filter,background-color,color,transform] duration-150 ease-out active:translate-y-px',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100 disabled:active:translate-y-0',
        buttonSizes[size],
        buttonStyles[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

/** A labelled input with its hint and error wired up for screen readers. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy =
    [hint && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-[15px] font-medium text-white">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          'h-11 rounded-control border bg-ink/70 px-3.5 text-[15px] text-white placeholder:text-subtle',
          'transition-[border-color,box-shadow] duration-150 ease-out',
          'focus:outline-none focus-visible:outline-none focus:border-lime/70 focus:shadow-[0_0_0_3px_rgb(196_240_74/0.18)]',
          error ? 'border-flame/60' : 'border-white/10 hover:border-white/20',
          className,
        )}
        {...rest}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-[13px] text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
});

export function Alert({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div
      role="alert"
      className="flex gap-2.5 rounded-control border border-flame/25 bg-danger-soft px-3.5 py-3 text-[15px] text-white"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <div className="text-muted">{children}</div>
      </div>
    </div>
  );
}

export type FlagState = 'live' | 'testing' | 'off';

// Lime means on (PLAN.md §3): Live is lime, Testing is iris, Inactive is grey.
const stateStyles: Record<FlagState, { dot: string; pill: string; label: string }> = {
  live: { dot: 'bg-lime shadow-[0_0_10px_var(--color-lime)]', pill: 'bg-live-soft text-live', label: 'Live' },
  testing: { dot: 'bg-iris', pill: 'bg-testing-soft text-testing', label: 'Testing' },
  off: { dot: 'bg-off', pill: 'bg-off-soft text-muted', label: 'Inactive' },
};

/** The one place flag state gets its colour, so live/testing/inactive read the same everywhere. */
export function StatePill({ state }: { state: FlagState }) {
  const s = stateStyles[state];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold',
        s.pill,
      )}
    >
      <span className={cx('size-1.5 rounded-full', s.dot)} aria-hidden="true" />
      {s.label}
    </span>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-[15px] text-muted">
      <Loader2 className="size-4 animate-spin text-lime" aria-hidden="true" />
      {label}
    </span>
  );
}

/** The FlagFlow mark: the home page's lime square. */
export function Mark({ className = 'size-3.5' }: { className?: string }) {
  return <span className={cx('inline-block rounded-[3px] bg-lime', className)} aria-hidden="true" />;
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-[19px] font-bold tracking-tight text-white">
      <Mark />
      FlagFlow
    </span>
  );
}

export { cx };

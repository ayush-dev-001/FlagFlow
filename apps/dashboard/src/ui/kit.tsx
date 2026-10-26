// Building blocks for the signed-in screens, in the home page's language: ink cards, white hairlines,
// lime only for what is on, what will make something go, and focus.
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Check, ChevronDown, Copy, Search, X } from 'lucide-react';
import { motion } from 'motion/react';
import {
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { ApiError } from '../api/client';
import { transition } from './motion';
import { Button, cx } from './primitives';

/** An on/off switch. Lime when on; the knob settles with a spring. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  size = 'md',
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** The accessible name. Put visible text next to it, or this is all a screen reader hears. */
  label: string;
  disabled?: boolean;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const big = size === 'lg';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        // Switches inside links (board cards) must not navigate.
        e.preventDefault();
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cx(
        'relative inline-flex shrink-0 items-center rounded-full p-[3px] transition-colors duration-200 ease-out',
        'disabled:cursor-not-allowed disabled:opacity-50',
        big ? 'h-8 w-[54px]' : 'h-6 w-10',
        checked ? 'bg-lime' : 'bg-white/[0.12] hover:bg-white/[0.18]',
        className,
      )}
    >
      <motion.span
        aria-hidden="true"
        className={cx(
          'block rounded-full shadow-sm',
          big ? 'size-[26px]' : 'size-[18px]',
          checked ? 'bg-ink' : 'bg-white',
        )}
        initial={false}
        animate={{ x: checked ? (big ? 22 : 16) : 0 }}
        transition={transition.spring}
      />
    </button>
  );
}

/** A card section with an optional title row. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      className={cx('rounded-card border border-white/[0.06] bg-surface', className)}
    >
      {(title || actions) && (
        <header className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="text-[17px] font-semibold tracking-[-0.02em] text-white">
                {title}
              </h2>
            )}
            {description && <p className="mt-1 text-[14px] text-white/55">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('p-5 sm:p-6', bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 px-1 py-8 sm:items-center sm:text-center">
      <span className="grid size-11 place-items-center rounded-[11px] bg-white/[0.07]">
        <Icon className="size-5 stroke-[1.6] text-white/80" aria-hidden="true" />
      </span>
      <p className="text-[17px] font-semibold tracking-[-0.02em] text-white">{title}</p>
      {children && <div className="max-w-[46ch] text-[15px] text-pretty text-white/55">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

const messageOf = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Something went wrong. Try again.';

/** What failed and a way to try again; used wherever a query can fail. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 px-1 py-8 sm:items-center sm:text-center">
      <span className="grid size-11 place-items-center rounded-[11px] bg-danger-soft">
        <AlertTriangle className="size-5 stroke-[1.6] text-danger" aria-hidden="true" />
      </span>
      <p className="text-[17px] font-semibold tracking-[-0.02em] text-white">Couldn't Load This</p>
      <p className="max-w-[46ch] text-[15px] text-white/55">{messageOf(error)}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cx('animate-pulse rounded-control bg-white/[0.05]', className)} />
  );
}

/** Skeleton rows plus a status message for screen readers. */
export function LoadingRows({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div className="flex flex-col gap-3">
      <span role="status" className="sr-only">
        {label}
      </span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}

const control =
  'rounded-control border border-white/10 bg-ink/70 text-[15px] text-white placeholder:text-subtle transition-[border-color,box-shadow] duration-150 ease-out hover:border-white/20 focus:outline-none focus-visible:outline-none focus:border-lime/70 focus:shadow-[0_0_0_3px_rgb(196_240_74/0.18)]';

export function TextArea({
  label,
  hideLabel,
  hint,
  error,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hideLabel?: boolean;
  hint?: string;
  error?: string;
}) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-[15px] font-medium text-white'}>
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          control,
          'min-h-24 resize-y px-3.5 py-2.5 leading-relaxed',
          error && 'border-flame/60',
          className,
        )}
        {...rest}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[13px] text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Select({
  label,
  hideLabel,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hideLabel?: boolean }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-[15px] font-medium text-white'}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          className={cx(control, 'h-10 w-full cursor-pointer appearance-none px-3 pr-9', className)}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-white/55"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export function SearchInput({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cx('relative', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle"
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cx(control, 'h-11 w-full pr-3.5 pl-10')}
      />
    </div>
  );
}

/** A single-choice row of options, such as a state filter. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-control bg-white/[0.04] p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              'relative h-9 flex-1 rounded-[7px] px-3 text-[14px] font-medium whitespace-nowrap transition-colors duration-150',
              on ? 'text-white' : 'text-white/55 hover:text-white',
            )}
          >
            {on && (
              <motion.span
                layoutId={`${id}-pill`}
                className="absolute inset-0 rounded-[7px] bg-white/[0.09]"
                transition={transition.base}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-3 text-[15px] text-white">
      <span className="relative grid size-[18px] shrink-0 place-items-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer size-[18px] cursor-pointer appearance-none rounded-[5px] border border-white/20 bg-ink transition-colors duration-150 checked:border-lime checked:bg-lime"
        />
        <Check
          className="pointer-events-none absolute size-3.5 stroke-[3] text-ink opacity-0 peer-checked:opacity-100"
          aria-hidden="true"
        />
      </span>
      {children}
    </label>
  );
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          });
        }}
        icon={
          copied ? (
            <Check className="size-4 text-live" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )
        }
        className="sm:w-28"
      >
        {copied ? 'Copied' : label}
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </>
  );
}

/**
 * A modal on the native <dialog>: the browser traps focus, makes the page behind inert, and Esc closes it.
 * Focus returns to whatever opened it.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop (the dialog element itself, outside its box) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
      className={cx(
        'dialog m-auto w-[calc(100%-2rem)] rounded-card border border-white/[0.08] bg-surface p-0 text-white',
        wide ? 'max-w-[560px]' : 'max-w-[460px]',
      )}
    >
      {open && (
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-[22px] leading-tight font-bold tracking-[-0.04em]">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-control text-muted hover:bg-white/[0.06] hover:text-white"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          {description && <div className="mt-2 text-[15px] text-pretty text-white/55">{description}</div>}
          <div className="mt-6">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** Asks before something that can't be undone. The confirm button names the action. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  onConfirm,
  pending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  error?: unknown;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={children}>
      {error ? <p className="mb-4 text-[14px] text-danger">{messageOf(error)}</p> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={pending}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** "3 minutes ago", "yesterday", or "just now". */
export function relativeTime(iso: string, now = Date.now()) {
  const seconds = (new Date(iso).getTime() - now) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

const dateTime = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

/** A relative time that shows the exact date on hover and to assistive tech. */
export function Time({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={className}>
      {relativeTime(iso)}
    </time>
  );
}

/** Errors from a mutation, as one line under the form that caused them. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-[14px] text-danger">
      {messageOf(error)}
    </p>
  );
}

export { messageOf };

import { Check, Copy } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { PageHeader } from '../shell/PageHeader';
import { rise } from '../ui/motion';
import { Button, Wordmark } from '../ui/primitives';
import { useAuth } from './AuthProvider';

const MASK = '•';
const GLYPHS = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789_-';

/**
 * Resolves the key from masked to real characters left to right, so the one-time reveal reads as an
 * event rather than another line of text. Reduced motion shows the key at once.
 */
function useResolvingText(value: string) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : MASK.repeat(value.length));
  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const total = 700;
    let frame = 0;
    const tick = (now: number) => {
      const done = Math.min(1, (now - start) / total);
      const settled = Math.floor(done * value.length);
      setShown(
        value
          .split('')
          .map((ch, i) =>
            i < settled
              ? ch
              : i < settled + 4
                ? GLYPHS[(i * 7 + Math.floor(now / 40)) % GLYPHS.length]
                : MASK,
          )
          .join(''),
      );
      if (done < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return shown;
}

/** Shown once after registration: the org's first API key, which the server never returns again. */
export function WelcomePage() {
  const { newApiKey, dismissNewApiKey, organization } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [stored, setStored] = useState(false);
  const checkboxId = useId();
  const shown = useResolvingText(newApiKey?.key ?? '');

  // Until the user confirms they stored the key, warn before a reload or tab close would lose it.
  useEffect(() => {
    if (!newApiKey || stored) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [newApiKey, stored]);

  if (!newApiKey) return <Navigate to="/" replace />;

  async function copy() {
    await navigator.clipboard.writeText(newApiKey!.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function finish() {
    dismissNewApiKey();
    void navigate('/', { replace: true });
  }

  // Rendered outside the app shell on purpose: no navigation to wander off through before the key is stored.
  return (
    <main className="relative z-10 mx-auto w-full max-w-2xl px-4 py-6 sm:px-8 sm:py-10 lg:py-16">
      <div className="mb-8 sm:mb-12">
        <Wordmark />
      </div>
      <PageHeader
        title="Your Organization Is Ready"
        description={`${organization?.name ?? 'Your organization'} has its first API key. Your backend uses it to read flags. Copy it now: FlagFlow stores only a hash and can't show it again.`}
      />
      <motion.section {...rise} className="rounded-card border border-white/[0.06] bg-surface p-6 sm:p-8">
        <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-white">
          API Key · {newApiKey.name}
        </h2>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <code
            aria-label="API key"
            className="tabular min-w-0 flex-1 break-all rounded-control border border-white/10 bg-ink/70 px-3.5 py-3 font-mono text-[14px] leading-relaxed text-lime select-all"
          >
            {shown}
          </code>
          <Button
            variant="secondary"
            onClick={() => void copy()}
            icon={
              copied ? (
                <Check className="size-4 text-live" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )
            }
            className="sm:w-28"
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <p className="sr-only" aria-live="polite">
          {copied ? 'API key copied to clipboard' : ''}
        </p>

        <p className="mt-5 text-[15px] leading-relaxed text-muted">
          Put it in your backend's environment, for example{' '}
          <code className="font-mono text-white">FLAGFLOW_API_KEY</code>. Never ship it to a browser. You can
          create more keys and revoke this one in Settings.
        </p>

        <div className="mt-7 flex flex-col gap-4 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <label
            htmlFor={checkboxId}
            className="flex cursor-pointer items-center gap-3 text-[15px] text-white"
          >
            {/* Themed box: ticking it is the screen's one "on" moment, so it turns lime. */}
            <span className="relative grid size-[18px] shrink-0 place-items-center">
              <input
                id={checkboxId}
                type="checkbox"
                checked={stored}
                onChange={(e) => setStored(e.target.checked)}
                className="peer size-[18px] cursor-pointer appearance-none rounded-[5px] border border-white/20 bg-ink transition-colors duration-150 checked:border-lime checked:bg-lime"
              />
              <Check
                className="pointer-events-none absolute size-3.5 stroke-[3] text-ink opacity-0 peer-checked:opacity-100"
                aria-hidden="true"
              />
            </span>
            I've stored this key somewhere safe
          </label>
          <Button size="lg" onClick={finish} disabled={!stored}>
            Continue to flags
          </Button>
        </div>
      </motion.section>
    </main>
  );
}

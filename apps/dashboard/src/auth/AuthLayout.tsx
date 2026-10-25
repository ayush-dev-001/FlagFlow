import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Sparkle } from '../site/SiteChrome';
import { EASE_OUT } from '../ui/motion';
import { Wordmark } from '../ui/primitives';
import { type FormMirror, LoginIllustration } from './illustration/LoginIllustration';

const reveal = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: EASE_OUT, delay },
});

const IDLE: FormMirror = { field1: 0, field2: 0, focus: 0, status: 'idle' };

/**
 * Auth screens in two sections, without the site header: the form on the left, and on wide screens the
 * illustration in its own panel on the right, its monitor mirroring the form (`mirror`, from
 * useFormMirror). Phones and tablets get the form alone. The wordmark leads back to the home page.
 */
export function AuthLayout({
  title,
  subtitle,
  mirror = IDLE,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  mirror?: FormMirror;
  children: ReactNode;
}) {
  return (
    <div className="relative z-10 grid min-h-dvh overflow-hidden bg-ink lg:grid-cols-2">
      <section className="relative flex flex-col px-5 py-6 sm:px-10 lg:px-14">
        {/* One lime glow low on the form side, the home page's light source. */}
        <div
          className="pointer-events-none absolute -bottom-64 -left-48 size-[300px] rounded-full bg-lime/15 blur-[120px] sm:size-[460px] sm:bg-lime/25"
          aria-hidden="true"
        />
        <Link to="/" className="relative self-start rounded-control" aria-label="FlagFlow home">
          <Wordmark />
        </Link>
        <main className="relative flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[400px]">
            <motion.div {...reveal(0)}>
              <h1 className="text-[clamp(2.25rem,4vw,3rem)] leading-[1.02] font-bold tracking-[-0.055em] text-white">
                {title}
              </h1>
              {subtitle && <p className="mt-3 text-[16px] leading-snug text-white/55">{subtitle}</p>}
            </motion.div>
            <motion.div {...reveal(0.08)} className="mt-9">
              {children}
            </motion.div>
          </div>
        </main>
      </section>

      <motion.aside
        {...reveal(0.16)}
        className="relative m-3 hidden overflow-hidden rounded-[28px] border border-white/[0.06] bg-surface lg:flex lg:items-center lg:justify-center"
        data-testid="auth-illustration"
        data-status={mirror.status}
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 aspect-square w-[118%] -translate-1/2 rounded-full border border-white/[0.05]" />
          <div className="absolute top-1/2 left-1/2 aspect-square w-[86%] -translate-1/2 rounded-full border border-white/[0.04]" />
          <div className="absolute inset-x-[15%] bottom-[8%] h-1/3 rounded-full bg-lime/30 blur-[110px]" />
        </div>
        <Sparkle className="top-[12%] left-[10%] size-16" />
        <Sparkle className="right-[9%] bottom-[16%] size-24" />
        <LoginIllustration mirror={mirror} className="relative w-[92%] max-w-[720px]" />
      </motion.aside>
    </div>
  );
}

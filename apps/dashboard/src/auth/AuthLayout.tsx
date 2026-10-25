import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { SiteAtmosphere, SiteHeader } from '../site/SiteChrome';
import { EASE_OUT } from '../ui/motion';

const reveal = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: EASE_OUT, delay },
});

/**
 * Auth screens live in the home page's world: its header and hero atmosphere, a big tight headline,
 * and the form on a near-black card underneath.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative z-10 min-h-dvh overflow-hidden bg-ink">
      <SiteAtmosphere />
      <SiteHeader />
      <main className="relative z-10 flex flex-col items-center px-4 pt-14 pb-20 lg:pt-[8vh]">
        <motion.div {...reveal(0)} className="w-full max-w-[480px] text-center">
          <h1 className="text-[clamp(2.25rem,5vw,3.4rem)] leading-[1.02] font-bold tracking-[-0.055em] text-white">
            {title}
          </h1>
          {subtitle && <p className="mt-4 text-[17px] leading-snug text-white/55">{subtitle}</p>}
        </motion.div>
        <motion.div
          {...reveal(0.08)}
          className="mt-10 w-full max-w-[440px] rounded-card border border-white/[0.06] bg-surface p-6 shadow-[0_30px_80px_-40px_rgb(0_0_0/0.9)] sm:p-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

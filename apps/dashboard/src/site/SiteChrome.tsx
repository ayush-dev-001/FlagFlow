import { ArrowUpRight, Menu, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { transition } from '../ui/motion';

// The public site's header, plus pieces the home page and the auth pages share.

/** The demo customer app (apps/demo-web). Unset, links fall back to the home page's in-page preview. */
export const DEMO_URL = (import.meta.env.VITE_DEMO_URL as string | undefined) || null;

export const NAV = [
  { label: 'Product', id: 'product' },
  { label: 'How it works', id: 'how' },
  { label: 'Use cases', id: 'use-cases' },
  { label: 'Docs', id: 'docs' },
] as const;

/** A soft lime cross of light. */
export function Sparkle({ className }: { className: string }) {
  return (
    <div className={`pointer-events-none absolute ${className}`} aria-hidden="true">
      <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-lime/60 to-transparent" />
      <div className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-lime/60 to-transparent" />
    </div>
  );
}

function NewTabIcon({ className }: { className: string }) {
  return (
    <>
      <ArrowUpRight className={className} aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </>
  );
}

export function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2 text-[19px] font-bold tracking-tight text-white">
      <span className="relative size-4 rounded-[4px] bg-lime" aria-hidden="true">
        <span className="absolute inset-[4px] rounded-[1.5px] bg-ink" />
      </span>
      FlagFlow
    </Link>
  );
}

/** The id of the section currently under the header, for the nav's active state. */
function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
        setActive(ids.find((id) => seen.get(id)) ?? null);
      },
      // A band across the upper middle of the screen: a section counts once it fills that band.
      { rootMargin: '-35% 0px -60% 0px' },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

/** Fixed glass bar over every public page. Solidifies once the page scrolls under it. */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const active = useActiveSection(NAV.map((n) => n.id));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onResize = () => window.innerWidth >= 768 && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const demoLink = DEMO_URL ? { href: DEMO_URL, target: '_blank', rel: 'noreferrer' } : { href: '/#demo' };
  const close = () => setOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4">
      <div
        className={`mx-auto max-w-[1080px] rounded-2xl border transition-[background-color,border-color,box-shadow] duration-300 ${
          scrolled || open
            ? 'border-white/10 bg-[#101312]/85 shadow-[0_12px_40px_rgb(0_0_0/0.35)] backdrop-blur-xl'
            : 'border-white/5 bg-white/[0.03] backdrop-blur-md'
        }`}
      >
        <nav aria-label="Site" className="flex h-14 items-center gap-6 px-3 sm:px-4">
          <Wordmark />
          <ul className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <li key={item.id}>
                <a
                  href={`/#${item.id}`}
                  aria-current={active === item.id ? 'true' : undefined}
                  className={`relative rounded-lg px-3 py-1.5 text-[14px] transition-colors ${
                    active === item.id ? 'text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {active === item.id && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-lg bg-white/[0.07]"
                      transition={transition.base}
                    />
                  )}
                  <span className="relative">{item.label}</span>
                </a>
              </li>
            ))}
            <li>
              <a
                {...demoLink}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[14px] text-white/60 transition-colors hover:text-white"
              >
                Demo
                {DEMO_URL && <NewTabIcon className="size-3.5" />}
              </a>
            </li>
          </ul>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className="hidden rounded-lg px-3 py-1.5 text-[14px] text-white/70 transition-colors hover:text-white sm:block"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-[9px] bg-lime px-4 py-2 text-[14px] font-semibold text-ink transition-[filter] hover:brightness-110"
            >
              Get started
            </Link>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
              className="grid size-9 place-items-center rounded-lg text-white/80 transition-colors hover:bg-white/[0.07] hover:text-white md:hidden"
            >
              {open ? (
                <X className="size-5" aria-hidden="true" />
              ) : (
                <Menu className="size-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </nav>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id="site-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={transition.base}
              className="overflow-hidden md:hidden"
            >
              <ul className="space-y-1 border-t border-white/[0.07] px-3 pt-3 pb-4">
                {NAV.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`/#${item.id}`}
                      onClick={close}
                      className={`block rounded-lg px-3 py-2.5 text-[15px] transition-colors hover:bg-white/[0.06] ${
                        active === item.id ? 'bg-white/[0.06] text-white' : 'text-white/75'
                      }`}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    {...demoLink}
                    onClick={close}
                    className="flex items-center gap-1 rounded-lg px-3 py-2.5 text-[15px] text-white/75 transition-colors hover:bg-white/[0.06]"
                  >
                    Demo
                    {DEMO_URL && <NewTabIcon className="size-4" />}
                  </a>
                </li>
                <li className="sm:hidden">
                  <Link
                    to="/login"
                    onClick={close}
                    className="block rounded-lg px-3 py-2.5 text-[15px] text-white/75 transition-colors hover:bg-white/[0.06]"
                  >
                    Sign in
                  </Link>
                </li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

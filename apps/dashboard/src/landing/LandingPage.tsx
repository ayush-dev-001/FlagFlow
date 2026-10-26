import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  Copy,
  FileJson,
  History,
  LifeBuoy,
  MessageCircle,
  Plus,
  Power,
  Rocket,
  Search,
  ShieldCheck,
  Siren,
  UsersRound,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type KeyboardEvent, type ReactNode, useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { API_URL } from '../api/client';
import { DEMO_URL, NAV, SiteHeader, Sparkle, Wordmark } from '../site/SiteChrome';
import { EASE_OUT, transition } from '../ui/motion';
import onCall from './images/on-call.webp';
import pairAtDesk from './images/pair-at-desk.webp';
import teamAtMonitor from './images/team-at-monitor.webp';
import teamTable from './images/team-table.webp';

// The public home page. It carries its own lime-on-ink palette and covers the dashboard's global
// backdrop with an opaque ground. Section ids are the header's and footer's link targets.

const DOCS_URL = `${API_URL}/docs`;

/** Fades content up as it scrolls into view, once. MotionConfig in main.tsx drops the movement under reduced motion. */
function Reveal({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.7, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Photos are shown in greyscale so they sit in the lime-and-ink palette. */
function Photo({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`object-cover grayscale ${className}`}
    />
  );
}

/** A small mono label above a section heading. */
function Eyebrow({ children, dark = true }: { children: ReactNode; dark?: boolean }) {
  return (
    <p
      className={`inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.08em] uppercase ${
        dark ? 'text-lime' : 'text-ink/60'
      }`}
    >
      <span className={`h-px w-6 ${dark ? 'bg-lime/60' : 'bg-ink/30'}`} aria-hidden="true" />
      {children}
    </p>
  );
}

const primaryButton =
  'inline-flex h-12 items-center gap-2 rounded-[10px] bg-lime px-5 text-lg font-semibold text-ink transition-[filter,transform] hover:brightness-110 active:translate-y-px';
const ghostButton =
  'inline-flex h-12 items-center gap-2 rounded-[10px] border border-white/12 bg-white/[0.04] px-5 text-lg font-semibold text-white transition-colors hover:bg-white/[0.08]';

function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ${on ? 'bg-lime' : 'bg-white/15'}`}
    >
      <motion.span
        className={`absolute top-1 left-1 size-4 rounded-full ${on ? 'bg-ink' : 'bg-white'}`}
        animate={{ x: on ? 16 : 0 }}
        transition={transition.spring}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------------------------------
// Hero, with an interactive preview: the dashboard's toggles on one side, a customer app on the other.

type DemoFlag = 'dark_mode' | 'beta_banner' | 'new_checkout' | 'chat_widget';

const DEMO_FLAGS: { key: DemoFlag; note: string }[] = [
  { key: 'dark_mode', note: 'Theme' },
  { key: 'beta_banner', note: 'Banner' },
  { key: 'new_checkout', note: 'Checkout' },
  { key: 'chat_widget', note: 'Support chat' },
];

type StreamEvent = { id: number; key: DemoFlag; on: boolean; at: string };

function LivePreview() {
  // What the dashboard says, and what the app has received. The app catches up a beat later, as over the stream.
  const [flags, setFlags] = useState<Record<DemoFlag, boolean>>({
    dark_mode: false,
    beta_banner: true,
    new_checkout: false,
    chat_widget: false,
  });
  const [app, setApp] = useState(flags);
  const [events, setEvents] = useState<StreamEvent[]>([]);

  const toggle = (key: DemoFlag) => {
    const on = !flags[key];
    setFlags((f) => ({ ...f, [key]: on }));
    window.setTimeout(() => {
      setApp((a) => ({ ...a, [key]: on }));
      setEvents((list) =>
        [
          { id: Date.now(), key, on, at: new Date().toLocaleTimeString([], { hour12: false }) },
          ...list,
        ].slice(0, 3),
      );
    }, 220);
  };

  const dark = app.dark_mode;
  return (
    <div
      id="demo"
      className="scroll-mt-24 rounded-[22px] border border-white/10 bg-[#121514]/90 p-2 shadow-[0_40px_120px_rgb(0_0_0/0.55)] backdrop-blur"
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="ml-3 font-mono text-[12px] text-white/40">Interactive preview: flip a flag</span>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1.15fr]">
        {/* The dashboard side. */}
        <div className="flex flex-col rounded-[16px] bg-[#0e1110] p-4 text-left sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold text-white">Acme Inc. · Flags</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/10 px-2.5 py-1 font-mono text-[11px] text-lime">
              <span className="size-1.5 animate-pulse rounded-full bg-lime" aria-hidden="true" />
              stream open
            </span>
          </div>
          <ul className="mt-4 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
            {DEMO_FLAGS.map(({ key, note }) => (
              <li key={key} className="flex items-center gap-3 px-3.5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[13px] text-white">{key}</span>
                  <span className="block text-[12px] text-white/45">{note}</span>
                </span>
                <span
                  className={`hidden rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline ${
                    flags[key] ? 'bg-lime/12 text-lime' : 'bg-white/[0.06] text-white/50'
                  }`}
                >
                  {flags[key] ? 'Live' : 'Inactive'}
                </span>
                <Switch on={flags[key]} label={key} onToggle={() => toggle(key)} />
              </li>
            ))}
          </ul>
          <div
            className="mt-4 min-h-[76px] rounded-xl bg-black/30 p-3 font-mono text-[11.5px] leading-relaxed"
            aria-live="polite"
          >
            {events.length === 0 ? (
              <p className="text-white/35">Waiting for a change…</p>
            ) : (
              <ul>
                <AnimatePresence initial={false}>
                  {events.map((e) => (
                    <motion.li
                      key={e.id}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={transition.base}
                      className="truncate text-white/55"
                    >
                      <span className="text-white/30">{e.at}</span>{' '}
                      <span className="text-lime">flag.updated</span> {e.key}={e.on ? 'on' : 'off'}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>

        {/* The customer's app, as user U001 sees it. */}
        <div
          className={`relative flex min-h-[320px] flex-col overflow-hidden rounded-[16px] text-left transition-colors duration-500 ${
            dark ? 'bg-[#16181d] text-white' : 'bg-[#f4f5f2] text-ink'
          }`}
        >
          <div
            className={`flex items-center justify-between px-5 py-3.5 ${dark ? 'border-white/10' : 'border-ink/10'} border-b`}
          >
            <span className="text-[15px] font-bold tracking-tight">acme</span>
            <span className={`font-mono text-[11px] ${dark ? 'text-white/50' : 'text-ink/50'}`}>
              signed in as U001
            </span>
          </div>
          <AnimatePresence initial={false}>
            {app.beta_banner && (
              <motion.p
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={transition.base}
                className="overflow-hidden bg-iris text-center text-[13px] font-medium text-white"
              >
                <span className="block py-2">You're in the beta. Tell us what you think.</span>
              </motion.p>
            )}
          </AnimatePresence>
          <div className="flex flex-1 flex-col p-5">
            <p
              className={`text-[12px] font-medium tracking-wide uppercase ${dark ? 'text-white/45' : 'text-ink/45'}`}
            >
              Order summary
            </p>
            <div className={`mt-3 space-y-2 text-[14px] ${dark ? 'text-white/75' : 'text-ink/75'}`}>
              <p className="flex justify-between">
                <span>Team plan × 1</span>
                <span>$49.00</span>
              </p>
              <p className="flex justify-between">
                <span>Tax</span>
                <span>$4.90</span>
              </p>
              <p
                className={`flex justify-between border-t pt-2 font-semibold ${dark ? 'border-white/10 text-white' : 'border-ink/10 text-ink'}`}
              >
                <span>Total</span>
                <span>$53.90</span>
              </p>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={String(app.new_checkout)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={transition.base}
                className={`mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold ${
                  app.new_checkout ? 'bg-lime text-ink' : dark ? 'bg-white text-ink' : 'bg-ink text-white'
                }`}
              >
                {app.new_checkout ? (
                  <>
                    <Zap className="size-4" aria-hidden="true" /> Pay in one click
                  </>
                ) : (
                  'Continue to payment'
                )}
              </motion.span>
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {app.chat_widget && (
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={transition.spring}
                className="absolute right-4 bottom-[76px] grid size-11 place-items-center rounded-full bg-iris text-white shadow-lg"
                aria-label="Support chat"
              >
                <MessageCircle className="size-5" aria-hidden="true" />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative z-10 px-4 pt-32 pb-20 lg:pt-36">
      <div className="mx-auto max-w-[1080px] text-center">
        <Reveal>
          <a
            href="#how"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pr-3.5 pl-1 text-[13.5px] text-white/80 transition-colors hover:bg-white/[0.08]"
          >
            <span className="rounded-full bg-lime/15 px-2.5 py-0.5 font-mono text-[11.5px] text-lime">
              SSE
            </span>
            Flag changes reach your app in under a second
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </a>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 className="mx-auto mt-8 max-w-[900px] text-[clamp(2.4rem,6vw,4.9rem)] leading-[0.98] font-bold tracking-[-0.05em] text-white">
            Ship Features <span className="text-white/35">Without</span>{' '}
            <span className="relative whitespace-nowrap">
              Redeploying
              <svg
                viewBox="0 0 300 12"
                preserveAspectRatio="none"
                className="absolute -bottom-2 left-0 h-3 w-full text-lime"
                aria-hidden="true"
              >
                <path
                  d="M2 9C60 3 180 1 298 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mx-auto mt-8 max-w-[520px] text-lg leading-relaxed text-white/60">
            Turn a feature on for the users you pick, widen it to everyone, or switch it off when something
            breaks. Your running app hears about it straight away.
          </p>
        </Reveal>
        <Reveal delay={0.18} className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register" className={primaryButton}>
            Get started free
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <a href="#docs" className={ghostButton}>
            Read the quickstart
          </a>
        </Reveal>
      </div>

      <Reveal delay={0.26} className="mx-auto mt-16 max-w-[1080px]">
        <LivePreview />
      </Reveal>
    </section>
  );
}

// The real stack from PLAN.md. FlagFlow has no customers yet, so this row names what it runs on.
const STACK = ['Node.js', 'PostgreSQL', 'Redis', 'Prisma', 'Server-Sent Events', 'React', 'TypeScript'];

function StackRow() {
  return (
    <div className="relative z-10 mx-auto max-w-[1080px] px-4 pb-20">
      <div className="flex flex-col items-center gap-5 border-t border-white/[0.07] pt-10 md:flex-row md:justify-between">
        <p className="shrink-0 font-mono text-[12px] tracking-[0.08em] text-white/40 uppercase">Runs on</p>
        <ul className="flex flex-wrap justify-center gap-x-7 gap-y-3 md:justify-end">
          {STACK.map((label) => (
            <li key={label} className="text-[15px] font-semibold tracking-[-0.01em] text-white/50">
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// Product: a bento of what the dashboard does, each tile with a small picture of the real feature.

const tile = 'relative overflow-hidden rounded-[20px] border border-white/[0.07] bg-[#121514] p-6 sm:p-7';

function TileHeading({ icon: Icon, title, body }: { icon: typeof Zap; title: string; body: string }) {
  return (
    <>
      <span className="grid size-10 place-items-center rounded-[10px] bg-white/[0.06] text-lime">
        <Icon className="size-5 stroke-[1.7]" aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-[22px] leading-tight font-semibold tracking-[-0.025em] text-white">{title}</h3>
      <p className="mt-2 max-w-[380px] text-[15px] leading-snug text-white/55">{body}</p>
    </>
  );
}

const AUDIT_ROWS = [
  { who: 'admin@acme.test', what: 'turned on', flag: 'dark_mode', when: '2m ago' },
  { who: 'admin@acme.test', what: 'added U017 to', flag: 'new_checkout', when: '1h ago' },
  { who: 'admin@acme.test', what: 'created', flag: 'export_report', when: 'Fri' },
];

function Product() {
  return (
    <section
      id="product"
      aria-labelledby="product-title"
      className="scroll-mt-20 bg-ink py-24 text-white lg:py-32"
    >
      <div className="mx-auto max-w-[1080px] px-4">
        <Reveal className="max-w-[640px]">
          <Eyebrow>Product</Eyebrow>
          <h2
            id="product-title"
            className="mt-5 text-[clamp(2.1rem,4.2vw,3.6rem)] leading-[1.02] font-bold tracking-[-0.05em]"
          >
            Everything a Rollout Needs, Nothing It Doesn't
          </h2>
          <p className="mt-5 text-lg leading-snug text-white/55">
            On/off flags, a target list or all users, and a record of every change. Deliberately simple and
            fast.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Reveal className="md:col-span-2">
            <div className={`${tile} h-full`}>
              <TileHeading
                icon={UsersRound}
                title="Target by Your Own User IDs"
                body="Turn a flag on for U001 and U017 with the IDs your app already has. Your users never need a FlagFlow account."
              />
              <div
                className="mt-7 flex flex-wrap items-center gap-2 font-mono text-[13px]"
                aria-hidden="true"
              >
                {['U001', 'U017', 'U042'].map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white/85"
                  >
                    <span className="size-1.5 rounded-full bg-lime shadow-[0_0_8px_var(--color-lime)]" />
                    {id}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-3 py-2 text-white/40">
                  <Plus className="size-3.5" /> add ID
                </span>
                <span className="ml-auto hidden items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2 font-sans text-white/60 sm:inline-flex">
                  All users <span className="h-4 w-7 rounded-full bg-white/15" />
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className={`${tile} flex h-full flex-col border-lime/20 bg-lime text-ink`}>
              <Zap className="size-7 stroke-[1.7]" aria-hidden="true" />
              <p className="mt-auto pt-10 text-[64px] leading-none font-semibold tracking-[-0.06em]">
                &lt;1<span className="ml-1 text-[28px] tracking-[-0.03em]">sec</span>
              </p>
              <p className="mt-3 text-[15px] leading-snug text-ink/70">
                From a toggle in the dashboard to every running copy of your app.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <div className={`${tile} h-full`}>
              <TileHeading
                icon={Power}
                title="Switch It Off Fast"
                body="Something broke? Turn the flag off and the feature is gone for everyone."
              />
              <div
                className="mt-7 flex items-center gap-3 rounded-xl border border-flame/25 bg-flame/[0.08] p-3"
                aria-hidden="true"
              >
                <span className="grid size-9 place-items-center rounded-full bg-flame text-white">
                  <Power className="size-4" />
                </span>
                <span className="font-mono text-[13px] text-white/80">new_checkout → off</span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className={`${tile} h-full`}>
              <TileHeading
                icon={History}
                title="Every Change on Record"
                body="The audit log keeps who changed what, and when."
              />
              <ul className="mt-6 space-y-2 text-[12.5px]" aria-hidden="true">
                {AUDIT_ROWS.map((r) => (
                  <li
                    key={r.flag}
                    className="flex items-center gap-2 rounded-lg bg-black/25 px-3 py-2 text-white/60"
                  >
                    <span className="truncate">
                      {r.what} <span className="font-mono text-white/90">{r.flag}</span>
                    </span>
                    <span className="ml-auto shrink-0 text-white/35">{r.when}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className={`${tile} h-full`}>
              <TileHeading
                icon={ShieldCheck}
                title="Roles and Invites"
                body="Admins manage the team and API keys; members run rollouts. Invite links expire after 48 hours."
              />
              <div className="mt-6 flex gap-2 text-[12.5px]" aria-hidden="true">
                <span className="rounded-full bg-lime/12 px-3 py-1 text-lime">Admin</span>
                <span className="rounded-full bg-iris/25 px-3 py-1 text-[#c9c3ff]">Member</span>
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-white/55">48h invite</span>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <div className={`${tile} h-full`}>
              <TileHeading
                icon={Search}
                title="Look Up Any End User"
                body="Search an ID and see exactly which flags that user gets, then change one just for them."
              />
              <div
                className="mt-6 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
                aria-hidden="true"
              >
                <Search className="size-4 text-white/40" />
                <span className="font-mono text-[13px] text-white">U001</span>
                <span className="ml-auto text-[12px] text-white/40">4 of 6 on</span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.06} className="md:col-span-2">
            <div className="relative h-full min-h-[260px] overflow-hidden rounded-[20px]">
              <Photo
                src={teamAtMonitor}
                alt="A team gathered around a monitor"
                className="absolute inset-0 size-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-transparent" />
              <div className="absolute right-6 bottom-6 left-6 flex flex-wrap items-end justify-between gap-4">
                <p className="max-w-[360px] text-[22px] leading-tight font-semibold tracking-[-0.025em] text-white">
                  The dashboard your whole team opens during a rollout.
                </p>
                <Link
                  to="/register"
                  className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-white px-4 text-[15px] font-semibold text-ink transition-colors hover:bg-lime"
                >
                  Try it
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------
// How it works: three steps on a light ground, with the team photos.

const STEPS = [
  {
    title: 'Create a flag',
    body: 'Give it a key like new_checkout. Flags start off, so you can create one before the feature ships.',
    sample: 'new_checkout',
  },
  {
    title: 'Check it in your code',
    body: 'Your server asks the SDK. Rules live in memory, so a lookup never waits on the network.',
    sample: "isEnabled('new_checkout', user.id)",
  },
  {
    title: 'Roll it out live',
    body: 'Add a few user IDs, then turn it on for all users. Every running app updates in under a second.',
    sample: 'Testing → Live',
  },
];

const STATS = [
  { value: '<1s', label: 'from toggle to every running app' },
  { value: '0', label: 'redeploys to change who sees a feature' },
  { value: '48h', label: 'before an invite link expires' },
];

function HowItWorks() {
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="scroll-mt-20 bg-[#f4f5f2] py-24 text-ink lg:py-32"
    >
      <div className="mx-auto max-w-[1080px] px-4">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <Reveal>
            <Eyebrow dark={false}>How it works</Eyebrow>
            <h2
              id="how-title"
              className="mt-5 text-[clamp(2.1rem,4.2vw,3.6rem)] leading-[1.02] font-bold tracking-[-0.05em]"
            >
              Built for the Team on Call
            </h2>
            <p className="mt-5 max-w-[440px] text-lg leading-snug text-ink/60">
              Shipping a feature shouldn't mean shipping a deploy. Three steps, and every release is in your
              hands.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-3">
              <Photo
                src={teamTable}
                alt="Four teammates working around a shared table"
                className="h-[200px] w-full rounded-[16px] lg:h-[240px]"
              />
              <Photo
                src={onCall}
                alt="Two engineers pointing at a screen together"
                className="mt-8 h-[200px] w-full rounded-[16px] object-[center_35%] lg:h-[240px]"
              />
            </div>
          </Reveal>

          <ol className="relative space-y-4 lg:pt-16">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.08}>
                <li className="group flex gap-5 rounded-[18px] border border-ink/[0.08] bg-white p-6 shadow-[0_1px_0_rgb(0_0_0/0.03)] transition-shadow hover:shadow-[0_20px_50px_rgb(0_0_0/0.08)]">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink font-mono text-[14px] text-lime">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[20px] font-semibold tracking-[-0.02em]">{step.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-snug text-ink/60">{step.body}</p>
                    <code className="mt-4 inline-block max-w-full truncate rounded-lg bg-ink px-3 py-1.5 font-mono text-[12.5px] text-lime">
                      {step.sample}
                    </code>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>

        <dl className="mt-20 grid grid-cols-1 gap-px overflow-hidden rounded-[18px] border border-ink/[0.08] bg-ink/[0.08] sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.value} className="bg-[#f4f5f2] p-7">
              <dt className="sr-only">{s.label}</dt>
              <dd className="text-[52px] leading-none font-semibold tracking-[-0.05em]">{s.value}</dd>
              <dd className="mt-3 text-[15px] text-ink/60">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------
// Use cases. FlagFlow has no customers to quote yet, so these are scenarios from the people in
// PRODUCT.md, written as what happens, not as reviews from named people.

const CASES = [
  {
    id: 'incident',
    role: 'On-call engineer',
    moment: 'Switching off a broken feature',
    icon: Siren,
    text: 'Checkout starts throwing errors at 2am. You switch new_checkout off, and it is gone from every running app in under a second. No hotfix, no redeploy.',
    steps: ['Open new_checkout', 'Turn it off', 'Errors stop'],
  },
  {
    id: 'support',
    role: 'Support and product',
    moment: "Debugging one user's report",
    icon: LifeBuoy,
    text: 'A customer says the new dashboard looks wrong. You search for U001, see exactly which flags they get, and turn one off just for them.',
    steps: ['Search U001', 'See their flags', 'Change one for them'],
  },
  {
    id: 'beta',
    role: 'Product manager',
    moment: 'Rolling out to a few users first',
    icon: Rocket,
    text: 'The beta goes to five friendly customers first. You add their user IDs to the flag, watch it for a week, then turn it on for all users.',
    steps: ['Add five IDs', 'Watch for a week', 'All users'],
  },
  {
    id: 'audit',
    role: 'Team admin',
    moment: 'Finding out who changed what',
    icon: ShieldCheck,
    text: 'A flag was turned on Friday and nobody remembers doing it. The audit log shows who changed it, what changed, and when.',
    steps: ['Open the audit log', 'Filter by flag', 'See who and when'],
  },
];

function UseCases() {
  const [active, setActive] = useState(0);
  const uid = useId();
  const current = CASES[active]!;

  // Arrow keys move between tabs, as the ARIA tabs pattern expects.
  const onKey = (e: KeyboardEvent) => {
    const step =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = (active + step + CASES.length) % CASES.length;
    setActive(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  };

  return (
    <section
      id="use-cases"
      aria-labelledby="cases-title"
      className="scroll-mt-20 bg-ink py-24 text-white lg:py-32"
    >
      <div className="mx-auto max-w-[1080px] px-4">
        <Reveal className="max-w-[640px]">
          <Eyebrow>Use cases</Eyebrow>
          <h2
            id="cases-title"
            className="mt-5 text-[clamp(2.1rem,4.2vw,3.6rem)] leading-[1.02] font-bold tracking-[-0.05em]"
          >
            A Normal Week With FlagFlow
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.4fr]">
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label="Use cases"
            className="flex flex-col gap-2"
            onKeyDown={onKey}
          >
            {CASES.map(({ id, role, moment, icon: Icon }, i) => {
              const selected = i === active;
              return (
                <button
                  key={id}
                  id={`${uid}-tab-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`${uid}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(i)}
                  className={`relative flex items-center gap-4 rounded-[14px] px-4 py-3.5 text-left transition-colors ${
                    selected ? 'text-white' : 'text-white/55 hover:bg-white/[0.03] hover:text-white/85'
                  }`}
                >
                  {selected && (
                    <motion.span
                      layoutId="case-active"
                      className="absolute inset-0 rounded-[14px] border border-white/10 bg-[#161918]"
                      transition={transition.base}
                    />
                  )}
                  <span
                    className={`relative grid size-10 shrink-0 place-items-center rounded-full transition-colors ${
                      selected ? 'bg-lime text-ink' : 'bg-white/[0.06]'
                    }`}
                  >
                    <Icon className="size-[18px] stroke-[1.7]" aria-hidden="true" />
                  </span>
                  <span className="relative">
                    <span className="block text-[16px] font-semibold tracking-[-0.01em]">{role}</span>
                    <span className="block text-[13.5px] text-white/50">{moment}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            id={`${uid}-panel`}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-${active}`}
            className="relative overflow-hidden rounded-[20px] border border-white/[0.07] bg-gradient-to-br from-[#171a19] to-[#0f1211] p-7 sm:p-10"
          >
            <div
              className="pointer-events-none absolute -top-24 -right-24 size-[300px] rounded-full bg-lime/15 blur-[90px]"
              aria-hidden="true"
            />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={transition.base}
                className="relative"
              >
                <p className="font-mono text-[12px] tracking-[0.08em] text-lime uppercase">
                  {current.moment}
                </p>
                <p className="mt-5 text-[clamp(1.2rem,2vw,1.6rem)] leading-[1.35] font-medium tracking-[-0.02em]">
                  {current.text}
                </p>
                <ol className="mt-9 flex flex-wrap items-center gap-2 text-[13.5px]">
                  {current.steps.map((s, i) => (
                    <li key={s} className="flex items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-white/80">
                        {s}
                      </span>
                      {i < current.steps.length - 1 && (
                        <ArrowRight className="size-3.5 text-white/30" aria-hidden="true" />
                      )}
                    </li>
                  ))}
                </ol>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <Reveal className="mt-4">
          <div className="relative h-[220px] overflow-hidden rounded-[20px]">
            <Photo
              src={pairAtDesk}
              alt="Two engineers at a desk, one wearing headphones"
              className="absolute inset-0 size-full object-[center_40%]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/40 to-transparent" />
            <p className="absolute top-1/2 left-7 max-w-[300px] -translate-y-1/2 text-[22px] leading-tight font-semibold tracking-[-0.025em] sm:left-10">
              Engineers and PMs, on the same switch.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------
// Docs: the quickstart, with the real SDK and REST calls.

const SNIPPETS = {
  sdk: {
    label: 'Node SDK',
    code: `import { FlagClient } from '@flagflow/flag-client';

const flags = new FlagClient({
  baseUrl: process.env.FLAGFLOW_URL,
  apiKey: process.env.FLAGFLOW_API_KEY, // server-side only
});
await flags.start(); // snapshot, then the live stream

if (flags.isEnabled('new_checkout', user.id)) {
  // show the new checkout
}`,
  },
  rest: {
    label: 'REST',
    code: `curl "$FLAGFLOW_URL/v1/flags/evaluate?userId=U001" \\
  -H "x-api-key: $FLAGFLOW_API_KEY"

# → { "version": 12,
#     "flags": { "dark_mode": true, "new_checkout": false } }`,
  },
} as const;

type SnippetKey = keyof typeof SNIPPETS;

function CodeBlock() {
  const [tab, setTab] = useState<SnippetKey>('sdk');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPETS[tab].code);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions); the code stays selectable.
    }
  };

  return (
    <div className="overflow-hidden rounded-[18px] border border-white/10 bg-[#0e1110]">
      <div className="flex items-center gap-1 border-b border-white/[0.07] px-2 py-2">
        <div role="tablist" aria-label="Snippet" className="flex gap-1">
          {(Object.keys(SNIPPETS) as SnippetKey[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                tab === key ? 'bg-white/[0.08] text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              {SNIPPETS[key].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          {copied ? (
            <Check className="size-3.5 text-lime" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-[1.7] text-white/80">
        <code>{SNIPPETS[tab].code}</code>
      </pre>
    </div>
  );
}

function Docs() {
  const links = [
    { label: 'OpenAPI spec', note: 'Every endpoint, as JSON', href: DOCS_URL, icon: FileJson },
    DEMO_URL
      ? { label: 'Live demo app', note: 'A customer app wired to six flags', href: DEMO_URL, icon: Rocket }
      : {
          label: 'Interactive preview',
          note: 'Flip a flag at the top of this page',
          href: '#demo',
          icon: Rocket,
        },
  ];
  return (
    <section
      id="docs"
      aria-labelledby="docs-title"
      className="scroll-mt-20 border-t border-white/[0.06] bg-ink py-24 text-white lg:py-32"
    >
      <div className="mx-auto grid max-w-[1080px] grid-cols-1 gap-12 px-4 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <Reveal>
          <Eyebrow>Docs</Eyebrow>
          <h2
            id="docs-title"
            className="mt-5 text-[clamp(2.1rem,4.2vw,3.4rem)] leading-[1.02] font-bold tracking-[-0.05em]"
          >
            Ten Lines to Your First Flag
          </h2>
          <p className="mt-5 max-w-[420px] text-lg leading-snug text-white/55">
            Create an org, copy the API key it shows you once, and check a flag from your server. Unknown
            flags and users are simply off.
          </p>
          <ul className="mt-8 space-y-2.5">
            {links.map(({ label, note, href, icon: Icon }) => {
              const external = href.startsWith('http');
              return (
                <li key={label}>
                  <a
                    href={href}
                    {...(external && { target: '_blank', rel: 'noreferrer' })}
                    className="group flex items-center gap-4 rounded-[14px] border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 transition-colors hover:border-lime/30 hover:bg-white/[0.04]"
                  >
                    <Icon className="size-5 text-lime" aria-hidden="true" />
                    <span>
                      <span className="block text-[15px] font-semibold">{label}</span>
                      <span className="block text-[13px] text-white/45">{note}</span>
                    </span>
                    {external && <span className="sr-only">(opens in a new tab)</span>}
                    <ArrowUpRight
                      className="ml-auto size-4 text-white/35 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-lime"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        </Reveal>
        <Reveal delay={0.08}>
          <CodeBlock />
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------
// FAQ: plain answers from PRODUCT.md, including what v1 does not do.

const FAQ = [
  {
    q: 'Do my end users need FlagFlow accounts?',
    a: 'No. You target them by the IDs your app already uses, such as U001. Only your team signs in to the dashboard.',
  },
  {
    q: 'How do changes reach my app so fast?',
    a: 'The SDK loads a snapshot of your rules, then follows a server-sent event stream. When you flip a flag, the change arrives in under a second and lookups run in memory.',
  },
  {
    q: "What happens if a flag doesn't exist or the stream drops?",
    a: 'Unknown flags and unknown users are off. The client keeps the last rules it had and reconnects on its own.',
  },
  {
    q: 'Can I keep my API key in the browser?',
    a: 'No. The org API key is for your server only. Admins can create and revoke keys in Settings, and each key is shown once.',
  },
  {
    q: 'Does FlagFlow do percentage rollouts or A/B tests?',
    a: 'Not in v1. Flags are on or off, for a target list or for all users. Percentage rollouts, experiments and per-environment flags are out of scope for now.',
  },
];

function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-20 bg-[#f4f5f2] py-24 text-ink lg:py-32"
    >
      <div className="mx-auto grid max-w-[1080px] grid-cols-1 gap-10 px-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <Eyebrow dark={false}>FAQ</Eyebrow>
          <h2
            id="faq-title"
            className="mt-5 text-[clamp(2.1rem,4vw,3.2rem)] leading-[1.02] font-bold tracking-[-0.05em]"
          >
            Questions, Answered Plainly
          </h2>
        </Reveal>
        <div className="divide-y divide-ink/10 border-y border-ink/10">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[18px] font-semibold tracking-[-0.015em] [&::-webkit-details-marker]:hidden">
                {q}
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink/[0.06] transition-[transform,background-color] duration-300 group-open:rotate-45 group-open:bg-lime">
                  <Plus className="size-4" aria-hidden="true" />
                </span>
              </summary>
              <p className="max-w-[600px] pb-6 text-[15.5px] leading-relaxed text-ink/65">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------
// Closing call to action and footer.

type FooterLink = { label: string; href: string; external?: boolean } | { label: string; to: string };

const FOOTER_LINKS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Product',
    links: [
      ...NAV.filter((n) => n.id !== 'docs').map((n) => ({ label: n.label, href: `#${n.id}` })),
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Quickstart', href: '#docs' },
      { label: 'OpenAPI spec', href: DOCS_URL, external: true },
      DEMO_URL
        ? { label: 'Live demo', href: DEMO_URL, external: true }
        : { label: 'Interactive preview', href: '#demo' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Get started', to: '/register' },
      { label: 'Sign in', to: '/login' },
    ],
  },
];

function Footer() {
  const linkClass =
    'inline-flex items-center gap-1 text-[15px] text-white/60 transition-colors hover:text-white';
  const toTop = () => {
    window.scrollTo({
      top: 0,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    // Move focus with the view, so keyboard users continue from the top too.
    document.querySelector<HTMLElement>('header a')?.focus({ preventScroll: true });
  };

  return (
    <footer className="relative overflow-hidden bg-ink text-white">
      <div className="mx-auto max-w-[1080px] px-4 pt-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[24px] bg-lime px-7 py-12 text-ink sm:px-12 sm:py-14">
            <div
              className="pointer-events-none absolute -right-10 -bottom-24 size-[320px] rounded-full border-[40px] border-ink/[0.06]"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute right-24 -bottom-40 size-[320px] rounded-full border-[40px] border-ink/[0.04]"
              aria-hidden="true"
            />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-[clamp(2rem,4vw,3.3rem)] leading-[1.02] font-bold tracking-[-0.05em]">
                  Turn On Your First Flag Today
                </h2>
                <p className="mt-4 max-w-[420px] text-lg leading-snug text-ink/70">
                  Create an org, copy your API key, and change what users see without a redeploy.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="inline-flex h-12 items-center gap-2 rounded-[10px] bg-ink px-5 text-lg font-semibold text-white transition-transform active:translate-y-px"
                >
                  Get started free
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex h-12 items-center rounded-[10px] border border-ink/20 px-5 text-lg font-semibold transition-colors hover:bg-ink/[0.06]"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-12 pt-20 pb-14 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-[280px] text-[15px] leading-snug text-white/50">
              Feature flags for small SaaS teams. Live changes, no redeploys.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {FOOTER_LINKS.map(({ title, links }) => (
              <div key={title}>
                <h3 className="font-mono text-[12px] tracking-[0.08em] text-white/40 uppercase">{title}</h3>
                <ul className="mt-5 space-y-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      {'to' in link ? (
                        <Link to={link.to} className={linkClass}>
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          {...(link.external && { target: '_blank', rel: 'noreferrer' })}
                          className={linkClass}
                        >
                          {link.label}
                          {link.external && (
                            <>
                              <ArrowUpRight className="size-3.5" aria-hidden="true" />
                              <span className="sr-only">(opens in a new tab)</span>
                            </>
                          )}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/[0.08] py-7 text-[14px] text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} FlagFlow</p>
          <button
            type="button"
            onClick={toTop}
            className="inline-flex items-center gap-2 self-start rounded-lg py-1 text-white/70 transition-colors hover:text-lime sm:self-auto"
          >
            Back to top
            <ArrowUp className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  // Arriving from another page with a hash (e.g. /#docs from the sign-in page), the browser tried to scroll
  // before this page had rendered. Scroll once it has.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  return (
    <div className="landing relative z-10 min-h-dvh bg-ink font-display">
      <SiteHeader />
      <main>
        <div className="relative overflow-hidden">
          {/* Decoration: a dot grid fading out, a lime glow behind the preview, two sparkles. */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_20%,#000,transparent)]" />
            <div className="absolute top-[45%] left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-lime/[0.13] blur-[140px]" />
          </div>
          <div className="hidden md:block">
            <Sparkle className="top-[11%] left-[7%] size-20" />
            <Sparkle className="top-[24%] right-[9%] size-24" />
          </div>
          <Hero />
          <StackRow />
        </div>
        <Product />
        <HowItWorks />
        <UseCases />
        <Docs />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}

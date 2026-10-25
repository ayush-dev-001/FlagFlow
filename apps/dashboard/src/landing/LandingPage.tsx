import {
  ArrowRight,
  Asterisk,
  Box,
  CircleCheck,
  Code2,
  Component,
  Diamond,
  Database,
  History,
  LifeBuoy,
  Layers,
  Play,
  Power,
  Radio,
  Rocket,
  Scan,
  Server,
  ShieldCheck,
  Siren,
  UsersRound,
  Zap,
} from 'lucide-react';
import {
  AnimatePresence,
  type MotionStyle,
  type MotionValue,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { type CSSProperties, type ReactNode, type RefObject, useRef, useState } from 'react';
import { Link } from 'react-router';
import { SiteHeader as Header, Sparkle } from '../site/SiteChrome';
import { EASE_OUT } from '../ui/motion';
import onCall from './images/on-call.webp';
import pairAtDesk from './images/pair-at-desk.webp';
import teamAtMonitor from './images/team-at-monitor.webp';
import teamTable from './images/team-table.webp';

// The public home page. It carries its own lime-on-black palette (scoped to .landing in index.css)
// and covers the dashboard's global backdrop with an opaque ground. The dark hero ends below the card
// row, and the page continues on white.

/** Staggered entrance; MotionConfig in main.tsx drops the transform under reduced motion. */
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
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Photos are shown in greyscale so they sit in the lime-and-black palette. */
function Photo({
  src,
  alt,
  eager = false,
  className = '',
}: {
  src: string;
  alt: string;
  /** For photos in the first screen, which should not wait for lazy loading. */
  eager?: boolean;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={`object-cover grayscale ${className}`}
    />
  );
}

function Hero() {
  return (
    <section className="relative z-10 shrink-0 px-4 pt-24 text-center lg:pt-[6.3vh]">
      <Reveal>
        <a
          href="#how"
          className="inline-flex items-center gap-2.5 rounded-full border border-white/5 bg-white/[0.05] py-1.5 pr-4 pl-1.5 text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.08]"
        >
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[13px] text-ink">New</span>
          Live updates in under a second
          <ArrowRight className="size-4" aria-hidden="true" />
        </a>
      </Reveal>

      <Reveal delay={0.08}>
        <h1 className="mx-auto mt-10 max-w-[882px] text-[clamp(2.25rem,min(5.76vw,8.1vh),4.725rem)] lg:mt-[3.6vh] leading-[1.02] font-bold tracking-[-0.055em] text-white">
          Ship Features
          <br />
          Without Redeploying
        </h1>
      </Reveal>

      <Reveal delay={0.16}>
        <p className="mx-auto mt-7 max-w-[468px] text-lg lg:mt-[2.25vh] text-white/55">
          Turn a feature on for the users you pick, widen it to everyone, or switch it off when something
          breaks.
        </p>
      </Reveal>

      <Reveal delay={0.24} className="mt-10 flex flex-wrap items-center justify-center gap-4 lg:mt-[3.6vh]">
        <Link
          to="/register"
          className="inline-flex h-[49px] items-center gap-2 rounded-[9px] bg-lime px-5 text-lg font-semibold text-ink transition-[filter,transform] hover:brightness-110 active:translate-y-px"
        >
          Get started
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <a
          href="#demo"
          className="inline-flex h-[49px] items-center gap-2.5 rounded-[9px] bg-white/[0.05] px-5 text-lg font-semibold text-white transition-colors hover:bg-white/[0.09]"
        >
          <span className="flex size-[20px] items-center justify-center rounded-full bg-white">
            <Play className="size-2.5 translate-x-px fill-ink text-ink" aria-hidden="true" />
          </span>
          Watch demo
        </a>
      </Reveal>
    </section>
  );
}

// Cards share a bottom edge; from lg up their heights step down towards the middle (356 / 270 / 220).
const card = 'relative h-[270px] overflow-hidden rounded-[20px]';
const darkCard = `${card} bg-gradient-to-b from-[#2a2c2b] via-[#1a1c1b] to-[#5b5e5c]`;

/** The V-shaped row of five cards under the hero. */
function Showcase() {
  return (
    <section
      id="product"
      aria-label="What FlagFlow does"
      className="relative z-10 mx-auto mt-10 grid w-full max-w-[1116px] grid-cols-1 gap-5 px-4 pb-10 sm:grid-cols-2 lg:mt-[4.5vh] lg:grid-cols-5 lg:items-end"
    >
      {/* 1 — team photo */}
      <Reveal delay={0.32} className="relative">
        <div className={`${card} bg-[#1b1d1c] lg:h-[320px]`}>
          <Photo
            src={pairAtDesk}
            eager
            alt="Two engineers at a desk, one wearing headphones"
            className="absolute inset-0 size-full"
          />
        </div>
        {/* Sits across the top corner of card 2, which starts 86px lower. */}
        <span className="absolute top-[59px] -right-6 z-10 hidden items-center gap-2 rounded-full bg-white px-4 py-2 text-[14px] font-medium text-ink shadow-[0_10px_30px_rgb(0_0_0/0.4)] lg:inline-flex">
          <span className="size-3 rounded-[2px] bg-ink" aria-hidden="true" />
          Engineering team
        </span>
      </Reveal>

      {/* 2 — propagation stat */}
      <Reveal delay={0.38}>
        <div
          className={`${card} flex flex-col items-center justify-center bg-white px-6 text-center lg:h-[243px]`}
        >
          <p className="text-[40px] leading-none tracking-tight text-ink">&lt;1s</p>
          <p className="mt-3 text-[14px] leading-snug text-ink/60">
            From a toggle in the dashboard
            <br />
            to every running app
          </p>
        </div>
      </Reveal>

      {/* 3 — targeting */}
      <Reveal delay={0.44}>
        <div id="how" className={`${darkCard} lg:h-[198px]`}>
          <h2 className="relative z-10 p-5 text-2xl leading-tight font-semibold tracking-tight text-white">
            Target by Your Own User IDs
          </h2>
          <ul
            className="absolute right-4 bottom-4 left-4 flex gap-2 font-mono text-sm"
            aria-label="Example targets"
          >
            {['U001', 'U017'].map((id) => (
              <li
                key={id}
                className="flex flex-1 items-center justify-between rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-white/85 backdrop-blur"
              >
                {id}
                <span
                  className="size-2 rounded-full bg-lime shadow-[0_0_10px_var(--color-lime)]"
                  aria-label="on"
                />
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      {/* 4 — rollout stages */}
      <Reveal delay={0.5}>
        <div className={`${darkCard} lg:h-[243px]`}>
          <h2 className="p-5 text-2xl leading-tight font-semibold tracking-tight text-white">
            Inactive, Testing, Live
          </h2>
          <div className="absolute right-4 bottom-4 left-4 flex h-[117px] items-end gap-3" aria-hidden="true">
            <div className="h-[52%] flex-1 rounded-lg bg-white/10" />
            <div className="h-[34%] flex-1 rounded-lg bg-white/10" />
            <div className="h-full flex-1 rounded-lg bg-lime" />
            <div className="h-[48%] flex-1 rounded-lg bg-white/10" />
          </div>
        </div>
      </Reveal>

      {/* 5 — no redeploys */}
      <Reveal delay={0.56} className="sm:col-span-2 lg:col-span-1">
        <div id="demo" className={`${card} bg-white lg:h-[320px]`}>
          <div className="p-6">
            <p className="text-[40px] leading-none tracking-tight text-ink">0</p>
            <p className="mt-3 text-[14px] text-ink/60">Redeploys to change who sees a feature</p>
            <div className="mt-5 flex flex-wrap gap-1.5 font-mono">
              {['dark_mode', 'new_checkout'].map((key) => (
                <span key={key} className="rounded-full bg-ink px-3.5 py-2 text-[13px] text-lime">
                  {key}
                </span>
              ))}
            </div>
          </div>
          <Photo
            src={teamAtMonitor}
            eager
            alt="A team gathered around a monitor"
            className="absolute right-0 bottom-0 left-0 h-[108px] w-full object-[center_30%]"
          />
        </div>
      </Reveal>
    </section>
  );
}

const ABOUT =
  "At FlagFlow, we believe shipping a feature shouldn't mean shipping a deploy. We built a flag service for small SaaS teams that puts every release in your hands: turn it on for a few users by their own IDs, widen it to everyone, or switch it off the moment something breaks, and every running app hears about it in under a second.";

function Word({
  progress,
  range,
  children,
}: {
  progress: MotionValue<number>;
  range: [number, number];
  children: string;
}) {
  const color = useTransform(progress, range, ['#b8bbb9', '#0b0d0c']);
  return <motion.span style={{ color }}>{children} </motion.span>;
}

/** Words darken one by one as the paragraph scrolls through the viewport. */
function ScrollRevealText({ text, className }: { text: string; className: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.55'] });
  if (reduced) {
    return (
      <p ref={ref} className={`${className} text-ink`}>
        {text}
      </p>
    );
  }

  const words = text.split(' ');
  return (
    <p ref={ref} className={className}>
      {words.map((word, i) => (
        <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
          {word}
        </Word>
      ))}
    </p>
  );
}

function About() {
  return (
    <section
      id="about"
      aria-labelledby="about-label"
      className="mx-auto flex max-w-[1116px] flex-col justify-center px-4 py-20 lg:min-h-dvh lg:py-[7.2vh]"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_2.5fr] lg:gap-10">
        <h2
          id="about-label"
          className="flex items-center gap-2.5 self-start text-[clamp(1.35rem,1.8vw,1.8rem)] leading-none font-semibold tracking-[-0.03em] text-ink lg:pt-1.5"
        >
          <span className="size-3 rounded-[3px] bg-lime" aria-hidden="true" />
          About FlagFlow
        </h2>
        <ScrollRevealText
          text={ABOUT}
          className="text-[clamp(1.35rem,min(2.25vw,3.78vh),2.25rem)] leading-[1.2] font-normal tracking-[-0.02em]"
        />
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:mt-[6.3vh] lg:grid-cols-[1fr_1fr_0.85fr]">
        <Photo
          src={teamTable}
          alt="Four teammates working around a shared table"
          className="h-[270px] w-full rounded-[20px] lg:h-[clamp(198px,32.4vh,342px)]"
        />
        <Photo
          src={onCall}
          alt="Two engineers pointing at a screen together"
          className="h-[270px] w-full rounded-[20px] object-[center_35%] lg:h-[clamp(198px,32.4vh,342px)]"
        />
        <div className="flex flex-col items-start justify-end gap-5 pt-4 md:col-span-2 lg:col-span-1 lg:pl-2">
          <h3 className="text-2xl leading-snug font-medium tracking-[-0.02em] text-ink">
            Built for the Team
            <br />
            on Call
          </h3>
          <Link
            to="/register"
            className="inline-flex h-[47px] items-center gap-2 rounded-[9px] bg-lime px-5 text-lg font-semibold text-ink transition-[filter,transform] hover:brightness-105 active:translate-y-px"
          >
            Learn more
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// The real stack from PLAN.md. FlagFlow has no customers yet, so this strip names what it runs on.
const STACK = [
  { label: 'Node.js', icon: Server },
  { label: 'PostgreSQL', icon: Database },
  { label: 'Redis', icon: Layers },
  { label: 'Prisma', icon: Box },
  { label: 'Server-Sent Events', icon: Radio },
  { label: 'React', icon: Code2 },
  { label: 'TypeScript', icon: Code2 },
];

const FEATURES = [
  {
    icon: UsersRound,
    title: 'Target by User ID',
    body: 'Turn a flag on for U001 and U017 using the IDs your app already has.',
  },
  {
    icon: Zap,
    title: 'Live in Under a Second',
    body: 'Changes stream to every running app. No redeploy, no polling.',
  },
  {
    icon: Power,
    title: 'Switch It Off Fast',
    body: 'Something broke? Turn the flag off and the feature is gone for everyone.',
  },
  {
    icon: History,
    title: 'Every Change on Record',
    body: 'The audit log keeps who changed what and when, for every flag.',
  },
];

function StackMarquee() {
  // Two copies so the strip can loop; the second is hidden from screen readers.
  const items = (hidden: boolean) =>
    STACK.map(({ label, icon: Icon }) => (
      <li key={label} aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-2.5 px-10">
        <Icon className="size-5" aria-hidden="true" />
        <span className="text-xl font-semibold tracking-[-0.02em]">{label}</span>
      </li>
    ));
  return (
    <div className="mask-[linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)] overflow-hidden text-white/45">
      <ul className="marquee-track">
        {items(false)}
        {items(true)}
      </ul>
    </div>
  );
}

function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="flex flex-col justify-center bg-ink py-20 text-white lg:min-h-dvh lg:py-[6.3vh]"
    >
      <div className="mx-auto w-full max-w-[1116px] px-4">
        <p className="flex items-center justify-center gap-2.5 text-[14px] text-white/60">
          <span className="size-3 rounded-[2px] bg-lime" aria-hidden="true" />
          Built on
        </p>
      </div>
      <div className="mx-auto mt-8 w-full max-w-[1116px] lg:mt-[3.6vh]">
        <StackMarquee />
      </div>

      <div className="mx-auto mt-20 w-full max-w-[1116px] px-4 lg:mt-[8.1vh]">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="features-title"
            className="text-[clamp(2.25rem,min(4.32vw,7.2vh),4.05rem)] leading-[1.02] font-bold tracking-[-0.055em]"
          >
            Everything
            <br />a Rollout Needs
          </h2>
          <div className="max-w-[270px] lg:pb-2">
            <p className="text-lg leading-snug text-white/55">
              Turn it on, widen it, or switch it off, and always know who did it.
            </p>
            <Link
              to="/register"
              className="mt-5 inline-flex h-[47px] items-center gap-2 rounded-[9px] bg-lime px-5 text-lg font-semibold text-ink transition-[filter,transform] hover:brightness-110 active:translate-y-px"
            >
              Get started
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-[5.4vh] lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="feature-card group relative flex h-[252px] flex-col overflow-hidden rounded-[16px] bg-[#161918] p-7 lg:h-[clamp(270px,36vh,369px)]"
            >
              <Icon
                className="relative size-8 stroke-[1.5] text-white transition-colors duration-500 group-hover:text-ink"
                aria-hidden="true"
              />
              <h3 className="relative mt-7 max-w-[11ch] text-[27px] leading-[1.15] font-medium tracking-[-0.025em] text-white transition-colors duration-500 group-hover:text-ink">
                {title}
              </h3>
              <p className="relative mt-auto text-[15px] leading-snug text-white/60 transition-colors duration-500 group-hover:text-ink/65">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// Placeholder prices: billing is out of scope for v1 (PRODUCT.md), so these are for the owner to set.
// Every listed feature exists in the product today; only the limits are placeholders too.
const PLANS = [
  {
    name: 'Starter',
    icon: Diamond,
    monthly: 0,
    yearly: 0,
    blurb: 'For a side project or trying FlagFlow out on one app',
    featured: false,
    features: [
      'Up to 10 flags',
      'Up to 3 teammates',
      'Target by your own user IDs',
      'Live updates in under a second',
      'Audit log for every change',
    ],
  },
  {
    name: 'Team',
    icon: Scan,
    monthly: 49,
    yearly: 39,
    blurb: 'For a team rolling out features to customers every week',
    featured: true,
    features: [
      'Unlimited flags',
      'Up to 25 teammates',
      'Admin and member roles',
      'Email invites for new teammates',
      'End-user lookup by ID',
    ],
  },
  {
    name: 'Business',
    icon: Component,
    monthly: 149,
    yearly: 119,
    blurb: 'For larger orgs running FlagFlow across several apps',
    featured: false,
    features: [
      'Everything in Team',
      'Unlimited teammates',
      'Multiple API keys',
      'Full audit history',
      'Priority email support',
    ],
  },
];

type Billing = 'monthly' | 'yearly';

function BillingToggle({ value, onChange }: { value: Billing; onChange: (next: Billing) => void }) {
  return (
    <div role="group" aria-label="Billing period" className="inline-flex rounded-[11px] bg-[#1c1f1e] p-1">
      {(['monthly', 'yearly'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`relative h-[40px] rounded-[8px] px-5 text-base font-semibold capitalize transition-colors ${
            value === option ? 'text-ink' : 'text-white hover:text-white/75'
          }`}
        >
          {value === option && (
            <motion.span
              layoutId="billing-pill"
              className="absolute inset-0 rounded-[8px] bg-lime"
              transition={{ duration: 0.4, ease: EASE_OUT }}
            />
          )}
          <span className="relative">{option}</span>
        </button>
      ))}
    </div>
  );
}

function Pricing() {
  const [billing, setBilling] = useState<Billing>('monthly');

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="relative overflow-hidden bg-ink pt-20 pb-24 text-white lg:pt-[10.8vh] lg:pb-[3.6vh]"
    >
      {/* The giant faint word behind the heading. */}
      <p
        aria-hidden="true"
        className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 text-[25vw] leading-none font-bold tracking-[-0.06em] whitespace-nowrap text-white/[0.03] select-none lg:top-[1.8vh]"
      >
        PRICING
      </p>

      <div className="relative mx-auto w-full max-w-[1116px] px-4">
        <div className="flex flex-col items-center text-center">
          <Reveal>
            <span className="inline-flex h-[38px] items-center rounded-full border border-lime/60 px-4 text-[15px] font-medium text-lime">
              Our plans
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h2
              id="pricing-title"
              className="mt-5 text-[clamp(2.025rem,min(4.14vw,6.75vh),3.825rem)] leading-[1.04] font-bold tracking-[-0.055em]"
            >
              Simple Pricing
              <br />
              for Any Size of Team
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-4 max-w-[423px] text-base leading-snug text-white/55">
              Start free on one app and upgrade when your team grows. Every plan streams changes live.
            </p>
          </Reveal>
        </div>

        {/* The plans fill a viewport of their own, so scrolling to them shows only the toggle and cards. */}
        <div className="flex flex-col justify-center pt-12 lg:min-h-dvh lg:py-[4.5vh]">
          <div className="flex justify-center">
            <BillingToggle value={billing} onChange={setBilling} />
          </div>

          <ul className="mx-auto mt-8 grid w-full max-w-[972px] gap-4 lg:mt-[3.6vh] lg:grid-cols-3">
            {PLANS.map(({ name, icon: Icon, monthly, yearly, blurb, features, featured }) => {
              const price = billing === 'monthly' ? monthly : yearly;
              return (
                <li
                  key={name}
                  className={`flex flex-col rounded-[18px] p-6 ${
                    featured
                      ? 'bg-[linear-gradient(to_bottom,#151817_38%,#5f7d2c_82%,#93b44f)]'
                      : 'bg-[#151817]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid size-[47px] shrink-0 place-items-center rounded-[11px] bg-white/[0.08]">
                      <Icon className="size-6 stroke-[1.5]" aria-hidden="true" />
                    </span>
                    <p className="flex items-baseline gap-1.5 pt-2">
                      {/* The number rolls up when the billing period changes. */}
                      <span className="inline-grid overflow-hidden text-[31px] whitespace-nowrap leading-none font-semibold tracking-[-0.04em]">
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span
                            key={price}
                            initial={{ y: '100%', opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: '-100%', opacity: 0 }}
                            transition={{ duration: 0.45, ease: EASE_OUT }}
                          >
                            ${price}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                      <span className="text-base tracking-[-0.02em] text-white/55">/per month</span>
                    </p>
                  </div>

                  <h3 className="mt-6 text-[22px] font-semibold tracking-[-0.03em]">{name}</h3>
                  <p className="mt-1.5 max-w-[297px] text-[14px] leading-snug text-white/55">{blurb}</p>
                  <p className="mt-1 h-5 text-sm text-white/40">
                    {billing === 'yearly' && price > 0 ? `Billed yearly at $${price * 12}` : ''}
                  </p>

                  <Link
                    to="/register"
                    className={`mt-4 inline-flex h-[41px] items-center justify-center gap-2 rounded-[9px] text-lg font-semibold text-ink transition-[filter,transform] active:translate-y-px ${
                      featured ? 'bg-lime hover:brightness-110' : 'bg-white hover:brightness-90'
                    }`}
                  >
                    Get started
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>

                  <h4 className="mt-7 text-[17px] font-semibold tracking-[-0.02em]">Features</h4>
                  <ul className="mt-4 space-y-3.5">
                    {features.map((feature) => (
                      <li
                        key={feature}
                        className={`flex items-center gap-3 text-[14px] ${featured ? 'text-white' : 'text-white/60'}`}
                      >
                        <CircleCheck className="size-5 shrink-0 stroke-[1.5]" aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

// Real numbers from how FlagFlow works (PRODUCT.md), not usage metrics it doesn't have yet.
const STATS = [
  {
    value: '<1',
    unit: 'Second',
    body: 'The longest a flag change takes to reach every running copy of your app.',
    tone: 'bg-lime text-ink',
    muted: 'text-ink/80',
  },
  {
    value: '0',
    unit: 'Redeploys',
    body: 'To turn a feature on for one user, a hundred, or everyone.',
    tone: 'bg-white text-ink',
    muted: 'text-ink/55',
  },
  {
    value: '48',
    unit: 'h',
    body: "Before an invite link expires, so an old email can't let anyone in.",
    tone: 'bg-[#151817] text-white',
    muted: 'text-white/80',
  },
];

// Where each pill lands in the strip at the bottom, as % of the strip.
const PILLS = [
  { label: 'No Redeploys', tone: 'bg-white text-ink', left: '2%', bottom: '16%', rotate: 13 },
  { label: 'Live Updates', tone: 'bg-lime text-ink', left: '15%', bottom: '6%', rotate: -27 },
  { label: 'Per-User Targeting', tone: 'bg-white text-ink', left: '27%', bottom: '3%', rotate: 4 },
  { label: 'End-User Lookup', tone: 'bg-flame text-white', left: '46%', bottom: '4%', rotate: -6 },
  { label: 'SSE Stream', tone: 'bg-white text-ink', left: '63%', bottom: '10%', rotate: 14 },
  { label: 'Audit Log', tone: 'bg-lime text-ink', left: '83%', bottom: '14%', rotate: 9 },
  { label: 'Kill Switch', tone: 'bg-flame text-white', left: '29%', bottom: '42%', rotate: 8 },
  { label: 'Roles and Invites', tone: 'bg-lime text-ink', left: '52%', bottom: '40%', rotate: -10 },
  { label: 'Under a Second', tone: 'bg-white text-ink', left: '71%', bottom: '46%', rotate: -5 },
];

/** Lands, bounces twice and settles: the standard bounce-out curve. */
function bounceOut(t: number) {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t - 1.5 / d) ** 2 + 0.75;
  if (t < 2.5 / d) return n * (t - 2.25 / d) ** 2 + 0.9375;
  return n * (t - 2.625 / d) ** 2 + 0.984375;
}

/**
 * One pill whose fall is tied to the scroll: scrolling down drops it into the pile, scrolling up lifts
 * it back out. The outer element carries the fall; the inner one can be dragged without fighting it.
 */
function FallingPill({
  pill,
  index,
  progress,
  bounds,
  canDrag,
}: {
  pill: (typeof PILLS)[number];
  index: number;
  progress: MotionValue<number>;
  bounds: RefObject<HTMLDivElement | null>;
  canDrag: boolean;
}) {
  const reduce = useReducedMotion();
  const { label, tone, left, bottom, rotate } = pill;
  // Each pill gets its own slice of the scroll, staggered so they land one after another.
  const start = 0.3 + index * 0.045;
  const end = start + 0.3;
  const y = useTransform(progress, [start, end], [-560, 0], { ease: bounceOut });
  const spin = useTransform(progress, [start, end], [rotate + (index % 2 ? 60 : -60), rotate]);
  const opacity = useTransform(progress, [start, start + 0.04], [0, 1]);

  return (
    <motion.li
      style={reduce ? { left, bottom, rotate } : { left, bottom, y, rotate: spin, opacity }}
      className="absolute"
    >
      <motion.span
        drag={canDrag}
        dragConstraints={bounds}
        dragElastic={0.15}
        whileHover={canDrag ? { scale: 1.06 } : undefined}
        className={`block rounded-full px-5 py-2.5 text-[14px] font-semibold tracking-[-0.01em] whitespace-nowrap shadow-[0_10px_30px_rgb(0_0_0/0.25)] select-none sm:px-9 sm:py-4 sm:text-lg ${
          canDrag ? 'cursor-grab active:cursor-grabbing' : ''
        } ${tone}`}
      >
        {label}
      </motion.span>
    </motion.li>
  );
}

/** The flex weight of each stat card: the hovered one widens, the first keeps a wide resting width. */
function statGrow(index: number, active: number) {
  if (index === active) return 1.85;
  return index === 0 ? 1.75 : 1;
}

function Numbers() {
  // The middle card starts wide; hovering another card hands the extra width to it.
  const [active, setActive] = useState(1);
  const pillsRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  // 0 when the section starts entering the screen, 1 once its bottom reaches the bottom of the screen.
  // The spring adds a little weight so the pills don't stop dead when scrolling stops.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end end'] });
  const fall = useSpring(scrollYProgress, { stiffness: 140, damping: 24, restDelta: 0.001 });
  // Dragging pills is a pointer toy; on touch it would swallow the page scroll.
  const [canDrag] = useState(() => typeof window !== 'undefined' && matchMedia('(hover: hover)').matches);

  return (
    <section
      ref={sectionRef}
      id="numbers"
      aria-labelledby="numbers-title"
      className="relative flex flex-col overflow-hidden bg-ink pt-20 text-white lg:min-h-dvh lg:pt-[6.3vh]"
    >
      {/* Lime glow in the lower left, a pale one in the lower right. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -bottom-48 -left-40 size-[558px] rounded-full bg-lime/55 blur-[126px]" />
        <div className="absolute -right-40 -bottom-56 size-[468px] rounded-full bg-white/40 blur-[126px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1116px] px-4">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <h2
            id="numbers-title"
            className="text-[clamp(2.25rem,min(5.4vw,9vh),5.4rem)] leading-[1.02] font-bold tracking-[-0.055em]"
          >
            The Numbers
            <br />
            Behind FlagFlow
          </h2>
          <div className="max-w-[297px] lg:pt-[2.7vh]">
            <p className="text-lg leading-snug text-white/55">
              Small numbers, on purpose. They come from how the product works, not from a sales deck.
            </p>
            <Link
              to="/register"
              className="mt-5 inline-flex h-[47px] items-center gap-2 rounded-[9px] bg-lime px-5 text-lg font-semibold text-ink transition-[filter,transform] hover:brightness-110 active:translate-y-px"
            >
              Get started
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <ul className="mt-12 flex flex-col gap-4 lg:mt-[5.4vh] lg:flex-row" onMouseLeave={() => setActive(1)}>
          {STATS.map(({ value, unit, body, tone, muted }, i) => (
            <li
              key={unit}
              onMouseEnter={() => setActive(i)}
              style={{ '--grow': statGrow(i, active) } as CSSProperties}
              className={`flex h-[270px] min-w-0 flex-col rounded-[20px] p-8 transition-[flex-grow] duration-700 ease-(--ease-out-expo) motion-reduce:transition-none lg:h-[clamp(270px,36vh,378px)] lg:basis-0 lg:grow-(--grow) lg:p-10 ${tone}`}
            >
              <p className="flex items-start leading-none">
                <span className="text-[clamp(4.5rem,7.2vw,7.65rem)] font-medium tracking-[-0.06em]">
                  {value}
                </span>
                <span className="mt-[0.1em] ml-2 text-[clamp(1.575rem,2.52vw,2.7rem)] font-medium tracking-[-0.04em]">
                  {unit}
                </span>
              </p>
              <p className={`mt-auto max-w-[414px] text-[15px] leading-snug ${muted}`}>{body}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* The pills fall into a pile as the page scrolls; with a mouse they can be dragged around. */}
      <div
        ref={pillsRef}
        className="relative mx-auto mt-10 h-[216px] w-full max-w-[1116px] lg:mt-auto lg:h-[21.6vh]"
      >
        <ul aria-label="What FlagFlow is about">
          {PILLS.map((pill, i) => (
            <FallingPill
              key={pill.label}
              pill={pill}
              index={i}
              progress={fall}
              bounds={pillsRef}
              canDrag={canDrag}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

// FlagFlow has no customers to quote yet, so these cards are scenarios from the people in PRODUCT.md,
// written as what happens, not as reviews from named people.
const STORIES = [
  {
    text: 'Checkout starts throwing errors at 2am. You switch new_checkout off, and it is gone from every running app in under a second. No hotfix, no redeploy.',
    role: 'On-call engineer',
    moment: 'Switching off a broken feature',
    icon: Siren,
    tone: 'bg-ink text-white',
    muted: 'text-white/55',
    badge: 'bg-white/10 text-white',
    tilt: 0,
  },
  {
    text: 'A customer says the new dashboard looks wrong. You search for U001, see exactly which flags they get, and turn one off just for them.',
    role: 'Support and product',
    moment: "Debugging one user's report",
    icon: LifeBuoy,
    tone: 'bg-white text-ink shadow-[0_20px_80px_rgb(0_0_0/0.12)]',
    muted: 'text-ink/55',
    badge: 'bg-ink/[0.06] text-ink',
    tilt: -4,
  },
  {
    text: 'The beta goes to five friendly customers first. You add their user IDs to the flag, watch it for a week, then turn it on for all users.',
    role: 'Product manager',
    moment: 'Rolling out to a few users first',
    icon: Rocket,
    tone: 'bg-iris text-white',
    muted: 'text-white/80',
    badge: 'bg-white/15 text-white',
    tilt: 4,
  },
  {
    text: 'A flag was turned on Friday and nobody remembers doing it. The audit log shows who changed it, what changed, and when.',
    role: 'Team admin',
    moment: 'Finding out who changed what',
    icon: ShieldCheck,
    tone: 'bg-lime text-ink',
    muted: 'text-ink/65',
    badge: 'bg-ink/10 text-ink',
    tilt: -3,
  },
];

/** A blocky closing quote mark, drawn on a pixel grid like the reference. */
function QuoteMark() {
  return (
    <svg viewBox="0 0 12 9" className="h-10 w-auto fill-current" aria-hidden="true">
      <path d="M0 0h4v4H2v2H0zM2 6h2v3H2zM0 7h1v2H0z" />
      <path d="M7 0h4v4H9v2H7zM9 6h2v3H9zM7 7h1v2H7z" />
    </svg>
  );
}

function StoryCard({ story, index }: { story: (typeof STORIES)[number]; index: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const reduce = useReducedMotion();
  // Tilted while it rises, flat by the time it reaches the stack.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 0.35'] });
  const rotate = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : story.tilt, 0]);
  const { text, role, moment, icon: Icon, tone, muted, badge } = story;

  return (
    <motion.li
      ref={ref}
      // Each card sticks a little lower than the last, so the edges of the stack show.
      style={{ rotate, zIndex: index + 1, '--stack': `${index * 14}px` } as MotionStyle}
      className={`sticky top-[calc(5.4rem+var(--stack))] rounded-[22px] p-8 sm:p-12 lg:top-[calc(27.9vh+var(--stack))] ${tone}`}
    >
      <QuoteMark />
      <blockquote className="mt-8 text-[clamp(1.08rem,1.71vw,1.53rem)] leading-[1.35] font-semibold tracking-[-0.02em]">
        {text}
      </blockquote>
      <div className="mt-9 flex items-center gap-4">
        <span className={`grid size-14 shrink-0 place-items-center rounded-full ${badge}`}>
          <Icon className="size-6 stroke-[1.6]" aria-hidden="true" />
        </span>
        <span>
          <span className="block text-xl font-medium tracking-[-0.02em]">{role}</span>
          <span className={`block text-[15px] ${muted}`}>{moment}</span>
        </span>
      </div>
    </motion.li>
  );
}

function Stories() {
  return (
    <section
      id="stories"
      aria-labelledby="stories-title"
      className="relative bg-white pt-24 pb-24 text-ink lg:pt-[10.8vh] lg:pb-[27vh]"
    >
      {/* On desktop the heading stays put while the cards stack up beneath it. */}
      <div className="mx-auto max-w-[1116px] px-4 text-center lg:sticky lg:top-[2.7vh]">
        <h2
          id="stories-title"
          className="text-[clamp(2.25rem,min(4.86vw,7.65vh),4.95rem)] leading-[1.02] font-bold tracking-[-0.055em]"
        >
          Real Teams, Real
          <br />
          Rollout Moments
        </h2>
        <p className="mx-auto mt-4 max-w-[387px] text-[15px] leading-snug text-ink/55">
          What a normal week with FlagFlow looks like for each person on the team.
        </p>
      </div>

      <ul className="mx-auto mt-12 flex max-w-[810px] flex-col gap-[19.8vh] px-4 lg:mt-[4.5vh]">
        {STORIES.map((story, i) => (
          <StoryCard key={story.role} story={story} index={i} />
        ))}
      </ul>
    </section>
  );
}

const STRIP_WORDS = ["Let's Get Started", 'Ship Without Redeploying'];

/** One tilted band of text that scrolls forever; the copy repeats so the loop has no seam. */
function MarqueeStrip({ tone, className, reverse }: { tone: string; className: string; reverse?: boolean }) {
  const run = Array.from({ length: 4 }, () => STRIP_WORDS).flat();
  const items = (hidden: boolean) =>
    run.map((word, i) => (
      <li key={`${hidden}-${i}`} className="flex shrink-0 items-center gap-10 pr-10">
        <span className="text-[clamp(1.44rem,2.7vw,2.475rem)] font-semibold tracking-[-0.035em] whitespace-nowrap">
          {word}
        </span>
        <Asterisk className="size-6 stroke-[2.5] opacity-80 lg:size-8" />
      </li>
    ));
  return (
    <div className={`absolute left-[-10%] w-[120%] py-4 lg:py-6 ${tone} ${className}`}>
      <ul className={`marquee-track ${reverse ? 'marquee-reverse' : ''}`}>
        {items(false)}
        {items(true)}
      </ul>
    </div>
  );
}

const FOOTER_LINKS = [
  {
    title: 'Product',
    links: [
      { label: 'About', href: '#about' },
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Numbers', href: '#numbers' },
    ],
  },
  {
    title: 'See It Work',
    links: [
      { label: 'How it works', href: '#how' },
      { label: 'Live demo', href: '#demo' },
      { label: 'Rollout moments', href: '#stories' },
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
  const linkClass = 'text-lg text-white/85 transition-colors hover:text-lime';
  return (
    <footer className="bg-white">
      {/* Two crossed bands scrolling in opposite directions. Decorative: the same words are buttons below. */}
      <div className="relative h-[180px] overflow-hidden lg:h-[261px]" aria-hidden="true">
        <MarqueeStrip tone="bg-lime text-ink" className="top-[34%] -rotate-[4deg]" reverse />
        <MarqueeStrip tone="bg-ink text-white [&_svg]:text-lime" className="top-[22%] rotate-[4deg]" />
      </div>

      <div className="relative overflow-hidden bg-ink text-white">
        <div className="relative mx-auto grid max-w-[1116px] gap-14 px-4 pt-20 lg:grid-cols-[1.1fr_1.6fr] lg:pt-28">
          <div>
            <h2 className="text-[clamp(1.8rem,2.7vw,2.475rem)] leading-[1.08] font-semibold tracking-[-0.04em]">
              Turn on your first
              <br />
              flag today.
            </h2>
            <p className="mt-4 max-w-[306px] text-[15px] leading-snug text-white/55">
              Create an org, copy your API key, and change what users see without a redeploy.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex h-[47px] items-center gap-2 rounded-[9px] bg-lime px-5 text-lg font-semibold text-ink transition-[filter,transform] hover:brightness-110 active:translate-y-px"
              >
                Get started
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                to="/login"
                className="inline-flex h-[47px] items-center rounded-[9px] border border-white/15 px-5 text-lg font-semibold transition-colors hover:bg-white/[0.06]"
              >
                Sign in
              </Link>
            </div>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {FOOTER_LINKS.map(({ title, links }) => (
              <div key={title}>
                <h3 className="text-lg font-semibold">{title}</h3>
                <ul className="mt-6 space-y-3.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      {'to' in link ? (
                        <Link to={link.to} className={linkClass}>
                          {link.label}
                        </Link>
                      ) : (
                        <a href={link.href} className={linkClass}>
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="relative mx-auto mt-16 flex max-w-[1116px] flex-col gap-3 border-t border-white/10 px-4 py-7 text-[14px] text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} FlagFlow</p>
          <p>Live flag changes, no redeploys.</p>
          <a href="#" className="text-white/85 transition-colors hover:text-lime">
            Back to top
          </a>
        </div>

        {/* The giant wordmark, cut off by the bottom edge and fading into the ground. */}
        <p
          aria-hidden="true"
          className="pointer-events-none mx-auto -mb-[0.22em] max-w-[1116px] bg-linear-to-b from-white/[0.07] to-white/0 bg-clip-text text-center text-[clamp(4.5rem,17.1vw,15.3rem)] leading-[0.9] font-bold tracking-[-0.06em] text-transparent select-none"
        >
          FlagFlow
        </p>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="landing relative z-10 min-h-dvh bg-white font-display">
      <div className="relative overflow-hidden bg-ink">
        {/* Decoration: side rails, arcs, sparkles, lime glows in the lower corners and a pale one under the cards. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-y-0 left-[17%] w-px bg-white/[0.05]" />
          <div className="absolute inset-y-0 right-[17%] w-px bg-white/[0.05]" />
          <div className="absolute top-[30%] left-1/2 aspect-square w-[1035px] -translate-x-1/2 rounded-full border border-white/[0.06]" />
          <div className="absolute top-[40%] left-1/2 aspect-square w-[810px] -translate-x-1/2 rounded-full border border-white/[0.04]" />
          <div className="absolute -bottom-56 -left-40 size-[504px] rounded-full bg-lime/45 blur-[117px]" />
          <div className="absolute -right-48 -bottom-64 size-[378px] rounded-full bg-lime/25 blur-[126px]" />
          <div className="absolute -bottom-36 left-1/2 h-[216px] w-[648px] -translate-x-1/2 rounded-full bg-white/30 blur-[90px]" />
        </div>
        {/* On a phone the sparkles would cross the hero text, so they show from tablet width up. */}
        <div className="hidden md:block">
          <Sparkle className="top-[16%] left-[8%] size-20" />
          <Sparkle className="top-[34%] right-[14%] size-28" />
        </div>

        <Header />
        <main>
          <Hero />
          <Showcase />
        </main>
      </div>

      <About />
      <Features />
      <Pricing />
      <Numbers />
      <Stories />
      <Footer />
    </div>
  );
}

import { Link } from 'react-router';

// The public site's header and atmosphere, shared by the home page and the auth pages so that
// "Get started" leads to a form in the same world.

const NAV = [
  { label: 'Product', href: '/#product' },
  { label: 'How it works', href: '/#how' },
  { label: 'Demo', href: '/#demo' },
  { label: 'Docs', href: '/#docs' },
];

/** A soft lime cross of light. */
export function Sparkle({ className }: { className: string }) {
  return (
    <div className={`pointer-events-none absolute ${className}`} aria-hidden="true">
      <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-lime/60 to-transparent" />
      <div className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-lime/60 to-transparent" />
    </div>
  );
}

/** The floating glass bar at the top of every public page. */
export function SiteHeader() {
  return (
    <header className="relative z-20 px-4 pt-3">
      <nav
        aria-label="Site"
        className="mx-auto flex h-16 max-w-[900px] items-center gap-8 rounded-2xl border border-white/5 bg-white/[0.035] px-4 backdrop-blur-md"
      >
        <Link to="/" className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-white">
          <span className="size-3.5 rounded-[3px] bg-lime" aria-hidden="true" />
          FlagFlow
        </Link>
        <ul className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <li key={item.label}>
              <a href={item.href} className="text-[14px] text-white/60 transition-colors hover:text-white">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-4">
          <Link
            to="/login"
            className="hidden text-[14px] text-white/70 transition-colors hover:text-white sm:block"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-[9px] bg-white px-5 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:bg-lime"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}

/** Side rails, faint arcs, sparkles and lime glows in the lower corners: the home page hero's backdrop. */
export function SiteAtmosphere() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-y-0 left-[17%] w-px bg-white/[0.05]" />
        <div className="absolute inset-y-0 right-[17%] w-px bg-white/[0.05]" />
        <div className="absolute top-[30%] left-1/2 aspect-square w-[1035px] -translate-x-1/2 rounded-full border border-white/[0.06]" />
        <div className="absolute top-[40%] left-1/2 aspect-square w-[810px] -translate-x-1/2 rounded-full border border-white/[0.04]" />
        <div className="absolute -bottom-56 -left-40 size-[504px] rounded-full bg-lime/45 blur-[117px]" />
        <div className="absolute -right-48 -bottom-64 size-[378px] rounded-full bg-lime/25 blur-[126px]" />
      </div>
      {/* Sparkles only where there is room beside the headline; on a phone they would cross it. */}
      <div className="hidden md:block">
        <Sparkle className="top-[16%] left-[8%] size-20" />
        <Sparkle className="top-[34%] right-[14%] size-28" />
      </div>
    </>
  );
}

import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-[clamp(2rem,4vw,3rem)] leading-[1.04] font-bold tracking-[-0.05em] text-white">
        Page Not Found
      </h1>
      <Link to="/" className="text-[15px] font-semibold text-lime hover:underline">
        Go to FlagFlow
      </Link>
    </div>
  );
}

export function ErrorPage() {
  return (
    <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-[clamp(2rem,4vw,3rem)] leading-[1.04] font-bold tracking-[-0.05em] text-white">
        Something Went Wrong
      </h1>
      <p className="max-w-[46ch] text-[15px] text-pretty text-white/55">
        The page hit an unexpected error. Reload to try again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="text-[15px] font-semibold text-lime hover:underline"
      >
        Reload
      </button>
    </div>
  );
}

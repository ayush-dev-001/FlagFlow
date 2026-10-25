import type { ReactNode } from 'react';

/** A page title in the home page's voice: bold, tight Title Case, with a white/55 line under it. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[clamp(2rem,3vw,2.75rem)] leading-[1.04] font-bold tracking-[-0.05em] text-white">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-[60ch] text-[16px] leading-snug text-white/55">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}

import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
  /** Replaces default padded scroll body (e.g. `flex min-h-0 flex-col overflow-hidden p-0`). */
  bodyClassName?: string;
};

export function Panel({ title, children, aside, bodyClassName }: Readonly<PanelProps>) {
  const bodyClasses =
    bodyClassName != null && bodyClassName.length > 0
      ? `min-h-0 flex-1 text-sm leading-relaxed text-zinc-100 transition-opacity duration-200 ${bodyClassName}`
      : "voxa-scroll min-h-0 flex-1 overflow-auto p-4 text-sm leading-relaxed text-zinc-100 transition-opacity duration-200 md:p-6";

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg shadow-black/25 backdrop-blur-xl backdrop-saturate-150">
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800/90 bg-zinc-900/35 px-4 py-3 backdrop-blur-md md:px-6">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">{title}</h2>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </header>
      <div className={bodyClasses}>{children}</div>
    </section>
  );
}

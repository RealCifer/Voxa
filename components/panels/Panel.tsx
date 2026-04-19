import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
  /** Appended to the scrollable body (e.g. `overflow-hidden p-0` for custom inner scroll). */
  bodyClassName?: string;
};

export function Panel({ title, children, aside, bodyClassName }: Readonly<PanelProps>) {
  const body =
    bodyClassName != null && bodyClassName.length > 0
      ? `min-h-0 flex-1 text-sm text-zinc-100 transition-opacity duration-150 ${bodyClassName}`
      : "min-h-0 flex-1 overflow-auto p-4 text-sm text-zinc-100 transition-opacity duration-150";
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 shadow-sm">
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-zinc-700 bg-zinc-800/90 px-4 py-3 backdrop-blur">
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </header>
      <div className={[body, bodyClassName].filter(Boolean).join(" ")}>{children}</div>
    </section>
  );
}

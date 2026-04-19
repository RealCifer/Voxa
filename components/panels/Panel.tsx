import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
};

export function Panel({ title, children, aside }: Readonly<PanelProps>) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 shadow-sm">
      <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-zinc-700 bg-zinc-800/90 px-4 py-3 backdrop-blur">
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4 text-sm text-zinc-100">
        {children}
      </div>
    </section>
  );
}

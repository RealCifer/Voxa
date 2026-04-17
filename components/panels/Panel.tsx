import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
};

export function Panel({ title, children, aside }: PanelProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
          {title}
        </h2>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-sm text-neutral-800 dark:text-neutral-200">
        {children}
      </div>
    </section>
  );
}

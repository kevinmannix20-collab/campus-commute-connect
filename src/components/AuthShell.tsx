import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-100 p-4 font-sans text-zinc-900 selection:bg-forest/10 md:p-8">
      <section className="relative flex w-full max-w-[375px] shrink-0 flex-col rounded-[24px] bg-sand shadow-xl shadow-zinc-900/5 ring-1 ring-black/5 lowercase">
        <header className="p-6 pb-4">
          <h1 className="text-balance font-serif text-2xl font-medium leading-tight text-forest">
            {title}
          </h1>
          <p className="mt-1 max-w-[40ch] text-pretty text-xs text-zinc-500">{subtitle}</p>
        </header>

        <div className="space-y-4 px-6 pb-6">{children}</div>

        <div className="border-t border-zinc-950/5 bg-sand p-6 text-center text-xs text-zinc-500">
          {footer}
        </div>
      </section>
    </div>
  );
}

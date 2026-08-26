import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

function NavItem({
  to,
  label,
  active,
}: {
  to: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className={
        active
          ? "flex flex-col items-center gap-1 text-forest"
          : "flex flex-col items-center gap-1 opacity-40"
      }
    >
      <div
        className={active ? "size-5 rounded-md bg-forest" : "size-5 rounded-md bg-zinc-900"}
      />
      <span className={active ? "text-[9px] font-semibold" : "text-[9px] font-medium"}>
        {label}
      </span>
    </Link>
  );
}

export function PhoneShell({
  children,
  active,
}: {
  children: ReactNode;
  active: "home" | "browse" | "status";
}) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-100 p-4 font-sans text-zinc-900 selection:bg-forest/10 md:p-8">
      <section className="relative flex h-[720px] w-full max-w-[375px] shrink-0 flex-col overflow-hidden rounded-[24px] bg-sand shadow-xl shadow-zinc-900/5 ring-1 ring-black/5">
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
        <nav className="flex items-center justify-around border-t border-zinc-950/5 bg-sand p-4">
          <NavItem to="/" label="Home" active={active === "home"} />
          <NavItem to="/browse" label="Browse" active={active === "browse"} />
          <NavItem to="/trips" label="Status" active={active === "status"} />
        </nav>
      </section>
    </div>
  );
}

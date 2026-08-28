import { Link, useNavigate } from "@tanstack/react-router";
import { Home, Navigation, Search, User, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

function NavItem({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className={
        active
          ? "flex flex-col items-center gap-1 text-forest"
          : "flex flex-col items-center gap-1 text-zinc-400"
      }
    >
      <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
      <span className={active ? "text-[9px] font-semibold" : "text-[9px] font-medium"}>
        {label}
      </span>
    </Link>
  );
}

function SignOutButton() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={async () => {
        await supabase.auth.signOut();
        navigate({ to: "/login" });
      }}
      className="absolute right-4 top-4 z-30 rounded-full bg-sand/80 px-3 py-1 text-[10px] font-medium text-zinc-500 ring-1 ring-zinc-950/5 backdrop-blur transition-colors hover:text-forest"
    >
      Sign out
    </button>
  );
}

export function PhoneShell({
  children,
  active,
}: {
  children: ReactNode;
  active?: "home" | "browse" | "status" | "profile";
}) {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-100 p-4 font-sans text-zinc-900 selection:bg-forest/10 md:p-8">
      <section className="relative flex h-[720px] w-full max-w-[375px] shrink-0 flex-col overflow-hidden rounded-[24px] bg-sand shadow-xl shadow-zinc-900/5 ring-1 ring-black/5">
        <SignOutButton />
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
        <nav className="flex items-center justify-around border-t border-zinc-950/5 bg-sand p-4">
          <NavItem to="/" label="Home" icon={Home} active={active === "home"} />
          <NavItem to="/browse" label="Browse" icon={Search} active={active === "browse"} />
          <NavItem to="/trips" label="Status" icon={Navigation} active={active === "status"} />
          {user ? (
            <Link
              to="/profile/$userId"
              params={{ userId: user.id }}
              className={
                active === "profile"
                  ? "flex flex-col items-center gap-1 text-forest"
                  : "flex flex-col items-center gap-1 text-zinc-400"
              }
            >
              <User className="size-5" strokeWidth={active === "profile" ? 2.5 : 2} />
              <span
                className={
                  active === "profile" ? "text-[9px] font-semibold" : "text-[9px] font-medium"
                }
              >
                Profile
              </span>
            </Link>
          ) : null}
        </nav>
      </section>
    </div>
  );
}

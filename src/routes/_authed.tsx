import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async () => {
    // Session lives in browser localStorage, so this can only be answered
    // for real on the client — skip it during SSR rather than bouncing a
    // signed-in user to /login just because the server has no storage to
    // read. AuthGate below is the real guard for the initial page load.
    if (typeof window === "undefined") return;

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthGate,
});

function AuthGate() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100">
        <div className="size-8 animate-pulse rounded-full bg-forest/20" />
      </div>
    );
  }

  return <Outlet />;
}

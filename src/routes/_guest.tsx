import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_guest")({
  beforeLoad: async () => {
    // See _authed.tsx: session lookup only works client-side, so the real
    // guard is GuestGate below — this just avoids server-side false starts.
    if (typeof window === "undefined") return;

    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/" });
    }
  },
  component: GuestGate,
});

function GuestGate() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/" });
    }
  }, [loading, session, navigate]);

  if (loading || session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100">
        <div className="size-8 animate-pulse rounded-full bg-forest/20" />
      </div>
    );
  }

  return <Outlet />;
}

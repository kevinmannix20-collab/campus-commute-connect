import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Navigation } from "lucide-react";
import { useEffect } from "react";

import { PhoneShell } from "@/components/PhoneShell";
import { StarDisplay } from "@/components/StarRating";
import { TierBadge } from "@/components/TierBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { driverTier } from "@/lib/priorityScore";
import { useHomeDistances } from "@/lib/use-home-distances";

export const Route = createFileRoute("/_authed/browse")({
  head: () => ({
    meta: [
      { title: "Open Commutes — Commute Mate" },
      {
        name: "description",
        content:
          "Scroll open student commute requests, join someone on the bus, or offer an empty seat in your car for the trip home.",
      },
      { property: "og:title", content: "Open Commutes — Commute Mate" },
      {
        property: "og:description",
        content:
          "Join a classmate on the bus or offer an empty seat in your car for tonight's trip home.",
      },
    ],
  }),
  component: BrowseScreen,
});

const openRequestsQueryKey = ["open-trip-requests"];
const myOpenRequestQueryKey = ["my-open-trip-request"];

function formatDateTime(iso: string) {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timePart = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

function BrowseScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const openRequests = useQuery({
    queryKey: openRequestsQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("open_trip_requests");
      if (error) throw error;
      return data;
    },
  });

  // Own school + home address, so posting cards can flag classmates and show
  // distance from home at a glance — plain table select (not an RPC) since
  // profiles_select_own lets a user read only their own row directly.
  const myProfile = useQuery({
    queryKey: ["my-school-info"],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("school, home_lat, home_lng")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const homeCoords =
    myProfile.data?.home_lat != null && myProfile.data?.home_lng != null
      ? { lat: myProfile.data.home_lat, lng: myProfile.data.home_lng }
      : null;

  const homeDistances = useHomeDistances(
    homeCoords,
    (openRequests.data ?? []).map((r) => ({
      id: r.id,
      lat: r.destination_lat,
      lng: r.destination_lng,
    })),
  );

  // My own open request, if any — needed to call create_match, since a
  // match always pairs the caller's own open request with someone else's.
  const myOpenRequest = useQuery({
    queryKey: myOpenRequestQueryKey,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("trip_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    const channel = supabase
      .channel("trip_requests-browse")
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_requests" }, () => {
        queryClient.invalidateQueries({ queryKey: openRequestsQueryKey });
        queryClient.invalidateQueries({ queryKey: myOpenRequestQueryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bus_group_members" }, () => {
        queryClient.invalidateQueries({ queryKey: openRequestsQueryKey });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // open_trip_requests() already orders by requested_time ascending and
  // excludes past ones — soonest trip first, nothing stale left to filter.
  const sortedRequests = openRequests.data ?? [];

  const matchWith = async (theirRequestId: string) => {
    if (!myOpenRequest.data) return;
    const { error } = await supabase.rpc("create_match", {
      request_a: myOpenRequest.data.id,
      request_b: theirRequestId,
    });
    if (!error) {
      queryClient.invalidateQueries({ queryKey: openRequestsQueryKey });
      queryClient.invalidateQueries({ queryKey: myOpenRequestQueryKey });
    }
  };

  // Joining a bus post doesn't pair two requests like car matching does —
  // there's no reciprocal offer, so no need to have posted your own
  // request first. Up to 6 people total (poster + 5 joiners); the RPC
  // itself enforces the cap and closes the post once full.
  const joinBusGroup = async (tripRequestId: string) => {
    const { error } = await supabase.rpc("join_bus_group", {
      p_trip_request_id: tripRequestId,
    });
    if (!error) {
      queryClient.invalidateQueries({ queryKey: openRequestsQueryKey });
    }
  };

  return (
    <PhoneShell active="browse">
      <header className="sticky top-0 z-20 bg-sand p-6 pb-2">
        <h1 className="font-serif text-2xl font-medium leading-tight text-forest">Open Commutes</h1>
        <p className="mt-1 max-w-[40ch] text-pretty text-xs text-zinc-500">
          Help a classmate get home safely tonight.
        </p>
        {!myOpenRequest.isLoading &&
        !myOpenRequest.data &&
        openRequests.data?.some((r) => r.mode === "car") ? (
          <p className="mt-2 text-xs text-amber-700">
            Post your own request from Home before you can offer or accept a ride.
          </p>
        ) : null}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {openRequests.isLoading ? (
          <p className="p-4 text-center text-xs text-zinc-400">Loading open commutes…</p>
        ) : openRequests.isError ? (
          <p className="p-4 text-center text-xs text-red-600">Couldn&apos;t load requests.</p>
        ) : sortedRequests.length > 0 ? (
          sortedRequests.map((request) => (
            <div
              key={request.id}
              className="space-y-3 rounded-[20px] bg-zinc-50 p-4 ring-1 ring-zinc-950/5"
            >
              <div className="flex items-start justify-between">
                <Link
                  to="/profile/$userId"
                  params={{ userId: request.requester_id }}
                  className="flex items-center gap-2"
                >
                  <div className="flex size-8 items-center justify-center rounded-[10px] bg-forest/10 text-xs font-semibold text-forest outline-1 -outline-offset-1 outline-black/5">
                    {request.requester_display_name.charAt(0) || "?"}
                  </div>
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold">
                        {request.requester_display_name}
                      </span>
                      <TierBadge
                        tier={driverTier(
                          request.requester_average_stars,
                          request.requester_rides_given,
                        )}
                      />
                    </span>
                    {request.requester_school || request.requester_degree_pursuit ? (
                      <span
                        className={
                          myProfile.data?.school &&
                          request.requester_school &&
                          myProfile.data.school.toLowerCase() ===
                            request.requester_school.toLowerCase()
                            ? "inline-flex w-fit items-center rounded-md bg-forest/10 px-1.5 py-0.5 text-[9px] font-semibold text-forest"
                            : "inline-flex w-fit items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500"
                        }
                      >
                        {[request.requester_school, request.requester_degree_pursuit]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                    <StarDisplay
                      average={request.requester_average_stars}
                      emptyLabel="New driver"
                      className="text-[10px] text-zinc-500"
                    />
                  </span>
                </Link>
                <span
                  className={
                    request.mode === "bus"
                      ? "rounded-md bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-900"
                      : "rounded-md bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-900"
                  }
                >
                  {request.mode === "bus" ? "Bus Buddy" : "Needs Ride"}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="size-1.5 rounded-full border border-forest" />
                  From: {request.starting_point}
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                  <span className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-forest" />
                    To: {request.destination}
                  </span>
                  {homeDistances[request.id] ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                      <Navigation className="size-2.5" />
                      {homeDistances[request.id]} from home
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="size-1.5 rounded-full bg-zinc-300" />
                  {formatDateTime(request.requested_time)}
                </div>
                {request.mode === "car" && request.companion_display_names?.length > 0 ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="size-1.5 rounded-full bg-zinc-300" />
                    With: {request.companion_display_names.join(", ")}
                  </div>
                ) : null}
              </div>
              {request.mode === "bus" ? (
                <button
                  type="button"
                  onClick={() => joinBusGroup(request.id)}
                  disabled={(request.bus_member_count ?? 1) >= 6}
                  className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-forest py-2 pl-2 pr-3 text-xs font-medium text-sand shadow-sm ring-1 ring-forest disabled:opacity-40"
                >
                  <svg
                    className="size-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Join Commute
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => matchWith(request.id)}
                  disabled={!myOpenRequest.data}
                  className="flex w-full items-center justify-center gap-2 rounded-[12px] py-2 pl-2 pr-3 text-xs font-medium text-forest ring-1 ring-forest hover:bg-forest/5 disabled:opacity-40"
                >
                  Offer a Ride
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="p-4 text-center text-xs text-zinc-400">
            No open commutes right now — check back soon.
          </p>
        )}
      </div>
    </PhoneShell>
  );
}

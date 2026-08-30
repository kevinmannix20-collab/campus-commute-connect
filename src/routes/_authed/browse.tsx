import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Navigation, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { PhoneShell } from "@/components/PhoneShell";
import { PlaceAutocompleteInput } from "@/components/PlaceAutocompleteInput";
import { StarDisplay } from "@/components/StarRating";
import { TierBadge } from "@/components/TierBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { driverTier } from "@/lib/priorityScore";
import { useHomeDistances } from "@/lib/use-home-distances";

const DEFAULT_STARTING_POINT = "UCLA Anderson School of Management";
const DEFAULT_STARTING_POINT_COORDS = { lat: 34.0736, lng: -118.4431 };

// "HH:MM" for a <input type="time">, in the viewer's local time — used to
// default the inline offer-ride form's departure time to the rider's own
// requested time, since it's just a starting point they can adjust.
function toTimeInputValue(iso: string) {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

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

  // My own open CAR request, if any — needed to call create_match, since
  // offering someone a ride always pairs the caller's own request with
  // theirs, and create_match derives who's driving from mode_b (the other
  // person's request). Restricted to mode='car' here, not just "any open
  // request": pairing a bus post of mine with someone else's car post
  // would silently make me their "driver" despite never offering a car.
  const myOpenRequest = useQuery({
    queryKey: myOpenRequestQueryKey,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("trip_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "open")
        .eq("mode", "car")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [actionError, setActionError] = useState<string | null>(null);

  // Inline "offer a ride" mini-form state, for a driver with no open car
  // request of their own — lets them offer directly off someone else's
  // card instead of being sent to post a throwaway request first. Only
  // one card's form is open at a time.
  const [offeringForRequest, setOfferingForRequest] = useState<string | null>(null);
  const [offerStartingPoint, setOfferStartingPoint] = useState<{
    address: string;
    lat: number | null;
    lng: number | null;
  }>({
    address: DEFAULT_STARTING_POINT,
    lat: DEFAULT_STARTING_POINT_COORDS.lat,
    lng: DEFAULT_STARTING_POINT_COORDS.lng,
  });
  const [offerTime, setOfferTime] = useState("");

  const openOfferForm = (request: { id: string; requested_time: string }) => {
    setActionError(null);
    setOfferingForRequest(request.id);
    setOfferStartingPoint({
      address: DEFAULT_STARTING_POINT,
      lat: DEFAULT_STARTING_POINT_COORDS.lat,
      lng: DEFAULT_STARTING_POINT_COORDS.lng,
    });
    setOfferTime(toTimeInputValue(request.requested_time));
  };

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
  const hardFilteredRequests = openRequests.data ?? [];

  // AI ranking is a soft layer on top of the hard filter above, which
  // already guarantees every candidate here is valid (open, not past, not
  // the viewer's own). With 0-1 candidates there's nothing meaningful to
  // rank, so the query below is disabled entirely and the plain
  // hard-filtered order is used as-is — no "AI checked this" reason line
  // is ever shown in that case. Keyed on the candidate id set (not just
  // count) so a changed lineup re-ranks.
  const candidateIdsKey = hardFilteredRequests
    .map((r) => r.id)
    .sort()
    .join(",");

  const matchRanking = useQuery({
    queryKey: ["match-ranking", user?.id, candidateIdsKey],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        rankings: { candidate_id: string; rank: number; reason: string | null }[];
      }>("rank-matches", {
        body: {
          candidates: hardFilteredRequests.map((r) => ({
            trip_request_id: r.id,
            requester_id: r.requester_id,
            starting_point: r.starting_point,
            destination: r.destination,
            mode: r.mode,
            requested_time: r.requested_time,
          })),
        },
      });
      if (error) throw error;
      return data;
    },
    enabled: hardFilteredRequests.length >= 2,
    // A failed/slow AI call should never block browsing — fall back to
    // the plain hard-filtered order rather than retrying or erroring the page.
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const reasonByRequestId = new Map(
    (matchRanking.data?.rankings ?? []).map((r) => [r.candidate_id, r.reason]),
  );
  const rankByRequestId = new Map(
    (matchRanking.data?.rankings ?? []).map((r) => [r.candidate_id, r.rank]),
  );

  const sortedRequests =
    matchRanking.data && !matchRanking.isError
      ? [...hardFilteredRequests].sort(
          (a, b) => (rankByRequestId.get(a.id) ?? 99) - (rankByRequestId.get(b.id) ?? 99),
        )
      : hardFilteredRequests;

  const matchWith = async (theirRequestId: string) => {
    if (!myOpenRequest.data) return;
    setActionError(null);
    const { error } = await supabase.rpc("create_match", {
      request_a: myOpenRequest.data.id,
      request_b: theirRequestId,
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: openRequestsQueryKey });
    queryClient.invalidateQueries({ queryKey: myOpenRequestQueryKey });
  };

  // Joining a bus post doesn't pair two requests like car matching does —
  // there's no reciprocal offer, so no need to have posted your own
  // request first. Up to 6 people total (poster + 5 joiners); the RPC
  // itself enforces the cap and closes the post once full.
  const joinBusGroup = async (tripRequestId: string) => {
    setActionError(null);
    const { error } = await supabase.rpc("join_bus_group", {
      p_trip_request_id: tripRequestId,
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: openRequestsQueryKey });
  };

  const offerRideDirect = useMutation({
    mutationFn: async (targetRequestId: string) => {
      if (offerStartingPoint.lat === null || offerStartingPoint.lng === null) {
        throw new Error("Select a starting point from the suggestions");
      }
      if (!offerTime) {
        throw new Error("Pick a rough departure time");
      }
      const [hoursStr, minutesStr] = offerTime.split(":");
      const departureTime = new Date();
      departureTime.setHours(Number(hoursStr ?? 0), Number(minutesStr ?? 0), 0, 0);

      const { error } = await supabase.rpc("offer_ride", {
        p_target_request_id: targetRequestId,
        p_starting_point: offerStartingPoint.address,
        p_starting_point_lat: offerStartingPoint.lat,
        p_starting_point_lng: offerStartingPoint.lng,
        p_requested_time: departureTime.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setOfferingForRequest(null);
      queryClient.invalidateQueries({ queryKey: openRequestsQueryKey });
      queryClient.invalidateQueries({ queryKey: myOpenRequestQueryKey });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Something went wrong");
    },
  });

  return (
    <PhoneShell active="browse">
      <header className="sticky top-0 z-20 bg-sand p-6 pb-2">
        <h1 className="font-serif text-2xl font-medium leading-tight text-forest">Open Commutes</h1>
        <p className="mt-1 max-w-[40ch] text-pretty text-xs text-zinc-500">
          Help a classmate get home safely tonight.
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {actionError ? (
          <p className="rounded-[12px] bg-red-50 p-3 text-xs text-red-600 ring-1 ring-red-900/10">
            {actionError}
          </p>
        ) : null}
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
                    {request.requester_open_to_networking_chat ? (
                      <span className="inline-flex w-fit items-center gap-1 rounded-md bg-forest/10 px-1.5 py-0.5 text-[9px] font-medium text-forest">
                        <MessageCircle className="size-2.5" />
                        Open to networking
                      </span>
                    ) : null}
                  </span>
                </Link>
                <span
                  className={
                    request.mode === "bus"
                      ? "rounded-md bg-zinc-100 px-2 py-0.5 text-[9px] font-bold tracking-wide text-zinc-700"
                      : "rounded-md bg-forest/10 px-2 py-0.5 text-[9px] font-bold tracking-wide text-forest"
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
              {reasonByRequestId.get(request.id) ? (
                <div className="flex items-start gap-1.5 rounded-[10px] bg-forest/5 px-2.5 py-2 text-[11px] text-forest">
                  <Sparkles className="mt-0.5 size-3 shrink-0" />
                  <span>{reasonByRequestId.get(request.id)}</span>
                </div>
              ) : null}
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
              ) : myOpenRequest.data ? (
                <button
                  type="button"
                  onClick={() => matchWith(request.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-[12px] py-2 pl-2 pr-3 text-xs font-medium text-forest ring-1 ring-forest hover:bg-forest/5"
                >
                  Offer a Ride
                </button>
              ) : offeringForRequest === request.id ? (
                <div className="space-y-2 rounded-[14px] bg-white p-3 ring-1 ring-zinc-200">
                  <p className="text-[10px] font-medium tracking-wide text-zinc-500">
                    Confirm your ride
                  </p>
                  <PlaceAutocompleteInput
                    value={offerStartingPoint.address}
                    onTextChange={(text) =>
                      setOfferStartingPoint({ address: text, lat: null, lng: null })
                    }
                    onPlaceSelected={setOfferStartingPoint}
                    placeholder="Your starting point..."
                    className="w-full rounded-[10px] bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none ring-1 ring-zinc-200 focus:ring-forest"
                  />
                  <input
                    type="time"
                    value={offerTime}
                    onChange={(e) => setOfferTime(e.target.value)}
                    className="w-full rounded-[10px] bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none ring-1 ring-zinc-200 focus:ring-forest"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOfferingForRequest(null)}
                      className="flex-1 rounded-[10px] px-3 py-2 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => offerRideDirect.mutate(request.id)}
                      disabled={offerRideDirect.isPending}
                      className="flex-1 rounded-[10px] bg-forest px-3 py-2 text-xs font-medium text-sand disabled:opacity-50"
                    >
                      {offerRideDirect.isPending ? "Confirming…" : "Confirm"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openOfferForm(request)}
                  className="flex w-full items-center justify-center gap-2 rounded-[12px] py-2 pl-2 pr-3 text-xs font-medium text-forest ring-1 ring-forest hover:bg-forest/5"
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

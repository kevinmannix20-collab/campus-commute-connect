import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Navigation, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

type PostType = "need" | "offer";

// "HH:MM" for a <input type="time">, in the viewer's local time — used to
// default the inline offer/request form's departure time to the posted
// request's own time, since it's just a starting point they can adjust.
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
const myOpenOfferQueryKey = ["my-open-car-offer"];
const myMostRecentOpenPostQueryKey = ["my-most-recent-open-post"];

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

function modeLabel(mode: string, postType: PostType) {
  if (mode === "bus") return postType === "offer" ? "Offering Company" : "Bus Buddy";
  return postType === "offer" ? "Offering Ride" : "Needs Ride";
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

  // My own open car *offer*, if any — needed to call create_match on the
  // "Need a Mate" tab, since offering someone a ride always pairs the
  // caller's own standing offer with theirs, and create_match derives who's
  // driving from mode_b (the other person's request). Restricted to
  // mode='car' + post_type='offer': pairing a need-post of mine, or a bus
  // post, with someone else's car post would silently make me their
  // "driver" despite never actually offering a car.
  const myOpenOffer = useQuery({
    queryKey: myOpenOfferQueryKey,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("trip_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "open")
        .eq("mode", "car")
        .eq("post_type", "offer")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Just for picking a sensible default tab: the type of whichever open
  // post (any mode) the caller posted most recently, if any.
  const myMostRecentOpenPost = useQuery({
    queryKey: myMostRecentOpenPostQueryKey,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("trip_requests")
        .select("post_type")
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

  const [activeTab, setActiveTab] = useState<PostType>("need");
  // Auto-picks the tab once on first load based on the caller's own most
  // recent open post — offered a ride -> default to browsing who needs one
  // (and vice versa) — but never overrides a tab the user has since chosen
  // themselves, even if this query refetches later.
  const hasAutoSelectedTabRef = useRef(false);
  useEffect(() => {
    if (hasAutoSelectedTabRef.current || myMostRecentOpenPost.isLoading || !user) return;
    hasAutoSelectedTabRef.current = true;
    const ownType = myMostRecentOpenPost.data?.post_type;
    setActiveTab(ownType === "offer" ? "need" : ownType === "need" ? "offer" : "need");
  }, [myMostRecentOpenPost.isLoading, myMostRecentOpenPost.data, user]);

  const [actionError, setActionError] = useState<string | null>(null);

  // Inline mini-form state, shared by both the Need tab's "Offer a Ride"
  // flow and the Offering tab's "Request This Ride" flow — only one card's
  // form is ever open at a time regardless of which tab it's on, so one set
  // of state covers both; only the RPC called at confirm time differs.
  const [actionFormForRequest, setActionFormForRequest] = useState<string | null>(null);
  const [actionStartingPoint, setActionStartingPoint] = useState<{
    address: string;
    lat: number | null;
    lng: number | null;
  }>({
    address: DEFAULT_STARTING_POINT,
    lat: DEFAULT_STARTING_POINT_COORDS.lat,
    lng: DEFAULT_STARTING_POINT_COORDS.lng,
  });
  const [actionTime, setActionTime] = useState("");

  const openActionForm = (request: { id: string; requested_time: string }) => {
    setActionError(null);
    setActionFormForRequest(request.id);
    setActionStartingPoint({
      address: DEFAULT_STARTING_POINT,
      lat: DEFAULT_STARTING_POINT_COORDS.lat,
      lng: DEFAULT_STARTING_POINT_COORDS.lng,
    });
    setActionTime(toTimeInputValue(request.requested_time));
  };

  useEffect(() => {
    const channel = supabase
      .channel("trip_requests-browse")
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_requests" }, () => {
        queryClient.invalidateQueries({ queryKey: openRequestsQueryKey });
        queryClient.invalidateQueries({ queryKey: myOpenOfferQueryKey });
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
  // The active tab narrows that same hard-filtered set to one post_type;
  // ranking below only ever sees the currently-visible tab's candidates.
  const tabRequests = (openRequests.data ?? []).filter((r) => r.post_type === activeTab);

  // AI ranking is a soft layer on top of the hard filter above, which
  // already guarantees every candidate here is valid (open, not past, not
  // the viewer's own). With 0-1 candidates there's nothing meaningful to
  // rank, so the query below is disabled entirely and the plain
  // hard-filtered order is used as-is — no "AI checked this" reason line
  // is ever shown in that case. Keyed on the candidate id set (not just
  // count) so a changed lineup re-ranks.
  const candidateIdsKey = tabRequests
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
          candidates: tabRequests.map((r) => ({
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
    enabled: tabRequests.length >= 2,
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
      ? [...tabRequests].sort(
          (a, b) => (rankByRequestId.get(a.id) ?? 99) - (rankByRequestId.get(b.id) ?? 99),
        )
      : tabRequests;

  const matchWith = async (theirRequestId: string) => {
    if (!myOpenOffer.data) return;
    setActionError(null);
    const { error } = await supabase.rpc("create_match", {
      request_a: myOpenOffer.data.id,
      request_b: theirRequestId,
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: openRequestsQueryKey });
    queryClient.invalidateQueries({ queryKey: myOpenOfferQueryKey });
  };

  // Joining a bus post doesn't pair two requests like car matching does —
  // there's no reciprocal offer, so no need to have posted your own
  // request first. Works the same whether the post is a need (someone
  // wants a buddy) or an offer (someone's already going, come along) — up
  // to 6 people total either way; the RPC enforces the cap and closes the
  // post once full.
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

  const confirmAction = useMutation({
    mutationFn: async (targetRequestId: string) => {
      if (actionStartingPoint.lat === null || actionStartingPoint.lng === null) {
        throw new Error("Select a starting point from the suggestions");
      }
      if (!actionTime) {
        throw new Error("Pick a rough departure time");
      }
      const [hoursStr, minutesStr] = actionTime.split(":");
      const departureTime = new Date();
      departureTime.setHours(Number(hoursStr ?? 0), Number(minutesStr ?? 0), 0, 0);

      // Need tab: viewer is offering a ride onto a need-post -> offer_ride.
      // Offering tab: viewer is requesting a seat on an offer-post -> request_ride.
      const { error } =
        activeTab === "need"
          ? await supabase.rpc("offer_ride", {
              p_target_request_id: targetRequestId,
              p_starting_point: actionStartingPoint.address,
              p_starting_point_lat: actionStartingPoint.lat,
              p_starting_point_lng: actionStartingPoint.lng,
              p_requested_time: departureTime.toISOString(),
            })
          : await supabase.rpc("request_ride", {
              p_target_offer_id: targetRequestId,
              p_starting_point: actionStartingPoint.address,
              p_starting_point_lat: actionStartingPoint.lat,
              p_starting_point_lng: actionStartingPoint.lng,
              p_requested_time: departureTime.toISOString(),
            });
      if (error) throw error;
    },
    onSuccess: () => {
      setActionFormForRequest(null);
      queryClient.invalidateQueries({ queryKey: openRequestsQueryKey });
      queryClient.invalidateQueries({ queryKey: myOpenOfferQueryKey });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Something went wrong");
    },
  });

  const emptyStateMessage =
    activeTab === "need"
      ? "No one needs a ride or buddy right now — check back soon."
      : "No one's offering a ride right now — check back soon.";

  return (
    <PhoneShell active="browse">
      <header className="sticky top-0 z-20 bg-sand p-6 pb-2">
        <h1 className="font-serif text-2xl font-medium leading-tight text-forest">Open Commutes</h1>
        <p className="mt-1 max-w-[40ch] text-pretty text-xs text-zinc-500">
          Help a classmate get home safely tonight.
        </p>
        <div className="mt-3 flex rounded-[12px] bg-zinc-100 p-1 ring-1 ring-zinc-200">
          <button
            type="button"
            onClick={() => setActiveTab("need")}
            className={
              activeTab === "need"
                ? "flex-1 rounded-[8px] bg-sand py-2 text-xs font-medium text-forest shadow-sm"
                : "flex-1 py-2 text-xs font-medium text-zinc-500"
            }
          >
            Need a Mate
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("offer")}
            className={
              activeTab === "offer"
                ? "flex-1 rounded-[8px] bg-sand py-2 text-xs font-medium text-forest shadow-sm"
                : "flex-1 py-2 text-xs font-medium text-zinc-500"
            }
          >
            Offering a Ride
          </button>
        </div>
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
                  {modeLabel(request.mode, request.post_type as PostType)}
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
              ) : activeTab === "need" && myOpenOffer.data ? (
                <button
                  type="button"
                  onClick={() => matchWith(request.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-[12px] py-2 pl-2 pr-3 text-xs font-medium text-forest ring-1 ring-forest hover:bg-forest/5"
                >
                  Offer a Ride
                </button>
              ) : actionFormForRequest === request.id ? (
                <div className="space-y-2 rounded-[14px] bg-white p-3 ring-1 ring-zinc-200">
                  <p className="text-[10px] font-medium tracking-wide text-zinc-500">
                    {activeTab === "need" ? "Confirm your ride" : "Confirm your request"}
                  </p>
                  <PlaceAutocompleteInput
                    value={actionStartingPoint.address}
                    onTextChange={(text) =>
                      setActionStartingPoint({ address: text, lat: null, lng: null })
                    }
                    onPlaceSelected={setActionStartingPoint}
                    placeholder="Your starting point..."
                    className="w-full rounded-[10px] bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none ring-1 ring-zinc-200 focus:ring-forest"
                  />
                  <input
                    type="time"
                    value={actionTime}
                    onChange={(e) => setActionTime(e.target.value)}
                    className="w-full rounded-[10px] bg-zinc-50 px-3 py-2 text-xs text-zinc-900 outline-none ring-1 ring-zinc-200 focus:ring-forest"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActionFormForRequest(null)}
                      className="flex-1 rounded-[10px] px-3 py-2 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmAction.mutate(request.id)}
                      disabled={confirmAction.isPending}
                      className="flex-1 rounded-[10px] bg-forest px-3 py-2 text-xs font-medium text-sand disabled:opacity-50"
                    >
                      {confirmAction.isPending ? "Confirming…" : "Confirm"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openActionForm(request)}
                  className="flex w-full items-center justify-center gap-2 rounded-[12px] py-2 pl-2 pr-3 text-xs font-medium text-forest ring-1 ring-forest hover:bg-forest/5"
                >
                  {activeTab === "need" ? "Offer a Ride" : "Request This Ride"}
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="p-4 text-center text-xs text-zinc-400">{emptyStateMessage}</p>
        )}
      </div>
    </PhoneShell>
  );
}

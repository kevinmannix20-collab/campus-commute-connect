import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { PhoneShell } from "@/components/PhoneShell";
import { RatingForm } from "@/components/RatingForm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authed/trips")({
  head: () => ({
    meta: [
      { title: "Your Journey — Commute Mate" },
      {
        name: "description",
        content:
          "Track the status of your commute requests and view the itinerary for every matched bus companion or car ride.",
      },
      { property: "og:title", content: "Your Journey — Commute Mate" },
      {
        property: "og:description",
        content:
          "Track your commute requests and view the itinerary for every matched ride or bus companion.",
      },
    ],
  }),
  component: StatusScreen,
});

const myRequestsQueryKey = ["my-trip-requests"];
const myMatchesQueryKey = ["my-matches"];
const myRatingActivityQueryKey = ["my-rating-activity"];
const myBusGroupsQueryKey = ["my-bus-groups"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function StatusScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Trips where the rating prompt was skipped this session — skipping
  // creates no row, so nothing in the DB distinguishes "skipped" from
  // "never seen"; this just keeps it from popping back up immediately.
  const [dismissedRatingPrompts, setDismissedRatingPrompts] = useState<Set<string>>(new Set());

  const myRequests = useQuery({
    queryKey: myRequestsQueryKey,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("trip_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const myMatches = useQuery({
    queryKey: myMatchesQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_matches");
      if (error) throw error;
      return data;
    },
  });

  const myRatingActivity = useQuery({
    queryKey: myRatingActivityQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_rating_activity");
      if (error) throw error;
      return data;
    },
  });

  const myBusGroups = useQuery({
    queryKey: myBusGroupsQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_bus_groups");
      if (error) throw error;
      return data;
    },
  });

  const ratedTripIds = new Set(
    (myRatingActivity.data ?? []).filter((r) => r.direction === "given").map((r) => r.trip_id),
  );

  const markCompleted = async (tripId: string) => {
    const { error } = await supabase.rpc("mark_trip_completed", { p_trip_id: tripId });
    if (!error) {
      queryClient.invalidateQueries({ queryKey: myMatchesQueryKey });
    }
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("trip_requests-trips")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_requests", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: myRequestsQueryKey });
          queryClient.invalidateQueries({ queryKey: myMatchesQueryKey });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        queryClient.invalidateQueries({ queryKey: myMatchesQueryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ratings" }, () => {
        queryClient.invalidateQueries({ queryKey: myRatingActivityQueryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bus_group_members" }, () => {
        queryClient.invalidateQueries({ queryKey: myBusGroupsQueryKey });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  const cancelRequest = async (id: string) => {
    await supabase.from("trip_requests").update({ status: "cancelled" }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: myRequestsQueryKey });
  };

  const [actionError, setActionError] = useState<string | null>(null);

  const leaveBusGroup = async (tripRequestId: string) => {
    if (!window.confirm("Leave this commute?")) return;
    setActionError(null);
    const { error } = await supabase.rpc("leave_bus_group", {
      p_trip_request_id: tripRequestId,
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: myBusGroupsQueryKey });
  };

  const isLoading = myRequests.isLoading || myMatches.isLoading || myBusGroups.isLoading;
  const matchedRequestIds = new Set((myMatches.data ?? []).map((m) => m.my_trip_request_id));
  // Bus posts are shown via the bus-groups section below (host or member,
  // open or full) instead of here, regardless of status.
  const pendingRequests = (myRequests.data ?? []).filter(
    (r) => r.status === "open" && r.mode !== "bus" && !matchedRequestIds.has(r.id),
  );
  const hasAnyRequests = (myRequests.data?.length ?? 0) > 0 || (myBusGroups.data?.length ?? 0) > 0;

  return (
    <PhoneShell active="status">
      <header className="p-6 pb-2">
        <h1 className="font-serif text-2xl font-medium leading-tight text-forest">Your Journey</h1>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {actionError ? (
          <p className="rounded-[12px] bg-red-50 p-3 text-xs text-red-600 ring-1 ring-red-900/10">
            {actionError}
          </p>
        ) : null}
        {isLoading ? (
          <p className="p-4 text-center text-xs text-zinc-400">Loading your trips…</p>
        ) : !hasAnyRequests ? (
          <div className="space-y-3 rounded-[20px] border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
            <p className="text-sm text-zinc-600">You haven&apos;t posted a commute request yet.</p>
            <Link
              to="/"
              className="inline-block rounded-[12px] bg-forest px-4 py-2 text-xs font-medium text-sand"
            >
              Find a Travel Mate
            </Link>
          </div>
        ) : (
          <>
            {(myMatches.data ?? []).map((match) => (
              <div
                key={match.match_id}
                className="space-y-4 rounded-[20px] bg-zinc-50 p-5 ring-1 ring-zinc-950/5"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={
                      match.match_status === "completed"
                        ? "rounded-full bg-zinc-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-700"
                        : "rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-900"
                    }
                  >
                    {match.match_status === "completed" ? "Completed" : "Matched"}
                  </span>
                  <span className="text-xs text-zinc-400">
                    Ref #{match.match_id.slice(0, 8).toUpperCase()}
                  </span>
                </div>

                <Link
                  to="/profile/$userId"
                  params={{ userId: match.counterpart_id }}
                  className="flex items-start gap-4"
                >
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-forest/10 text-base font-semibold text-forest outline-1 -outline-offset-1 outline-black/5">
                    {match.counterpart_display_name.charAt(0) || "?"}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      {match.counterpart_display_name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {match.counterpart_mode === "car" ? "Driving" : "Bus"} · To{" "}
                      {match.counterpart_destination}
                    </div>
                  </div>
                </Link>

                <div className="pt-2">
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="z-10 size-2.5 rounded-full border-2 border-transit-car bg-sand" />
                      <div className="-my-0.5 h-12 w-0.5 bg-zinc-200" />
                    </div>
                    <div className="pb-4">
                      <div className="text-xs font-semibold text-zinc-900">
                        {formatTime(match.counterpart_requested_time)} Pickup
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {match.counterpart_starting_point}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="z-10 size-2.5 rounded-full bg-forest" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">
                        {match.counterpart_destination}
                      </div>
                      <div className="text-[11px] text-zinc-500">Arrival</div>
                    </div>
                  </div>
                </div>

                {match.match_status !== "completed" ? (
                  Date.now() >=
                  Math.max(
                    new Date(match.my_requested_time).getTime(),
                    new Date(match.counterpart_requested_time).getTime(),
                  ) ? (
                    <button
                      type="button"
                      onClick={() => markCompleted(match.match_id)}
                      className="w-full rounded-[12px] bg-forest py-2 text-xs font-medium text-sand"
                    >
                      Mark trip as completed
                    </button>
                  ) : (
                    <p className="text-center text-[11px] text-zinc-400">
                      You can mark this trip complete once it's happened.
                    </p>
                  )
                ) : ratedTripIds.has(match.match_id) ||
                  dismissedRatingPrompts.has(match.match_id) ? null : (
                  <RatingForm
                    tripId={match.match_id}
                    onDone={() => {
                      setDismissedRatingPrompts((prev) => new Set(prev).add(match.match_id));
                      queryClient.invalidateQueries({ queryKey: myRatingActivityQueryKey });
                    }}
                  />
                )}

                <Link
                  to="/messages/$threadType/$threadId"
                  params={{ threadType: "match", threadId: match.match_id }}
                  className="flex w-full items-center justify-center gap-2 rounded-[12px] py-2 text-xs font-medium text-forest ring-1 ring-forest hover:bg-forest/5"
                >
                  <MessageCircle className="size-4" />
                  Message {match.counterpart_display_name}
                </Link>
              </div>
            ))}

            {(myBusGroups.data ?? []).length > 0 ? (
              <div>
                <h2 className="mb-3 ml-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Bus Groups
                </h2>
                <div className="space-y-3">
                  {(myBusGroups.data ?? []).map((group) => (
                    <div
                      key={group.trip_request_id}
                      className="space-y-3 rounded-[20px] bg-zinc-50 p-4 ring-1 ring-zinc-950/5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-900">
                          {group.role === "host" ? "Your Post" : "Joined"}
                        </span>
                        <span className="text-xs text-zinc-400">{group.member_count}/6 riders</span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">
                          To {group.destination}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {formatTime(group.requested_time)} · {group.starting_point}
                        </div>
                      </div>
                      {group.other_display_names.length > 0 ? (
                        <p className="text-xs text-zinc-500">
                          With: {group.other_display_names.join(", ")}
                        </p>
                      ) : (
                        <p className="text-xs text-zinc-400">No one else has joined yet.</p>
                      )}
                      <Link
                        to="/messages/$threadType/$threadId"
                        params={{ threadType: "bus", threadId: group.trip_request_id }}
                        className="flex w-full items-center justify-center gap-2 rounded-[12px] py-2 text-xs font-medium text-forest ring-1 ring-forest hover:bg-forest/5"
                      >
                        <MessageCircle className="size-4" />
                        Group chat
                      </Link>
                      {group.role === "member" ? (
                        <button
                          type="button"
                          onClick={() => leaveBusGroup(group.trip_request_id)}
                          className="w-full text-center text-[10px] font-medium text-zinc-500 underline underline-offset-2 hover:text-red-600"
                        >
                          Leave this commute
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {pendingRequests.length > 0 ? (
              <div>
                <h2 className="mb-3 ml-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Pending Requests
                </h2>
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between rounded-[16px] border border-dashed border-zinc-300 bg-zinc-50 p-4"
                    >
                      <div className="text-xs text-zinc-600">
                        {request.mode === "bus" ? "Bus" : "Ride"} to {request.destination}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-zinc-400">
                          {formatTime(request.requested_time)}
                        </span>
                        <button
                          type="button"
                          onClick={() => cancelRequest(request.id)}
                          className="text-[10px] font-medium text-zinc-500 underline underline-offset-2 hover:text-red-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </PhoneShell>
  );
}

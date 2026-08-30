import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Award, Car, Home, Leaf, MessageCircle, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { InfoTooltip } from "@/components/InfoTooltip";
import { PhoneShell } from "@/components/PhoneShell";
import { PlaceAutocompleteInput } from "@/components/PlaceAutocompleteInput";
import { RatingForm } from "@/components/RatingForm";
import { StarDisplay } from "@/components/StarRating";
import { TierBadge } from "@/components/TierBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CO2_EXPLANATION, carbonSavedLbs, milesNotDrivenEquivalent } from "@/lib/carbonSavings";
import { computeProfileCompletion } from "@/lib/profile-completion";
import {
  driverTier,
  GOLD_MIN_RIDES,
  SILVER_MIN_RIDES,
  BRONZE_MIN_RIDES,
} from "@/lib/priorityScore";

export const Route = createFileRoute("/_authed/profile/$userId")({
  head: () => ({
    meta: [{ title: "Profile — Commute Mate" }],
  }),
  component: ProfileScreen,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function ProfileScreen() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOwnProfile = user?.id === userId;

  const stats = useQuery({
    queryKey: ["profile-stats", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("profile_stats", { p_user_id: userId });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  // Kept out of profile_stats() — a home address isn't public, so it's read
  // via a direct table select, which profiles_select_own already restricts
  // to the caller's own row (this query only runs for isOwnProfile anyway).
  const homeAddressQuery = useQuery({
    queryKey: ["my-home-address"],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("home_address, home_lat, home_lng")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isOwnProfile,
  });

  const [homeAddress, setHomeAddress] = useState("");
  // Selecting a suggestion already saves (with resolved lat/lng) and then
  // blurs the field as a side effect — without this flag, that blur would
  // immediately re-save the same address with lat/lng nulled out.
  const homeAddressDirtyRef = useRef(false);
  // Hydrate local state from the server exactly once. Without this guard,
  // a slow first fetch resolving after the user has already started typing
  // would stomp their in-progress edit back to the fetched (stale) value.
  const homeAddressInitializedRef = useRef(false);
  const [expandedRatingTripId, setExpandedRatingTripId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOwnProfile || !homeAddressQuery.data || homeAddressInitializedRef.current) return;
    homeAddressInitializedRef.current = true;
    setHomeAddress(homeAddressQuery.data.home_address ?? "");
  }, [isOwnProfile, homeAddressQuery.data]);

  const saveHomeAddress = useMutation({
    mutationFn: async (next: { address: string; lat: number | null; lng: number | null }) => {
      if (!user) return;
      const { error } = await supabase
        .from("profiles")
        .update({
          home_address: next.address || null,
          home_lat: next.lat,
          home_lng: next.lng,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-home-address"] });
    },
  });

  // Public: any viewer sees written reviews (stars + comment) once both
  // trip partners have rated each other, same mutual-reveal rule as
  // before — just no longer limited to the two participants themselves.
  const reviews = useQuery({
    queryKey: ["profile-reviews", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("profile_reviews", { p_user_id: userId });
      if (error) throw error;
      return data;
    },
  });

  const tripHistory = useQuery({
    queryKey: ["my-trip-history"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_trip_history");
      if (error) throw error;
      return data;
    },
    enabled: isOwnProfile,
  });

  const ratingActivity = useQuery({
    queryKey: ["my-rating-activity"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_rating_activity");
      if (error) throw error;
      return data;
    },
    enabled: isOwnProfile,
  });

  const given = (ratingActivity.data ?? []).filter((r) => r.direction === "given");
  const ratedTripIds = new Set(given.map((r) => r.trip_id));

  const notifications = useQuery({
    queryKey: ["my-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_notifications");
      if (error) throw error;
      return data;
    },
    enabled: isOwnProfile,
  });
  const unreadCount = (notifications.data ?? []).filter((n) => !n.read_at).length;

  // Only the profile owner can see their own completion — it indirectly
  // reveals how much private enrichment data exists, same reasoning as
  // why the fields themselves stay private (see profile_details RLS).
  const myDetails = useQuery({
    queryKey: ["my-profile-details"],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profile_details")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isOwnProfile,
  });

  const completion = isOwnProfile ? computeProfileCompletion(myDetails.data ?? null) : null;

  const tier = stats.data ? driverTier(stats.data.average_stars, stats.data.rides_given) : null;
  const ridesGiven = stats.data?.rides_given ?? 0;
  const nextTierThreshold =
    tier === "gold"
      ? null
      : tier === "silver"
        ? GOLD_MIN_RIDES
        : tier === "bronze"
          ? SILVER_MIN_RIDES
          : BRONZE_MIN_RIDES;
  const prevTierThreshold =
    tier === "gold"
      ? GOLD_MIN_RIDES
      : tier === "silver"
        ? SILVER_MIN_RIDES
        : tier === "bronze"
          ? BRONZE_MIN_RIDES
          : 0;
  const tierProgressPct = nextTierThreshold
    ? Math.min(
        100,
        Math.round(
          ((ridesGiven - prevTierThreshold) / (nextTierThreshold - prevTierThreshold)) * 100,
        ),
      )
    : 100;

  const lbsSaved = stats.data ? carbonSavedLbs(stats.data.completed_trip_count) : 0;

  return (
    <PhoneShell {...(isOwnProfile ? { active: "profile" as const, showSignOut: true } : {})}>
      <header className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.history.back()}
            aria-label="Back"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="mr-16 min-w-0 flex-1">
            <h1 className="truncate text-balance font-serif text-2xl font-medium leading-tight text-forest">
              {stats.isLoading ? "Profile" : (stats.data?.full_name ?? "Unknown student")}
            </h1>
            {stats.data?.school ? (
              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {stats.data.school}
                {stats.data.degree_pursuit ? ` · ${stats.data.degree_pursuit}` : ""}
                {stats.data.degree_pursuit === "Alumni" && stats.data.graduation_year
                  ? ` '${String(stats.data.graduation_year).slice(-2)}`
                  : ""}
              </p>
            ) : null}
          </div>
        </div>
        {isOwnProfile ? (
          <div className="mt-3 pl-11">
            <Link
              to="/profile/edit"
              className="inline-block shrink-0 rounded-full bg-forest px-3 py-1.5 text-[11px] font-medium text-sand"
            >
              Edit Profile
            </Link>
          </div>
        ) : null}
      </header>

      {completion ? (
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>Profile {completion.percent}% complete</span>
            <span>
              {completion.answered}/{completion.total}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-forest transition-all"
              style={{ width: `${completion.percent}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6">
        {stats.isLoading ? (
          <p className="p-4 text-center text-xs text-zinc-400">Loading profile…</p>
        ) : !stats.data ? (
          <p className="p-4 text-center text-xs text-zinc-400">Profile not found.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[20px] bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest text-sand">
                <Leaf className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-sm font-bold text-forest">
                  {lbsSaved.toLocaleString()} lbs CO₂ saved
                  <InfoTooltip text={CO2_EXPLANATION} className="text-zinc-500" />
                </p>
                <p className="text-[11px] text-zinc-500">
                  ≈ {milesNotDrivenEquivalent(lbsSaved).toLocaleString()} miles of solo driving
                  avoided by sharing rides
                </p>
              </div>
            </div>

            {isOwnProfile ? (
              <div className="rounded-[16px] bg-zinc-50 p-3 ring-1 ring-zinc-950/5">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-zinc-500">
                  <Home className="size-3.5" />
                  Home Address
                  <InfoTooltip text="Used to show how far each posting is from home in the browse feed." />
                </div>
                <PlaceAutocompleteInput
                  value={homeAddress}
                  onTextChange={(text) => {
                    homeAddressDirtyRef.current = true;
                    setHomeAddress(text);
                  }}
                  onPlaceSelected={(place) => {
                    homeAddressDirtyRef.current = false;
                    setHomeAddress(place.address);
                    saveHomeAddress.mutate({
                      address: place.address,
                      lat: place.lat,
                      lng: place.lng,
                    });
                  }}
                  onBlur={() => {
                    if (!homeAddressDirtyRef.current) return;
                    homeAddressDirtyRef.current = false;
                    saveHomeAddress.mutate({ address: homeAddress, lat: null, lng: null });
                  }}
                  placeholder="Where do you live?"
                  className="w-full rounded-[10px] bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200 focus:ring-forest"
                />
              </div>
            ) : null}

            <div className="overflow-hidden rounded-[20px] bg-gradient-to-br from-forest to-forest/80 p-5 text-sand shadow-lg shadow-forest/20">
              <div className="flex items-center justify-between">
                <StarDisplay
                  average={stats.data.average_stars}
                  emptyLabel="No ratings yet"
                  className="inline-flex items-center gap-1.5 text-base font-semibold"
                />
                <TierBadge tier={tier} />
              </div>

              {stats.data.open_to_networking_chat ? (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-sand/15 px-2 py-1 text-[10px] font-medium">
                  <MessageCircle className="size-3" />
                  Open to a networking chat
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[14px] bg-sand/10 p-3">
                  <div className="flex items-center gap-1.5 text-sand/70">
                    <Car className="size-3.5" />
                    <span className="text-[10px] font-medium tracking-wide">Trips</span>
                  </div>
                  <p className="mt-1 text-xl font-bold">{stats.data.completed_trip_count}</p>
                </div>
                <div className="rounded-[14px] bg-sand/10 p-3">
                  <div className="flex items-center gap-1.5 text-sand/70">
                    <Sparkles className="size-3.5" />
                    <span className="text-[10px] font-medium tracking-wide">Rides Given</span>
                  </div>
                  <p className="mt-1 text-xl font-bold">{ridesGiven}</p>
                </div>
              </div>

              {nextTierThreshold ? (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10px] text-sand/70">
                    <span className="flex items-center gap-1">
                      <Award className="size-3" />
                      Next tier
                    </span>
                    <span>
                      {ridesGiven}/{nextTierThreshold} rides
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sand/20">
                    <div
                      className="h-full rounded-full bg-sand transition-all"
                      style={{ width: `${tierProgressPct}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {isOwnProfile ? (
              <Link
                to="/messages"
                className="flex items-center gap-3 rounded-[16px] bg-zinc-50 p-3.5 ring-1 ring-zinc-950/5 transition-colors hover:bg-zinc-100"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-forest/10 text-forest">
                  <MessageCircle className="size-4" />
                </div>
                <span className="flex-1 text-sm font-medium text-zinc-900">Messages</span>
                {unreadCount > 0 ? (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            ) : null}
          </div>
        )}

        <section>
          <h2 className="mb-3 ml-1 text-[11px] font-medium tracking-wider text-zinc-500">
            Reviews
          </h2>
          {reviews.isLoading ? (
            <p className="text-xs text-zinc-400">Loading…</p>
          ) : !reviews.data || reviews.data.length === 0 ? (
            <p className="text-xs text-zinc-400">
              No reviews visible yet — they unlock once both trip partners have rated each other.
            </p>
          ) : (
            <div className="space-y-2">
              {reviews.data.map((r, i) => (
                <div key={i} className="rounded-[14px] bg-zinc-50 p-3 ring-1 ring-zinc-950/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-900">{r.rater_name}</span>
                    <StarDisplay average={r.stars} emptyLabel="No stars" />
                  </div>
                  {r.comment ? <p className="mt-1 text-[11px] text-zinc-600">{r.comment}</p> : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {isOwnProfile ? (
          <>
            <section>
              <h2 className="mb-3 ml-1 text-[11px] font-medium tracking-wider text-zinc-500">
                Trip History
              </h2>
              {tripHistory.isLoading ? (
                <p className="text-xs text-zinc-400">Loading…</p>
              ) : !tripHistory.data || tripHistory.data.length === 0 ? (
                <p className="text-xs text-zinc-400">No completed trips yet.</p>
              ) : (
                <div className="space-y-2">
                  {tripHistory.data.map((trip) => (
                    <div
                      key={trip.trip_id}
                      className="rounded-[14px] bg-zinc-50 p-3 ring-1 ring-zinc-950/5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-900">
                          {trip.counterpart_name}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {trip.completed_at ? formatDate(trip.completed_at) : ""}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-500">To {trip.my_destination}</p>
                      {!ratedTripIds.has(trip.trip_id) ? (
                        expandedRatingTripId === trip.trip_id ? (
                          <div className="mt-2">
                            <RatingForm
                              tripId={trip.trip_id}
                              onDone={() => {
                                setExpandedRatingTripId(null);
                                queryClient.invalidateQueries({
                                  queryKey: ["my-rating-activity"],
                                });
                              }}
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpandedRatingTripId(trip.trip_id)}
                            className="mt-2 rounded-[10px] bg-forest px-3 py-1.5 text-[11px] font-medium text-sand"
                          >
                            Rate this trip
                          </button>
                        )
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-3 ml-1 text-[11px] font-medium tracking-wider text-zinc-500">
                Ratings You've Given
              </h2>
              {ratingActivity.isLoading ? (
                <p className="text-xs text-zinc-400">Loading…</p>
              ) : given.length === 0 ? (
                <p className="text-xs text-zinc-400">You haven't rated anyone yet.</p>
              ) : (
                <div className="space-y-2">
                  {given.map((r) => (
                    <div
                      key={`${r.trip_id}-given`}
                      className="rounded-[14px] bg-zinc-50 p-3 ring-1 ring-zinc-950/5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-900">
                          {r.counterpart_name}
                        </span>
                        <StarDisplay average={r.stars} emptyLabel="No stars" />
                      </div>
                      {r.comment ? (
                        <p className="mt-1 text-[11px] text-zinc-600">{r.comment}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </PhoneShell>
  );
}

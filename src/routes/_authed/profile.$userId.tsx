import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Award, Car, GraduationCap, Leaf, MessageCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { PhoneShell } from "@/components/PhoneShell";
import { SearchableSelect } from "@/components/SearchableSelect";
import { StarDisplay } from "@/components/StarRating";
import { TierBadge } from "@/components/TierBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { carbonSavedLbs, milesNotDrivenEquivalent } from "@/lib/carbonSavings";
import {
  driverTier,
  GOLD_MIN_RIDES,
  SILVER_MIN_RIDES,
  BRONZE_MIN_RIDES,
} from "@/lib/priorityScore";
import { SCHOOL_OPTIONS, DEGREE_PURSUIT_OPTIONS } from "@/lib/signup-constants";

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

  const [school, setSchool] = useState("");
  const [degreePursuit, setDegreePursuit] = useState("");
  const [graduationYear, setGraduationYear] = useState("");

  useEffect(() => {
    if (!isOwnProfile || !stats.data) return;
    setSchool(stats.data.school ?? "");
    setDegreePursuit(stats.data.degree_pursuit ?? "");
    setGraduationYear(stats.data.graduation_year ? String(stats.data.graduation_year) : "");
  }, [isOwnProfile, stats.data]);

  const saveSchoolInfo = useMutation({
    mutationFn: async (next: { school: string; degreePursuit: string; graduationYear: string }) => {
      if (!user) return;
      const { error } = await supabase
        .from("profiles")
        .update({
          school: next.school || null,
          degree_pursuit: next.degreePursuit || null,
          graduation_year: next.graduationYear ? Number(next.graduationYear) : null,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-stats", userId] });
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
    <PhoneShell {...(isOwnProfile ? { active: "profile" as const } : {})}>
      <header className="flex items-center gap-3 p-6 pb-4">
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label="Back"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-balance font-serif text-2xl font-medium leading-tight text-forest">
          {stats.isLoading ? "Profile" : (stats.data?.full_name ?? "Unknown student")}
        </h1>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6">
        {stats.isLoading ? (
          <p className="p-4 text-center text-xs text-zinc-400">Loading profile…</p>
        ) : !stats.data ? (
          <p className="p-4 text-center text-xs text-zinc-400">Profile not found.</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[20px] bg-gradient-to-br from-forest to-forest/80 p-5 text-sand shadow-lg shadow-forest/20">
              <div className="flex items-center justify-between">
                <StarDisplay
                  average={stats.data.average_stars}
                  emptyLabel="No ratings yet"
                  className="inline-flex items-center gap-1.5 text-base font-semibold"
                />
                <TierBadge tier={tier} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[14px] bg-sand/10 p-3">
                  <div className="flex items-center gap-1.5 text-sand/70">
                    <Car className="size-3.5" />
                    <span className="text-[10px] font-medium uppercase tracking-wide">Trips</span>
                  </div>
                  <p className="mt-1 text-xl font-bold">{stats.data.completed_trip_count}</p>
                </div>
                <div className="rounded-[14px] bg-sand/10 p-3">
                  <div className="flex items-center gap-1.5 text-sand/70">
                    <Sparkles className="size-3.5" />
                    <span className="text-[10px] font-medium uppercase tracking-wide">
                      Rides Given
                    </span>
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
                      className="h-full rounded-full bg-amber-300 transition-all"
                      style={{ width: `${tierProgressPct}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            {isOwnProfile ? (
              <div className="rounded-[20px] bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
                <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  <GraduationCap className="size-3.5" />
                  School
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-zinc-400">
                      School / Department
                    </label>
                    <SearchableSelect
                      value={school}
                      onChange={(value) => {
                        setSchool(value);
                        saveSchoolInfo.mutate({
                          school: value,
                          degreePursuit,
                          graduationYear,
                        });
                      }}
                      options={SCHOOL_OPTIONS}
                      placeholder="Select your school…"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-zinc-400">
                        Degree Pursuit
                      </label>
                      <SearchableSelect
                        value={degreePursuit}
                        onChange={(value) => {
                          setDegreePursuit(value);
                          const nextGradYear = value === "Alumni" ? graduationYear : "";
                          setGraduationYear(nextGradYear);
                          saveSchoolInfo.mutate({
                            school,
                            degreePursuit: value,
                            graduationYear: nextGradYear,
                          });
                        }}
                        options={DEGREE_PURSUIT_OPTIONS}
                        placeholder="Select…"
                      />
                    </div>
                    {degreePursuit === "Alumni" ? (
                      <div>
                        <label
                          htmlFor="graduation-year"
                          className="mb-1 block text-[10px] font-medium text-zinc-400"
                        >
                          Grad Year
                        </label>
                        <input
                          id="graduation-year"
                          type="number"
                          value={graduationYear}
                          onChange={(e) => setGraduationYear(e.target.value)}
                          onBlur={() =>
                            saveSchoolInfo.mutate({ school, degreePursuit, graduationYear })
                          }
                          placeholder="e.g. 2022"
                          className="w-full rounded-[10px] bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200 focus:ring-forest"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : stats.data.school ? (
              <div className="flex items-center gap-2 rounded-[16px] bg-zinc-50 p-3.5 ring-1 ring-zinc-950/5">
                <GraduationCap className="size-4 shrink-0 text-zinc-400" />
                <p className="text-xs font-medium text-zinc-700">
                  {stats.data.school}
                  {stats.data.degree_pursuit ? ` · ${stats.data.degree_pursuit}` : ""}
                  {stats.data.degree_pursuit === "Alumni" && stats.data.graduation_year
                    ? ` '${String(stats.data.graduation_year).slice(-2)}`
                    : ""}
                </p>
              </div>
            ) : null}

            <div className="flex items-center gap-3 rounded-[20px] bg-emerald-50 p-4 ring-1 ring-emerald-900/10">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Leaf className="size-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-900">
                  {lbsSaved.toLocaleString()} lbs CO₂ saved
                </p>
                <p className="text-[11px] text-emerald-700">
                  ≈ {milesNotDrivenEquivalent(lbsSaved).toLocaleString()} miles of solo driving
                  avoided by sharing rides
                </p>
              </div>
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
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-forest text-[10px] font-bold text-sand">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            ) : null}
          </div>
        )}

        <section>
          <h2 className="mb-3 ml-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
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
              <h2 className="mb-3 ml-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
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
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-3 ml-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
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

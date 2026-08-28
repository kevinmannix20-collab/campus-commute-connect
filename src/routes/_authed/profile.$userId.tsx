import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { PhoneShell } from "@/components/PhoneShell";
import { StarDisplay } from "@/components/StarRating";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

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
  const isOwnProfile = user?.id === userId;

  const stats = useQuery({
    queryKey: ["profile-stats", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("profile_stats", { p_user_id: userId });
      if (error) throw error;
      return data?.[0] ?? null;
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

  return (
    <PhoneShell>
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
          <div className="space-y-3 rounded-[20px] bg-zinc-50 p-5 ring-1 ring-zinc-950/5">
            <StarDisplay
              average={stats.data.average_stars}
              emptyLabel="No ratings yet"
              className="inline-flex items-center gap-1.5 text-base font-semibold text-zinc-900"
            />
            <p className="text-xs text-zinc-500">
              {stats.data.completed_trip_count}{" "}
              {stats.data.completed_trip_count === 1 ? "completed trip" : "completed trips"}
            </p>
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

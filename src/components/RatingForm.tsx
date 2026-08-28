import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { StarInput } from "@/components/StarRating";
import { supabase } from "@/integrations/supabase/client";

export function RatingForm({ tripId, onDone }: { tripId: string; onDone: () => void }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("submit_rating", {
        p_trip_id: tripId,
        p_stars: stars || null,
        p_comment: comment.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: onDone,
  });

  const hasInput = stars > 0 || comment.trim().length > 0;

  return (
    <div className="space-y-3 rounded-[16px] bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
      <p className="text-xs font-medium text-zinc-700">Rate your trip partner</p>
      <StarInput value={stars} onChange={setStars} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Leave a comment (optional)"
        rows={2}
        className="w-full rounded-[10px] bg-white px-3 py-2 text-xs text-zinc-900 outline-none ring-1 ring-zinc-200 placeholder:text-zinc-400"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-[10px] px-3 py-2 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => submit.mutate()}
          disabled={submit.isPending || !hasInput}
          className="flex-1 rounded-[10px] bg-forest px-3 py-2 text-xs font-medium text-sand disabled:opacity-50"
        >
          {submit.isPending ? "Submitting…" : "Submit"}
        </button>
      </div>
      {submit.isError ? (
        <p className="text-xs text-red-600">
          {submit.error instanceof Error ? submit.error.message : "Something went wrong"}
        </p>
      ) : null}
    </div>
  );
}

import type { Database } from "@/integrations/supabase/types";

type ProfileDetailsRow = Database["public"]["Tables"]["profile_details"]["Row"];

// The 3 boolean fields (fragrance_free_preferred, ok_with_food_drink,
// open_to_networking_chat) are declared nullable in the
// profile_enrichment_details migration specifically so "never answered"
// (null) is distinguishable from a deliberate "no" (false) — both are
// counted as "answered" below, since a deliberate no is still an answer.
// If these columns were ever changed to non-nullable-with-default-false,
// this function would need to drop them from the count (there'd be no way
// to tell "skipped" from "answered no" anymore).
const BOOLEAN_FIELDS = [
  "fragrance_free_preferred",
  "ok_with_food_drink",
  "open_to_networking_chat",
] as const;

const TEXT_OR_SELECT_FIELDS = [
  "conversation_style",
  "temperature_preference",
  "pet_preference",
  "hometown",
  "languages_spoken",
  "target_field",
  "dream_role_or_company",
  "fun_fact",
] as const;

const ARRAY_FIELDS = ["music_preference", "hobbies"] as const;

// School + degree/pursuit are collected at signup and required there, so
// they always count as answered here — this function doesn't need (and
// isn't given) those values. graduation_year is deliberately excluded:
// it's only applicable to alumni, so folding it into a fixed-size
// completion percentage would cap everyone else below 100%.
const ALWAYS_ANSWERED_COUNT = 2;

const TOTAL_FIELDS =
  ALWAYS_ANSWERED_COUNT +
  TEXT_OR_SELECT_FIELDS.length +
  ARRAY_FIELDS.length +
  BOOLEAN_FIELDS.length;

export function computeProfileCompletion(details: ProfileDetailsRow | null): {
  answered: number;
  total: number;
  percent: number;
} {
  let answered = ALWAYS_ANSWERED_COUNT;

  for (const field of TEXT_OR_SELECT_FIELDS) {
    if (details?.[field]) answered += 1;
  }
  for (const field of ARRAY_FIELDS) {
    if ((details?.[field]?.length ?? 0) > 0) answered += 1;
  }
  for (const field of BOOLEAN_FIELDS) {
    if (details?.[field] !== null && details?.[field] !== undefined) answered += 1;
  }

  return {
    answered,
    total: TOTAL_FIELDS,
    percent: Math.round((answered / TOTAL_FIELDS) * 100),
  };
}

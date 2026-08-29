// Option lists for the profile-enrichment form. Mirrors the CHECK
// constraints in the profile_enrichment_details migration — keep both in
// sync if these ever change.

export const MUSIC_PREFERENCE_OPTIONS = [
  "Pop",
  "Hip-Hop/R&B",
  "Rock/Indie",
  "EDM/Electronic",
  "Podcasts",
  "Quiet/no music",
] as const;

export const CONVERSATION_STYLE_OPTIONS = [
  "Love to chat",
  "Depends on my mood",
  "Prefer quiet",
] as const;

export const TEMPERATURE_PREFERENCE_OPTIONS = [
  "Runs hot (likes AC)",
  "Runs cold (likes heat)",
  "No preference",
] as const;

export const PET_PREFERENCE_OPTIONS = ["Pet-friendly", "Prefer no pets", "No preference"] as const;

export const HOBBIES_OPTIONS = [
  "Hiking/Outdoors",
  "Fitness/Sports",
  "Cooking/Food",
  "Music/Concerts",
  "Travel",
  "Reading",
  "Gaming/Art",
] as const;

export const TARGET_FIELD_OPTIONS = [
  "Business/Consulting",
  "Tech/Engineering",
  "Healthcare/Medicine",
  "Creative/Arts",
  "Law/Policy",
  "Academia/Research",
  "Entrepreneurship",
] as const;

export const FUN_FACT_MAX_LENGTH = 100;

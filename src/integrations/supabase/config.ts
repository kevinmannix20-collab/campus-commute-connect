// Project URL and publishable key are not secrets — Supabase's own docs
// call the publishable key "safe to use in a browser" when RLS is on
// (which it is; see supabase/migrations/). They're hardcoded as fallbacks
// here because Lovable's Secrets store rejects both VITE_-prefixed names
// (must be committed to a checked-in .env, which this repo deliberately
// doesn't do) and anything starting with SUPABASE_ (reserved for
// Lovable's own Cloud integration). Env vars still override these for
// local dev against a different project.
export const SUPABASE_URL =
  import.meta.env["VITE_SUPABASE_URL"] ||
  process.env["APP_SUPABASE_URL"] ||
  "https://yiotfvqekulxlwhfxbfu.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  process.env["APP_SUPABASE_PUBLISHABLE_KEY"] ||
  "sb_publishable_ilabDszFWkCXosgXMCn20Q_FV9rs-I_";

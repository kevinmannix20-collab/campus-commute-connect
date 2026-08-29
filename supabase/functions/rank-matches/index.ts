// Ranks and explains already-hard-filtered trip request candidates using
// an AI reasoning pass over profile enrichment data. Design intent: the
// hard filter (open_trip_requests()'s status/ownership/time checks) is
// what guarantees a candidate is a *valid* match — this function never
// re-evaluates that. It only adds a soft compatibility judgment on top of
// candidates that are already valid, and the caller skips calling this
// entirely when there's nothing meaningful to rank (0-1 candidates).
//
// Runs server-side because it needs both the OpenAI API key (must never
// reach the browser) and other users' profile_details rows, which RLS
// deliberately keeps unreadable to any client outside their owner — this
// function reads them with the service-role key, sends only the specific
// fields a person actually filled in to the model, and returns nothing
// back to the browser except a ranked list and short reasons.

import { createClient } from "npm:@supabase/supabase-js@2";

type CandidateInput = {
  trip_request_id: string;
  requester_id: string;
  starting_point: string;
  destination: string;
  mode: string;
  requested_time: string;
};

type RequestBody = {
  candidates: CandidateInput[];
};

type ProfileDetailsRow = {
  music_preference: string[] | null;
  conversation_style: string | null;
  temperature_preference: string | null;
  fragrance_free_preferred: boolean | null;
  pet_preference: string | null;
  ok_with_food_drink: boolean | null;
  hometown: string | null;
  languages_spoken: string | null;
  hobbies: string[] | null;
  target_field: string | null;
  dream_role_or_company: string | null;
  open_to_networking_chat: boolean | null;
  fun_fact: string | null;
};

// Only include fields the person actually filled in — never send nulls or
// invented placeholders, so the model only ever references real answers.
function summarizeProfile(row: ProfileDetailsRow | null): Record<string, unknown> {
  if (!row) return {};
  const out: Record<string, unknown> = {};
  if (row.music_preference && row.music_preference.length > 0) {
    out.music_preference = row.music_preference;
  }
  if (row.conversation_style) out.conversation_style = row.conversation_style;
  if (row.temperature_preference) out.temperature_preference = row.temperature_preference;
  if (row.fragrance_free_preferred !== null) {
    out.fragrance_free_preferred = row.fragrance_free_preferred;
  }
  if (row.pet_preference) out.pet_preference = row.pet_preference;
  if (row.ok_with_food_drink !== null) out.ok_with_food_drink = row.ok_with_food_drink;
  if (row.hometown) out.hometown = row.hometown;
  if (row.languages_spoken) out.languages_spoken = row.languages_spoken;
  if (row.hobbies && row.hobbies.length > 0) out.hobbies = row.hobbies;
  if (row.target_field) out.target_field = row.target_field;
  if (row.dream_role_or_company) out.dream_role_or_company = row.dream_role_or_company;
  if (row.open_to_networking_chat !== null) {
    out.open_to_networking_chat = row.open_to_networking_chat;
  }
  if (row.fun_fact) out.fun_fact = row.fun_fact;
  return out;
}

const RANKING_SCHEMA = {
  name: "candidate_rankings",
  strict: true,
  schema: {
    type: "object",
    properties: {
      rankings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            candidate_id: { type: "string" },
            rank: { type: "integer" },
            reason: { type: "string" },
          },
          required: ["candidate_id", "rank", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["rankings"],
    additionalProperties: false,
  },
} as const;

const SYSTEM_PROMPT = `You help a college ridesharing app rank commute candidates for a viewer.
Every candidate has ALREADY passed a hard filter (route/time/mode) — that part is guaranteed valid and you must not re-evaluate it.
Your only job: rank candidates best-to-worst by soft personal compatibility with the viewer, and give each a one-sentence, natural-language reason.
Consider: conversation style fit, shared interests/hobbies, comfort preference compatibility (e.g. both fragrance-free, compatible pet preferences), shared or complementary career interests, and whether the fun fact suggests a good icebreaker.
Reference specific real shared details when they exist (e.g. "You're both into hiking and thinking about product roles, might be a fun ride to compare notes").
If two people share little beyond the route, keep the reason simple and neutral (e.g. "Same route and timing, no major shared interests found, but should be an easy ride") — never invent or force a connection that isn't there.
If a candidate (or the viewer) has little or no profile data, fall back to a route/timing-based reason rather than awkwardly referencing missing data.
Return every candidate exactly once, ranked 1 through N.`;

function buildUserPrompt(
  viewerProfile: Record<string, unknown>,
  candidates: CandidateInput[],
  candidateProfiles: Map<string, Record<string, unknown>>,
) {
  return JSON.stringify({
    viewer: viewerProfile,
    candidates: candidates.map((c) => ({
      candidate_id: c.trip_request_id,
      starting_point: c.starting_point,
      destination: c.destination,
      mode: c.mode,
      requested_time: c.requested_time,
      profile: candidateProfiles.get(c.requester_id) ?? {},
    })),
  });
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    // Validate the caller is a real, currently-authenticated user before
    // doing anything privileged with the service-role client below.
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = (await req.json()) as RequestBody;
    const candidates = body.candidates ?? [];

    // Nothing meaningful to rank — the client shouldn't call this for
    // fewer than 2 candidates, but guard here too rather than trust that.
    if (candidates.length < 2) {
      return new Response(
        JSON.stringify({
          rankings: candidates.map((c, i) => ({
            candidate_id: c.trip_request_id,
            rank: i + 1,
            reason: null,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Service-role client only to read the specific profile_details rows
    // needed here — RLS would otherwise block reading anyone but yourself.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const candidateUserIds = [...new Set(candidates.map((c) => c.requester_id))];
    const [{ data: viewerRow }, { data: candidateRows, error: candidatesError }] =
      await Promise.all([
        adminClient.from("profile_details").select("*").eq("user_id", user.id).maybeSingle(),
        adminClient.from("profile_details").select("*").in("user_id", candidateUserIds),
      ]);
    if (candidatesError) throw candidatesError;

    const profileByUserId = new Map<string, Record<string, unknown>>();
    for (const row of candidateRows ?? []) {
      profileByUserId.set(row.user_id, summarizeProfile(row));
    }

    const viewerProfile = summarizeProfile(viewerRow ?? null);
    const userPrompt = buildUserPrompt(viewerProfile, candidates, profileByUserId);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    let openaiResponse: Response;
    try {
      openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_schema", json_schema: RANKING_SCHEMA },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!openaiResponse.ok) {
      const detail = await openaiResponse.text();
      throw new Error(`OpenAI request failed (${openaiResponse.status}): ${detail}`);
    }

    const completion = await openaiResponse.json();
    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI response had no content");

    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.rankings)) throw new Error("Malformed ranking response");

    // Guard against the model dropping or duplicating a candidate —
    // fall back to plain order for anything it didn't account for.
    const validIds = new Set(candidates.map((c) => c.trip_request_id));
    const seen = new Set<string>();
    const rankings = parsed.rankings.filter(
      (r: { candidate_id: string }) =>
        validIds.has(r.candidate_id) && !seen.has(r.candidate_id) && seen.add(r.candidate_id),
    );
    for (const c of candidates) {
      if (!seen.has(c.trip_request_id)) {
        rankings.push({ candidate_id: c.trip_request_id, rank: rankings.length + 1, reason: null });
      }
    }

    return new Response(JSON.stringify({ rankings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("rank-matches error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});

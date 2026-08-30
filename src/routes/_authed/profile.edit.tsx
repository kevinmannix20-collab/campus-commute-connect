import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import { PhoneShell } from "@/components/PhoneShell";
import { SearchableSelect } from "@/components/SearchableSelect";
import { PillSelect, TagMultiSelect } from "@/components/TagSelect";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  CONVERSATION_STYLE_OPTIONS,
  FUN_FACT_MAX_LENGTH,
  HOBBIES_OPTIONS,
  MUSIC_PREFERENCE_OPTIONS,
  PET_PREFERENCE_OPTIONS,
  TARGET_FIELD_OPTIONS,
  TEMPERATURE_PREFERENCE_OPTIONS,
} from "@/lib/profile-details-options";
import { DEGREE_PURSUIT_OPTIONS, GRADUATION_YEARS, SCHOOL_OPTIONS } from "@/lib/signup-constants";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authed/profile/edit")({
  head: () => ({
    meta: [{ title: "Edit profile — Commute Mate" }],
  }),
  component: ProfileEditScreen,
});

type ProfileDetailsRow = Database["public"]["Tables"]["profile_details"]["Row"];
type ProfileBasicsRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "school" | "degree_pursuit" | "graduation_year"
>;

type FormState = {
  school: string | null;
  degreePursuit: string | null;
  graduationYear: string;
  music_preference: string[];
  conversation_style: string | null;
  temperature_preference: string | null;
  fragrance_free_preferred: boolean | null;
  pet_preference: string | null;
  ok_with_food_drink: boolean | null;
  hometown: string;
  languages_spoken: string;
  hobbies: string[];
  target_field: string | null;
  dream_role_or_company: string;
  open_to_networking_chat: boolean | null;
  fun_fact: string;
};

function toFormState(
  basics: ProfileBasicsRow | null,
  details: ProfileDetailsRow | null,
): FormState {
  return {
    school: basics?.school ?? null,
    degreePursuit: basics?.degree_pursuit ?? null,
    graduationYear: basics?.graduation_year ? String(basics.graduation_year) : "",
    music_preference: details?.music_preference ?? [],
    conversation_style: details?.conversation_style ?? null,
    temperature_preference: details?.temperature_preference ?? null,
    fragrance_free_preferred: details?.fragrance_free_preferred ?? null,
    pet_preference: details?.pet_preference ?? null,
    ok_with_food_drink: details?.ok_with_food_drink ?? null,
    hometown: details?.hometown ?? "",
    languages_spoken: details?.languages_spoken ?? "",
    hobbies: details?.hobbies ?? [],
    target_field: details?.target_field ?? null,
    dream_role_or_company: details?.dream_role_or_company ?? "",
    open_to_networking_chat: details?.open_to_networking_chat ?? null,
    fun_fact: details?.fun_fact ?? "",
  };
}

// Renders a boolean field as a Yes/No pair using the same pill component
// as the single-select fields — null (never answered) shows neither pill
// selected, matching the tri-state this field's column supports.
function BooleanPillSelect({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <PillSelect
      value={value === null ? null : value ? "Yes" : "No"}
      onChange={(v) => onChange(v === null ? null : v === "Yes")}
      options={["Yes", "No"]}
    />
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="mb-3 ml-1 text-[11px] font-medium tracking-wider text-zinc-500">{children}</h2>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <label className="mb-1.5 ml-1 block text-xs font-medium text-zinc-700">{children}</label>;
}

function ProfileEditScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const basicsQuery = useQuery({
    queryKey: ["my-profile-basics"],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("school, degree_pursuit, graduation_year")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const detailsQuery = useQuery({
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
    enabled: !!user,
  });

  const loading = !user || basicsQuery.isLoading || detailsQuery.isLoading;

  return (
    <PhoneShell active="profile">
      <header className="flex items-center gap-3 p-6 pb-4">
        <button
          type="button"
          onClick={() => router.history.back()}
          aria-label="Back"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="text-balance font-serif text-2xl font-medium leading-tight text-forest">
            Edit Profile
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Add a few details to help us find better matches.
          </p>
        </div>
      </header>

      {loading ? (
        <p className="p-6 text-center text-xs text-zinc-400">Loading…</p>
      ) : (
        <ProfileEditForm
          userId={user.id}
          initialBasics={basicsQuery.data ?? null}
          initialDetails={detailsQuery.data ?? null}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["my-profile-details"] });
            queryClient.invalidateQueries({ queryKey: ["my-profile-basics"] });
            queryClient.invalidateQueries({ queryKey: ["profile-stats", user.id] });
            router.history.back();
          }}
        />
      )}
    </PhoneShell>
  );
}

function ProfileEditForm({
  userId,
  initialBasics,
  initialDetails,
  onSaved,
}: {
  userId: string;
  initialBasics: ProfileBasicsRow | null;
  initialDetails: ProfileDetailsRow | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(initialBasics, initialDetails));
  const router = useRouter();

  const save = useMutation({
    mutationFn: async () => {
      const isAlumni = form.degreePursuit === "Alumni";

      const { error: basicsError } = await supabase
        .from("profiles")
        .update({
          school: form.school,
          degree_pursuit: form.degreePursuit,
          graduation_year: isAlumni && form.graduationYear ? Number(form.graduationYear) : null,
        })
        .eq("id", userId);
      if (basicsError) throw basicsError;

      const { error: detailsError } = await supabase.from("profile_details").upsert({
        user_id: userId,
        music_preference: form.music_preference,
        conversation_style: form.conversation_style,
        temperature_preference: form.temperature_preference,
        fragrance_free_preferred: form.fragrance_free_preferred,
        pet_preference: form.pet_preference,
        ok_with_food_drink: form.ok_with_food_drink,
        hometown: form.hometown.trim() || null,
        languages_spoken: form.languages_spoken.trim() || null,
        hobbies: form.hobbies,
        target_field: form.target_field,
        dream_role_or_company: form.dream_role_or_company.trim() || null,
        open_to_networking_chat: form.open_to_networking_chat,
        fun_fact: form.fun_fact.trim() || null,
      });
      if (detailsError) throw detailsError;
    },
    onSuccess: onSaved,
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6">
      <section>
        <SectionLabel>School</SectionLabel>
        <div className="space-y-4 rounded-[20px] bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
          <div>
            <FieldLabel>School / Department</FieldLabel>
            <SearchableSelect
              value={form.school}
              onChange={(v) => set("school", v)}
              options={SCHOOL_OPTIONS}
              placeholder="Select your school…"
            />
          </div>
          <div>
            <FieldLabel>Currently pursuing</FieldLabel>
            <SearchableSelect
              value={form.degreePursuit}
              onChange={(v) => set("degreePursuit", v)}
              options={DEGREE_PURSUIT_OPTIONS}
              placeholder="Select one…"
            />
          </div>
          {form.degreePursuit === "Alumni" ? (
            <div>
              <FieldLabel>Graduation year</FieldLabel>
              <select
                value={form.graduationYear}
                onChange={(e) => set("graduationYear", e.target.value)}
                className="w-full rounded-[12px] bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200"
              >
                <option value="" disabled>
                  Select a year…
                </option>
                {GRADUATION_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <SectionLabel>Music &amp; conversation</SectionLabel>
        <div className="space-y-4 rounded-[20px] bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
          <div>
            <FieldLabel>Music you like (pick any)</FieldLabel>
            <TagMultiSelect
              value={form.music_preference}
              onChange={(v) => set("music_preference", v)}
              options={MUSIC_PREFERENCE_OPTIONS}
            />
          </div>
          <div>
            <FieldLabel>Conversation style</FieldLabel>
            <PillSelect
              value={form.conversation_style}
              onChange={(v) => set("conversation_style", v)}
              options={CONVERSATION_STYLE_OPTIONS}
            />
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>Comfort preferences</SectionLabel>
        <div className="space-y-4 rounded-[20px] bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
          <div>
            <FieldLabel>Temperature</FieldLabel>
            <PillSelect
              value={form.temperature_preference}
              onChange={(v) => set("temperature_preference", v)}
              options={TEMPERATURE_PREFERENCE_OPTIONS}
            />
          </div>
          <div>
            <FieldLabel>Pets</FieldLabel>
            <PillSelect
              value={form.pet_preference}
              onChange={(v) => set("pet_preference", v)}
              options={PET_PREFERENCE_OPTIONS}
            />
          </div>
          <div>
            <FieldLabel>Prefer a fragrance-free ride?</FieldLabel>
            <BooleanPillSelect
              value={form.fragrance_free_preferred}
              onChange={(v) => set("fragrance_free_preferred", v)}
            />
          </div>
          <div>
            <FieldLabel>OK with food/drink in the car?</FieldLabel>
            <BooleanPillSelect
              value={form.ok_with_food_drink}
              onChange={(v) => set("ok_with_food_drink", v)}
            />
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>Icebreakers</SectionLabel>
        <div className="space-y-4 rounded-[20px] bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
          <div>
            <FieldLabel>Hometown</FieldLabel>
            <input
              type="text"
              value={form.hometown}
              onChange={(e) => set("hometown", e.target.value)}
              placeholder="e.g. Mumbai, Chicago, Manila"
              className="w-full rounded-[12px] bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200 placeholder:text-zinc-400"
            />
          </div>
          <div>
            <FieldLabel>Languages spoken</FieldLabel>
            <input
              type="text"
              value={form.languages_spoken}
              onChange={(e) => set("languages_spoken", e.target.value)}
              placeholder="e.g. Hindi, Spanish, Mandarin"
              className="w-full rounded-[12px] bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200 placeholder:text-zinc-400"
            />
          </div>
          <div>
            <FieldLabel>Hobbies (pick any)</FieldLabel>
            <TagMultiSelect
              value={form.hobbies}
              onChange={(v) => set("hobbies", v)}
              options={HOBBIES_OPTIONS}
            />
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>After graduation</SectionLabel>
        <div className="space-y-4 rounded-[20px] bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
          <div>
            <FieldLabel>Target field</FieldLabel>
            <PillSelect
              value={form.target_field}
              onChange={(v) => set("target_field", v)}
              options={TARGET_FIELD_OPTIONS}
            />
          </div>
          <div>
            <FieldLabel>Dream role or company (optional)</FieldLabel>
            <input
              type="text"
              value={form.dream_role_or_company}
              onChange={(e) => set("dream_role_or_company", e.target.value)}
              placeholder="e.g. PM at Google, own art studio, ER surgeon, launching my own startup"
              className="w-full rounded-[12px] bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200 placeholder:text-zinc-400"
            />
          </div>
          <div>
            <FieldLabel>Open to a networking chat during the ride?</FieldLabel>
            <BooleanPillSelect
              value={form.open_to_networking_chat}
              onChange={(v) => set("open_to_networking_chat", v)}
            />
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>Fun fact</SectionLabel>
        <div className="rounded-[20px] bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
          <input
            type="text"
            value={form.fun_fact}
            onChange={(e) => set("fun_fact", e.target.value.slice(0, FUN_FACT_MAX_LENGTH))}
            placeholder="e.g. I've run 3 marathons, I once met a president, I can solve a Rubik's cube in under a minute"
            maxLength={FUN_FACT_MAX_LENGTH}
            className="w-full rounded-[12px] bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200 placeholder:text-zinc-400"
          />
          <p className="mt-1 ml-1 text-[10px] text-zinc-400">
            {form.fun_fact.length}/{FUN_FACT_MAX_LENGTH}
          </p>
        </div>
      </section>

      {save.isError ? (
        <p className="text-xs text-red-600">Couldn&apos;t save — try again.</p>
      ) : null}

      <div className="space-y-2 pb-2">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="w-full rounded-[16px] bg-forest py-3 text-sm font-medium text-sand ring-2 ring-forest ring-offset-2 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => router.history.back()}
          className="w-full py-2 text-center text-xs font-medium text-zinc-500 underline underline-offset-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

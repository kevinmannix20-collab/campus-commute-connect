import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { AuthShell } from "@/components/AuthShell";
import { SearchableSelect } from "@/components/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";
import {
  DEGREE_PURSUIT_OPTIONS,
  SCHOOL_OPTIONS,
  SIGNUP_MISSION_MESSAGE,
} from "@/lib/signup-constants";

export const Route = createFileRoute("/_guest/signup")({
  head: () => ({
    meta: [{ title: "Sign up — Commute Mate" }],
  }),
  component: SignupScreen,
});

// Mirrors the check enforced in the database (see the enforce_edu_email
// trigger, updated in the ucla_wide_signup_fields migration) — this copy
// is just for UX, the trigger is what actually stops non-UCLA signups.
// Matches any UCLA subdomain: ucla.edu, g.ucla.edu, anderson.ucla.edu, etc.
const UCLA_EMAIL_PATTERN = /^[^\s@]+@([a-zA-Z0-9-]+\.)*ucla\.edu$/i;

const CURRENT_YEAR = new Date().getFullYear();
const GRADUATION_YEARS = Array.from(
  { length: CURRENT_YEAR - 1950 + 1 },
  (_, i) => CURRENT_YEAR - i,
);

const signupSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Enter a valid email address")
      .regex(UCLA_EMAIL_PATTERN, "Signup is restricted to UCLA email addresses"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    school: z.string().min(1, "Select your school"),
    degreePursuit: z.string().min(1, "Select what you're pursuing"),
    graduationYear: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.degreePursuit === "Alumni" && !values.graduationYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Graduation year is required for alumni",
        path: ["graduationYear"],
      });
    }
  });

type SignupValues = z.infer<typeof signupSchema>;

function SignupScreen() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { school: "", degreePursuit: "", graduationYear: "" },
  });

  const degreePursuit = watch("degreePursuit");

  const onSubmit = async (values: SignupValues) => {
    setFormError(null);
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.fullName,
          school: values.school,
          degree_pursuit: values.degreePursuit,
          graduation_year: values.degreePursuit === "Alumni" ? values.graduationYear : "",
        },
      },
    });

    if (error) {
      setFormError(error.message);
      return;
    }

    if (data.session) {
      navigate({ to: "/" });
      return;
    }

    // Email confirmations are on for this project — there's no session yet.
    setConfirmationSent(true);
  };

  if (confirmationSent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="We sent a confirmation link to finish setting up your account."
        footer={
          <>
            Already confirmed?{" "}
            <Link to="/login" className="font-medium text-forest underline underline-offset-2">
              Sign in
            </Link>
          </>
        }
      >
        <p className="text-sm text-zinc-600">
          Click the link in that email, then come back here and sign in.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Sign up with your UCLA email to start finding commutes."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-forest underline underline-offset-2">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="fullName"
            className="mb-1 ml-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500"
          >
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder="Jamie Rivera"
            className="w-full rounded-[12px] bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200 placeholder:text-zinc-400"
            {...register("fullName")}
          />
          {errors.fullName ? (
            <p className="mt-1 ml-1 text-xs text-red-600">{errors.fullName.message}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1 ml-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500"
          >
            UCLA Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@ucla.edu"
            className="w-full rounded-[12px] bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200 placeholder:text-zinc-400"
            {...register("email")}
          />
          {errors.email ? (
            <p className="mt-1 ml-1 text-xs text-red-600">{errors.email.message}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 ml-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="w-full rounded-[12px] bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200 placeholder:text-zinc-400"
            {...register("password")}
          />
          {errors.password ? (
            <p className="mt-1 ml-1 text-xs text-red-600">{errors.password.message}</p>
          ) : null}
        </div>

        <div className="rounded-[14px] bg-forest/5 p-4 ring-1 ring-forest/10">
          <p className="text-balance font-serif text-sm font-medium text-forest">
            {SIGNUP_MISSION_MESSAGE.headline}
          </p>
          <p className="mt-1 text-pretty text-xs text-zinc-500">{SIGNUP_MISSION_MESSAGE.subline}</p>
        </div>

        <div>
          <label
            htmlFor="school"
            className="mb-1 ml-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500"
          >
            School / Department
          </label>
          <Controller
            name="school"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                id="school"
                value={field.value || null}
                onChange={field.onChange}
                options={SCHOOL_OPTIONS}
                placeholder="Select your school…"
              />
            )}
          />
          {errors.school ? (
            <p className="mt-1 ml-1 text-xs text-red-600">{errors.school.message}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="degreePursuit"
            className="mb-1 ml-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500"
          >
            Currently Pursuing
          </label>
          <Controller
            name="degreePursuit"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                id="degreePursuit"
                value={field.value || null}
                onChange={field.onChange}
                options={DEGREE_PURSUIT_OPTIONS}
                placeholder="Select one…"
              />
            )}
          />
          {errors.degreePursuit ? (
            <p className="mt-1 ml-1 text-xs text-red-600">{errors.degreePursuit.message}</p>
          ) : null}
        </div>

        {degreePursuit === "Alumni" ? (
          <div>
            <label
              htmlFor="graduationYear"
              className="mb-1 ml-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500"
            >
              Graduation Year
            </label>
            <select
              id="graduationYear"
              defaultValue=""
              className="w-full rounded-[12px] bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200"
              {...register("graduationYear")}
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
            {errors.graduationYear ? (
              <p className="mt-1 ml-1 text-xs text-red-600">{errors.graduationYear.message}</p>
            ) : null}
          </div>
        ) : null}

        {formError ? <p className="text-xs text-red-600">{formError}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-[16px] bg-forest py-3 text-sm font-medium text-sand ring-2 ring-forest ring-offset-2 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {isSubmitting ? "Creating account…" : "Sign Up"}
        </button>
      </form>
    </AuthShell>
  );
}

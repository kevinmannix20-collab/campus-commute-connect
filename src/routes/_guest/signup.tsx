import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthShell } from "@/components/AuthShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_guest/signup")({
  head: () => ({
    meta: [{ title: "Sign up — Commute Mate" }],
  }),
  component: SignupScreen,
});

// Mirrors the check enforced in the database (see the initial_schema
// migration's enforce_edu_email trigger) — this copy is just for UX,
// the trigger is what actually stops non-.edu signups.
const EDU_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.edu$/i;

const signupSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .regex(EDU_EMAIL_PATTERN, "Signup is restricted to .edu school email addresses"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupValues = z.infer<typeof signupSchema>;

function SignupScreen() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });

  const onSubmit = async (values: SignupValues) => {
    setFormError(null);
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { full_name: values.fullName } },
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
      subtitle="Sign up with your .edu email to start finding commutes."
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
            School Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@school.edu"
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

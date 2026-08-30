import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthShell } from "@/components/AuthShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_guest/login")({
  head: () => ({
    meta: [{ title: "Log in — Commute Mate" }],
  }),
  component: LoginScreen,
});

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginScreen() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    setFormError(null);
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setFormError(error.message);
      return;
    }
    navigate({ to: "/" });
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with your school email to find a commute."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="font-medium text-forest underline underline-offset-2">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="email"
            className="mb-1 ml-1 block text-[11px] font-medium tracking-wider text-zinc-500"
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
            className="mb-1 ml-1 block text-[11px] font-medium tracking-wider text-zinc-500"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
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
          {isSubmitting ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </AuthShell>
  );
}

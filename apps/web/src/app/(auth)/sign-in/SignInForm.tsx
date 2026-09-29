"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

const schema = z.object({
  email: z
    .string()
    .min(1, "Enter your email to sign in.")
    .email("Check the email address — it doesn't look complete."),
  password: z.string().min(8, "Passwords have at least 8 characters."),
});

type FormValues = z.infer<typeof schema>;

/**
 * The sign-in form, in the marketing design language.
 *
 * Two details are load-bearing rather than decorative:
 *
 * - The password field can be revealed. Someone typing a password their
 *   admin sent them on WhatsApp, on a phone, in a warehouse, will get it
 *   wrong otherwise — and a failed sign-in they cannot diagnose is where
 *   people give up. The toggle is a real 44px target and its accessible
 *   name says what pressing it will do, not what state it is in.
 *
 * - The error says what happened AND what to do next. Never "Something
 *   went wrong."
 */
export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const emailId = useId();
  const pwId = useId();
  const errorId = useId();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const supabaseReady = isSupabaseConfigured();

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setFormError("Wrong email or password. Try again, or ask your admin to reset it.");
      return;
    }
    const next = searchParams.get("next");
    router.replace(next && next.startsWith("/") ? next : "/");
    router.refresh();
  }

  const message = formError ?? errors.email?.message ?? errors.password?.message ?? null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {!supabaseReady && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-[color:var(--m-border-strong)] bg-white p-3.5 text-[13px] leading-[1.5] text-[color:var(--m-muted)]"
        >
          <strong className="font-semibold text-[color:var(--m-navy)]">
            Sign-in isn&apos;t connected yet.
          </strong>{" "}
          Supabase credentials are missing from this environment. See SETUP.md — or use the dev
          preview session described in SECURITY-NOTES.md.
        </div>
      )}

      <label htmlFor={emailId} className="mb-2 block text-[13px] font-semibold">
        Work email
      </label>
      <input
        id={emailId}
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@company.in"
        className="m-field mb-[18px]"
        aria-invalid={errors.email ? true : undefined}
        aria-describedby={message ? errorId : undefined}
        {...register("email")}
      />

      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor={pwId} className="text-[13px] font-semibold">
          Password
        </label>
        <Link
          href="/forgot-password"
          className="text-[12.5px] font-semibold text-[color:var(--m-red)] hover:text-[color:var(--m-navy)]"
        >
          Forgot?
        </Link>
      </div>
      <div className="relative mb-[18px]">
        <input
          id={pwId}
          type={shown ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••"
          className="m-field pr-[60px]"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={message ? errorId : undefined}
          {...register("password")}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 min-h-11 -translate-y-1/2 rounded-lg p-2.5 text-xs font-bold text-[color:var(--m-muted-2)] hover:text-[color:var(--m-navy)]"
        >
          {shown ? "HIDE" : "SHOW"}
        </button>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !supabaseReady}
        className="m-btn-primary w-full p-[15px] text-base font-bold disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {isSubmitting && (
          <span
            aria-hidden="true"
            className="inline-block size-4 rounded-full border-[2.5px] border-white/40 border-t-white"
            style={{ animation: "m-spin .7s linear infinite" }}
          />
        )}
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>

      {message && (
        <div
          id={errorId}
          role="alert"
          className="mt-2.5 text-[12.5px] font-semibold text-[color:var(--m-red-deep)]"
          style={{ animation: "m-seq-in .25s ease both" }}
        >
          {message}
        </div>
      )}
    </form>
  );
}

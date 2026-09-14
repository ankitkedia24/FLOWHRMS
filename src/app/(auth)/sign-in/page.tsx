import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAppSession } from "@/lib/auth/session";
import { marketingFontVariables } from "../../marketing-fonts";
import { SignInForm } from "./SignInForm";
import "@/styles/marketing.css";
import { FlowHRMSLockup } from "@/components/brand/FlowHRMSWordmark";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Sign-in (screen E1), rebuilt to the marketing design language so the
 * front door matches the page people arrive from.
 *
 * Split layout: a navy panel that shows what is waiting on the other side,
 * and the form itself. The panel is desktop-only and hidden with a media
 * query rather than a width check — the form is the page's job, and on a
 * phone it should be the whole page rather than something below a hero.
 *
 * Email + password only. The originally approved design specified phone
 * sign-in; that waits on the SMS/OTP provider decision (D-P1-05).
 *
 * The "already signed in, go to your surface" redirect lives here rather
 * than in the proxy because it is only correct if the person actually has
 * a FlowHRMS account, and only the database knows that.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getAppSession();
  if (session) redirect("/");

  const { error } = await searchParams;
  const noAccess = error === "no-access";

  return (
    <div
      data-surface="marketing"
      className={`${marketingFontVariables} grid min-h-dvh grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))]`}
    >
      {/* ------------------------------------------- what's on the other side */}
      <aside className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-[color:var(--m-navy)] px-12 py-10 md:flex">
        <Link href="/" className="w-max" aria-label="FlowHRMS home">
          <FlowHRMSLockup height={30} tone="dark" />
        </Link>

        <div className="max-w-[460px]">
          <h2 className="m-h2 mb-4 text-[clamp(30px,2.8vw,42px)] text-[color:var(--m-cream)]">
            Your team&apos;s day, already added up.
          </h2>
          <p className="mb-8 text-[15.5px] leading-[1.6] text-[color:var(--m-on-navy-2)]">
            Attendance, tasks, leave and payroll inputs—waiting on the other side of this door.
          </p>

          <div className="max-w-[380px] rounded-[14px] border border-[rgba(245,245,245,.12)] bg-[rgba(245,245,245,.05)] px-5 py-[18px]">
            <div className="mb-3.5 flex items-center justify-between">
              <span className="font-[family-name:var(--m-font-head)] text-[13.5px] font-bold text-[color:var(--m-cream)]">
                Today · while you were away
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--m-green-on-dark)]">
                <span className="m-live-dot" />
                LIVE
              </span>
            </div>
            <div className="flex flex-col gap-[9px]">
              {[
                { dot: "var(--m-green)", label: "142 checked in", time: "09:30" },
                { dot: "var(--m-amber)", label: "12 tasks completed", time: "11:04" },
                { dot: "var(--m-red)", label: "2 leave requests waiting", time: "now" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center gap-[9px] text-[13px] text-[color:var(--m-cream)]"
                >
                  <span className="size-[7px] flex-none rounded-full" style={{ background: row.dot }} />
                  <span className="font-semibold">{row.label}</span>
                  <span className="m-num ml-auto text-[color:var(--m-on-navy)]">{row.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-[12.5px] text-[color:var(--m-on-navy)]">
          <span className="block font-[family-name:var(--m-font-head)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--m-on-navy-2)]">
            Align. Accelerate. Grow.
          </span>
          <span className="mt-1.5 block">Made for Indian SMEs · Phone-first · help@flowacord.com</span>
        </div>
      </aside>

      {/* --------------------------------------------------------- the form */}
      <main className="flex flex-col items-center justify-center px-7 py-10">
        <Link href="/" className="mb-9 md:hidden" aria-label="FlowHRMS home">
          <FlowHRMSLockup height={28} />
        </Link>

        <div className="w-[min(400px,100%)]">
          <h1 className="m-h2 mb-2 text-[30px]">Sign in</h1>
          <p className="mb-[30px] text-[14.5px] text-[color:var(--m-muted)]">
            Use the email your company registered.
          </p>

          {noAccess && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-[rgba(245,185,64,.5)] bg-[rgba(245,185,64,.12)] p-4 text-[13.5px] leading-[1.55] text-[color:var(--m-navy)]"
            >
              <p className="mb-1.5 font-bold">That account can&apos;t open FlowHRMS right now.</p>
              <p>
                Your password was accepted, so the account exists — but it has no active company
                here. Usually that means it was deactivated, or the company was closed. Your admin
                or owner can tell you which, and put it back.
              </p>
              {/* The escape hatch. Without this, someone holding a stale
                  session cannot even reach the form as a different person:
                  sign-out otherwise lives inside the app they can't open. */}
              <form action="/auth/sign-out" method="post" className="mt-3">
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center font-semibold text-[color:var(--m-red-deep)] underline underline-offset-2"
                >
                  Sign out and use a different account
                </button>
              </form>
            </div>
          )}

          {/* Suspense: useSearchParams (the ?next redirect) opts the form
              out of static prerendering. */}
          <Suspense
            fallback={
              <div aria-busy="true" className="flex flex-col gap-4">
                <div className="h-[76px] animate-pulse rounded-xl bg-[color:var(--m-cream-inset)]" />
                <div className="h-[76px] animate-pulse rounded-xl bg-[color:var(--m-cream-inset)]" />
                <div className="h-[50px] animate-pulse rounded-[13px] bg-[color:var(--m-cream-inset)]" />
              </div>
            }
          >
            <SignInForm />
          </Suspense>

          <p className="mt-3.5 text-[12.5px] leading-[1.55] text-[color:var(--m-muted-2)]">
            Only your company can create your FlowHRMS account. If you can&apos;t sign in, ask your admin
            or owner.
          </p>
        </div>
      </main>
    </div>
  );
}

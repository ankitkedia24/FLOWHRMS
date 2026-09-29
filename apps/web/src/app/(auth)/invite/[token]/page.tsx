import type { Metadata } from "next";
import Link from "next/link";
import { previewInviteAction } from "@/lib/invites/accept";
import { Alert } from "@/components/ui/Alert";
import { AcceptInviteForm } from "./AcceptInviteForm";
import { FlowHRMSLockup } from "@/components/brand/FlowHRMSWordmark";

export const metadata: Metadata = {
  title: "Set up your account",
  // An invitation link must never be indexed, and must not leak in a
  // referrer header if the page ever links out.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Invitation landing page (public — the token is the only credential).
 *
 * The token is validated on the server before anything is rendered, so a
 * dead link shows a dead-link page rather than a password form that fails
 * after someone has typed into it.
 */
export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await previewInviteAction(decodeURIComponent(token));

  return (
    <main
      data-surface="employee"
      className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-10 pt-14"
    >
      <FlowHRMSLockup height={28} />

      {preview.ok ? (
        <>
          <h1 className="mt-7 font-heading text-h1 text-text-primary">
            Welcome, {preview.employeeName?.split(/\s+/)[0]}
          </h1>
          <p className="mt-2 text-body text-text-secondary">
            {preview.companyName} has set up your account. Choose a password
            and you&apos;re in.
          </p>
          {preview.email && (
            <p className="mt-1 text-secondary text-text-tertiary">
              You&apos;ll sign in with {preview.email}
            </p>
          )}
          <div className="mt-7">
            <AcceptInviteForm
              token={decodeURIComponent(token)}
              employeeName={preview.employeeName ?? "you"}
              consentKeys={preview.consentKeys ?? []}
            />
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-7 font-heading text-h1 text-text-primary">
            This link doesn&apos;t work
          </h1>
          <div className="mt-4">
            <Alert variant="warning" title="Nothing has been lost">
              {preview.reason}
            </Alert>
          </div>
          <p className="mt-5 text-body text-text-secondary">
            If you already set a password, sign in instead.
          </p>
          <Link
            href="/sign-in"
            className="mt-3 text-label text-brand-primary underline-offset-2 hover:underline"
          >
            Go to sign in
          </Link>
        </>
      )}
    </main>
  );
}

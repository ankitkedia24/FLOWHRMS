import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/authz/guard";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader } from "@/components/ui/Card";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata: Metadata = { title: "Account" };

/**
 * The person's own sign-in: what they sign in with, and how to change it.
 *
 * Deliberately separate from Profile, which is their record inside the
 * company. This screen is the same for an employee, an owner and the
 * platform operator, because a password is personal rather than a role.
 */
export default async function AccountPage() {
  const session = await requireSession();
  const preview = session.source !== "supabase";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mt-2 font-heading text-h1 text-text-primary">Account</h1>

      <Card>
        <CardHeader title="Sign-in" />
        <dl className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-secondary text-text-secondary">Email</dt>
            <dd className="text-body text-text-primary">
              {session.user.email ?? "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-secondary text-text-secondary">Signed in as</dt>
            <dd className="text-body text-text-primary">
              {session.user.displayName}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-caption text-text-secondary">
          Your email is set by your company&apos;s admin. To change it, ask
          them — it is how your account is matched to you.
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Change password"
          meta="Prove the current one, choose a new one. You stay signed in here."
        />
        {preview ? (
          <Alert variant="info" title="Not available in the preview session.">
            Sign in with a real account to change its password.
          </Alert>
        ) : (
          <ChangePasswordForm />
        )}
      </Card>

      <p className="text-caption text-text-secondary">
        Forgotten it? Sign out and use{" "}
        <Link
          href="/forgot-password"
          className="text-brand-primary underline-offset-2 hover:underline"
        >
          Forgot password
        </Link>{" "}
        on the sign-in page — a link comes to your email.
      </p>
    </div>
  );
}

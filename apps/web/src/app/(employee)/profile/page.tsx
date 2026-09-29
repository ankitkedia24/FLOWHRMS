import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/authz/guard";
import { SignOutButton } from "@/components/offline/SignOutButton";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { STATUS } from "@/lib/status";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { mediaUrl } from "@/lib/media/urls";

export const metadata: Metadata = { title: "Profile" };

/** Employee profile shell (screen E16). */
export default async function EmployeeProfilePage() {
  const session = await requireSession();
  const me = devFixtureOffline()
    ? null
    : await getDb().tenantMembership.findUnique({
        where: { id: session.membership.id },
        select: { photoPath: true, designation: true },
      });
  const photoUrl = await mediaUrl(me?.photoPath);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="mt-2 font-heading text-h1 text-text-primary">Profile</h1>

      <Card>
        <div className="flex items-center gap-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
            <img src={photoUrl} alt="" className="size-14 shrink-0 rounded-avatar object-cover" />
          ) : (
          <span
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-avatar bg-brand-primary-subtle font-heading text-h3 text-brand-primary"
          >
            {session.user.displayName
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0] ?? "")
              .join("")
              .toUpperCase()}
          </span>
          )}
          <div className="min-w-0">
            <p className="text-body-lg font-semibold text-text-primary">
              {session.user.displayName}
            </p>
            <p className="text-secondary text-text-secondary">
              {me?.designation ?? session.membership.roleName} · {session.tenant.name}
            </p>
            {session.membership.employeeCode && (
              <p className="font-mono text-mono text-text-tertiary uppercase">
                {session.membership.employeeCode}
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Account" />
        <dl className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-secondary text-text-secondary">Email</dt>
            <dd className="text-body text-text-primary">
              {session.user.email ?? "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-secondary text-text-secondary">Status</dt>
            <dd>
              <StatusChip status={STATUS.active} size="sm" />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-secondary text-text-secondary">Password</dt>
            <dd>
              <Link
                href="/account"
                className="text-body text-brand-primary underline-offset-2 hover:underline"
              >
                Change password
              </Link>
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Your records" />
        <ul className="flex flex-col gap-2">
          <li>
            <a
              href="/print/id-cards?member=me"
              target="_blank"
              className="text-body text-brand-primary underline-offset-2 hover:underline"
            >
              My ID card
            </a>
          </li>
          <li>
            <Link
              href="/leave"
              className="text-body text-brand-primary underline-offset-2 hover:underline"
            >
              Leave requests
            </Link>
          </li>
          <li>
            <Link
              href="/attendance"
              className="text-body text-brand-primary underline-offset-2 hover:underline"
            >
              Attendance history
            </Link>
          </li>
          <li>
            <Link
              href="/payslips"
              className="text-body text-brand-primary underline-offset-2 hover:underline"
            >
              Payslips
            </Link>
          </li>
          <li>
            <Link
              href="/documents"
              className="text-body text-brand-primary underline-offset-2 hover:underline"
            >
              My documents
            </Link>
          </li>
          <li>
            <Link
              href="/notifications"
              className="text-body text-brand-primary underline-offset-2 hover:underline"
            >
              Notifications
            </Link>
          </li>
        </ul>
      </Card>

      <p className="text-caption text-text-secondary">
        Your company records your check-in time and permitted location. You
        can see everything recorded about you in Attendance history.
      </p>

      <SignOutButton />
    </div>
  );
}

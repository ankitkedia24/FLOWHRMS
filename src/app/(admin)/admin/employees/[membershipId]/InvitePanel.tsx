"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Mail, UserMinus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import type { Status } from "@/lib/status";
import { INVITE_HELD_REASON } from "@/lib/invites/policy";
import {
  deactivateEmployeeAction,
  resendInviteAction,
  revokeInviteAction,
} from "@/lib/invites/actions";

/**
 * Invitation state and the three things an admin does about it.
 *
 * Deactivation is separated from the invitation controls and confirmed,
 * because it is the one action here that changes what a person can do
 * tomorrow. It asks for a reason, and the reason is kept — an employee who
 * asks why their login stopped working deserves an answer that exists
 * (Constitution §3, §4).
 */
export function InvitePanel({
  membershipId,
  employeeName,
  email,
  inviteStatus,
  sentAt,
  expiresAt,
  resendCount,
  isDeactivated,
  canManage,
  held = false,
  deactivateLock = null,
}: {
  membershipId: string;
  employeeName: string;
  email: string | null;
  inviteStatus: Status;
  sentAt: string | null;
  expiresAt: string | null;
  resendCount: number;
  isDeactivated: boolean;
  canManage: boolean;
  /** Waiting for the owner to confirm their email; it sends itself then. */
  held?: boolean;
  /** Why this viewer can't deactivate them (themselves, above them, last owner). */
  deactivateLock?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const [reason, setReason] = useState("");

  const accepted = inviteStatus.key === "invite-accepted";
  // A held invitation has nothing to press: it sends itself on confirmation.
  const showInviteControls = canManage && !accepted && !isDeactivated && !held;

  function run(fn: () => Promise<{ ok: boolean; [k: string]: unknown }>) {
    setError(null);
    startTransition(async () => {
      const result = (await fn()) as {
        ok: boolean;
        message?: string;
        detail?: string;
        error?: string;
        inviteLink?: string;
      };
      if (result.inviteLink) {
        setLink(result.inviteLink);
        setCopied(false);
      }
      if (!result.ok) {
        setError(result.error ?? "That didn't work.");
        return;
      }
      toast.show({
        variant: "success",
        message: [result.message ?? "Done", result.detail]
          .filter(Boolean)
          .join(" "),
      });
      router.refresh();
    });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-h3 text-text-primary">Sign-in</h2>
          <p className="mt-1 text-secondary text-text-secondary">
            {email ?? "No email address — they can't sign in yet."}
          </p>
        </div>
        <StatusChip status={inviteStatus} size="sm" />
      </div>

      {/* One column on a phone: "Link works until" plus a date does not fit
          in half of 360px without wrapping mid-label. */}
      <dl className="mt-4 grid grid-cols-1 gap-3 text-secondary sm:grid-cols-2">
        <div>
          <dt className="text-text-tertiary">Invitation sent</dt>
          <dd className="text-text-primary">{sentAt ?? "Not sent"}</dd>
        </div>
        <div>
          <dt className="text-text-tertiary">
            {accepted ? "Joined" : "Link works until"}
          </dt>
          <dd className="text-text-primary">{expiresAt ?? "—"}</dd>
        </div>
      </dl>

      {held && (
        <div className="mt-4">
          <Alert variant="info" title="Waiting for you to confirm your email">
            {INVITE_HELD_REASON}
          </Alert>
        </div>
      )}

      {resendCount > 0 && !accepted && (
        <p className="mt-3 text-caption text-text-tertiary">
          Sent again {resendCount} {resendCount === 1 ? "time" : "times"}.
        </p>
      )}

      {error && (
        <div className="mt-4">
          <Alert variant="error" title="That didn't work">
            {error}
          </Alert>
        </div>
      )}

      {link && (
        <div className="mt-4">
          <p className="text-secondary text-text-secondary">
            Send this link to {employeeName.split(/\s+/)[0]}. It works once, for
            7 days.
          </p>
          <p className="mt-2 break-all rounded-surface-card border border-border-default bg-surface-sunken px-4 py-3 font-mono text-mono text-text-secondary">
            {link}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            leadingIcon={
              copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />
            }
            onClick={() => {
              void navigator.clipboard.writeText(link).then(() => setCopied(true));
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      )}

      {(showInviteControls || (canManage && !isDeactivated)) && (
        <div className="mt-5 flex flex-wrap gap-3">
          {showInviteControls && (
            <>
              <Button
                variant="outline"
                loading={pending}
                disabled={!email}
                disabledReason={
                  !email ? "Add an email address first." : undefined
                }
                leadingIcon={<Mail aria-hidden="true" />}
                onClick={() => run(() => resendInviteAction({ membershipId }))}
              >
                {inviteStatus.key === "invite-not-sent"
                  ? "Send invitation"
                  : "Send again"}
              </Button>
              {inviteStatus.key === "invite-pending" && (
                <Button
                  variant="tertiary"
                  loading={pending}
                  leadingIcon={<X aria-hidden="true" />}
                  onClick={() => run(() => revokeInviteAction({ membershipId }))}
                >
                  Withdraw
                </Button>
              )}
            </>
          )}
          {canManage && !isDeactivated && (
            <Button
              variant="dangerSubtle"
              leadingIcon={<UserMinus aria-hidden="true" />}
              disabled={Boolean(deactivateLock)}
              disabledReason={deactivateLock ?? undefined}
              onClick={() => setConfirmOff(true)}
            >
              Deactivate
            </Button>
          )}
        </div>
      )}

      <Modal
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        title={`Deactivate ${employeeName}?`}
      >
        <p className="text-body text-text-secondary">
          They won&apos;t be able to sign in, and any invitation stops working.
          Their attendance, leave and payslips are kept exactly as recorded —
          nothing is deleted.
        </p>
        <div className="mt-4">
          <TextArea
            label="Why"
            required
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            helper="Kept on the record. An employee who asks why will be told this."
          />
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => setConfirmOff(false)}>
            Keep them active
          </Button>
          <Button
            variant="danger"
            loading={pending}
            disabled={reason.trim().length === 0}
            disabledReason={
              reason.trim().length === 0 ? "Say why first." : undefined
            }
            onClick={() => {
              setConfirmOff(false);
              run(() => deactivateEmployeeAction({ membershipId, reason }));
            }}
          >
            Deactivate
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

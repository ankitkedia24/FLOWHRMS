import "server-only";

import { getDb } from "@/lib/db";
import { deliverInvite } from "./deliver";

/**
 * Invitations held until a self-serve owner confirms their email.
 *
 * Held means: the person was added with an email address while the
 * company's invitations were held, so no invitation was ever issued —
 * still INVITED, and no invitation row at all. (Every other path writes a
 * row before it emails, so a failed email is never mistaken for held.)
 *
 * sendHeldInvitations runs once, from whichever confirmation actually
 * switched the owner's email to confirmed — the owner's link, or Flowacord
 * confirming it from the platform — so two clicks at the same moment send
 * one invitation, not two.
 */

const heldWhere = (tenantId: string) => ({
  tenantId,
  status: "INVITED" as const,
  user: { email: { not: null } },
  invites: { none: {} },
});

/** How many invitations are waiting (for the owner's banner). */
export async function countHeldInvitations(tenantId: string): Promise<number> {
  return getDb().tenantMembership.count({ where: heldWhere(tenantId) });
}

export interface HeldResult {
  /** Names of the people whose invitation was emailed. */
  sent: string[];
  /** Names whose email did not go through; they are sent from their profile. */
  failed: string[];
  /**
   * It stopped part-way (the database failed). Whoever is not named above
   * shows "Not invited" and needs "Send invitation" — the owner is told.
   */
  unfinished: boolean;
}

export const NOTHING_HELD: HeldResult = { sent: [], failed: [], unfinished: false };

/** A company adds a handful before confirming; this is a guard, not a quota. */
const MOST = 200;
/** Emails at once — enough to be quick, few enough not to trip the mail server. */
const AT_ONCE = 4;

/**
 * Never throws: it runs after the email is already confirmed, so a failure
 * here must be reported, not turned into an error page that hides which
 * invitations went out.
 */
export async function sendHeldInvitations(tenantId: string): Promise<HeldResult> {
  const result: HeldResult = { sent: [], failed: [], unfinished: false };
  try {
    await sendAll(tenantId, result);
  } catch (error) {
    console.error("held invitations stopped part-way:", error instanceof Error ? error.message : error);
    result.unfinished = true;
  }
  return result;
}

async function sendAll(tenantId: string, result: HeldResult): Promise<void> {
  const db = getDb();
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, timezone: true, ownerEmailVerifiedAt: true },
  });
  if (!tenant?.ownerEmailVerifiedAt) return;

  const [owner, held] = await Promise.all([
    db.tenantMembership.findFirst({
      where: { tenantId, status: "ACTIVE", role: { key: "OWNER" } },
      orderBy: { createdAt: "asc" },
      select: { user: { select: { id: true, displayName: true } } },
    }),
    db.tenantMembership.findMany({
      where: heldWhere(tenantId),
      orderBy: { createdAt: "asc" },
      take: MOST,
      select: { id: true, user: { select: { displayName: true, email: true } } },
    }),
  ]);
  if (held.length === 0) return;

  // The owner added them; the email names the owner, as it would have.
  const from = {
    tenantId,
    companyName: tenant.name,
    timeZone: tenant.timezone,
    invitedByUserId: owner?.user.id ?? null,
    invitedByName: owner?.user.displayName ?? tenant.name,
  };

  for (let i = 0; i < held.length; i += AT_ONCE) {
    const outcomes = await Promise.all(
      held.slice(i, i + AT_ONCE).map(async (member) => {
        const email = member.user.email as string;
        // One person's failure (a refused address, a mail server that
        // throws) must not stop the others.
        let sent = false;
        try {
          sent = (
            await deliverInvite(from, {
              membershipId: member.id,
              employeeName: member.user.displayName,
              email,
              isResend: false,
            })
          ).sent;
        } catch (error) {
          console.error("held invitation not sent:", error instanceof Error ? error.message : error);
        }
        await db.auditEvent
          .create({
            data: {
              tenantId,
              actorType: "SYSTEM",
              action: "employee.invite_sent",
              entityType: "membership",
              entityId: member.id,
              reason: "Held until the owner confirmed their email",
              metadata: { to: email, delivered: sent },
            },
          })
          .catch((error: unknown) =>
            console.error("held invitation audit not written:", error instanceof Error ? error.message : error),
          );
        return { name: member.user.displayName, sent };
      }),
    );
    // In the order they were added, whichever email finished first.
    for (const o of outcomes) (o.sent ? result.sent : result.failed).push(o.name);
  }
}

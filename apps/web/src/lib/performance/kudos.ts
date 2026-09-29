/**
 * Kudos — pure rules (PERFORMANCE-MODULE.md §F, approved with the
 * complete-the-module directive).
 *
 * Kudos are WORDS, never points. Principle 1 — no points from opinions —
 * is not bent for managers: a thank-you that moved the leaderboard would
 * be a manual score with better manners. What a kudo does is get seen:
 * on the recipient's My Performance, and in their bell.
 *
 * The anti-favouritism design is two caps, both here as pure rules:
 * - A sender has THREE a week. Scarcity is what makes one mean something,
 *   and a manager who sprays fifty thank-yous a week is running a
 *   popularity machine, not recognising work.
 * - At most ONE per recipient per sender per week, so the three cannot
 *   all pile onto a favourite.
 */

export const KUDOS_PER_SENDER_PER_WEEK = 3;
export const KUDOS_PER_PAIR_PER_WEEK = 1;
export const KUDOS_MAX_LENGTH = 240;

export interface KudosCheck {
  ok: boolean;
  reason?: string;
}

export function canSendKudos(input: {
  sentThisWeek: number;
  sentToThisPersonThisWeek: number;
  toSelf: boolean;
  messageLength: number;
}): KudosCheck {
  if (input.toSelf) {
    return { ok: false, reason: "Not to yourself — that's what the badges are for." };
  }
  if (input.messageLength < 3) {
    return { ok: false, reason: "Say what it's for — that's the whole point." };
  }
  if (input.messageLength > KUDOS_MAX_LENGTH) {
    return { ok: false, reason: `Keep it under ${KUDOS_MAX_LENGTH} characters.` };
  }
  if (input.sentToThisPersonThisWeek >= KUDOS_PER_PAIR_PER_WEEK) {
    return {
      ok: false,
      reason: "You've already thanked them this week. Spread it around.",
    };
  }
  if (input.sentThisWeek >= KUDOS_PER_SENDER_PER_WEEK) {
    return {
      ok: false,
      reason: `That's your ${KUDOS_PER_SENDER_PER_WEEK} for the week. Scarcity is what makes them count.`,
    };
  }
  return { ok: true };
}

import type { Status } from "@/lib/status";

/**
 * Rules for the enquiry form on the marketing site — pure, so they can be
 * asserted rather than eyeballed.
 *
 * This is the one place in FlowHRMS that takes input from someone with no
 * account, no tenant and no session. That shapes every decision here:
 * refuse rubbish early, keep only what was asked for, and bound how much a
 * stranger can write to the database.
 */

/** The trap field. A person leaves it empty; most bots fill everything. */
export const HONEYPOT_FIELD = "website";

/**
 * How many enquiries the whole site accepts per hour.
 *
 * Not per-IP: that needs storing an IP, which is personal data we have no
 * reason to keep, and it is trivially defeated anyway. A global ceiling
 * cannot stop a determined flood, but it bounds what an unauthenticated
 * write endpoint can do to the database — which is the actual risk. A real
 * SME sending its tenth enquiry in an hour is not a scenario worth
 * optimising for; the page tells them to phone instead.
 */
export const MAX_REQUESTS_PER_HOUR = 20;

export const TEAM_SIZES = [
  "1–10",
  "11–25",
  "26–50",
  "51–100",
  "More than 100",
] as const;

export interface DemoRequestInput {
  name: string;
  company: string;
  phone: string;
  teamSize?: string;
  notes?: string;
  /** Honeypot. Anything here means "not a person". */
  website?: string;
}

export type DemoRequestProblem =
  | { field: "name" | "company" | "phone" | "notes"; message: string }
  | { field: "form"; message: string };

/**
 * An Indian mobile number, forgivingly.
 *
 * Accepts +91, 0 prefixes, spaces and dashes, because people type their own
 * number the way they say it. Rejecting a real customer's number over
 * punctuation loses a sale; this only needs to catch nonsense.
 */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  const local = digits.startsWith("91") && digits.length === 12
    ? digits.slice(2)
    : digits.startsWith("0") && digits.length === 11
      ? digits.slice(1)
      : digits;
  if (!/^[6-9]\d{9}$/.test(local)) return null;
  return local;
}

export function validateDemoRequest(
  input: DemoRequestInput,
): DemoRequestProblem[] {
  const problems: DemoRequestProblem[] = [];

  // Silent to the sender: telling a bot which check caught it is free help.
  if (input.website?.trim()) {
    problems.push({ field: "form", message: "That didn't send. Try again." });
    return problems;
  }

  if (!input.name?.trim()) {
    problems.push({ field: "name", message: "Tell us your name." });
  } else if (input.name.trim().length > 120) {
    problems.push({ field: "name", message: "That name is too long." });
  }

  if (!input.company?.trim()) {
    problems.push({ field: "company", message: "Tell us your company's name." });
  } else if (input.company.trim().length > 160) {
    problems.push({ field: "company", message: "That company name is too long." });
  }

  if (!input.phone?.trim()) {
    problems.push({ field: "phone", message: "We need a number to call you on." });
  } else if (!normalisePhone(input.phone)) {
    problems.push({
      field: "phone",
      message: "Check the mobile number — it should be 10 digits starting 6, 7, 8 or 9.",
    });
  }

  if (input.notes && input.notes.length > 2000) {
    problems.push({ field: "notes", message: "Please keep this under 2000 characters." });
  }

  return problems;
}

export type DemoRequestStatusKey = "NEW" | "CONTACTED" | "CONVERTED" | "CLOSED";

/** Status as text plus tone, never colour alone (Constitution §6). */
export function demoRequestStatus(key: DemoRequestStatusKey): Status {
  switch (key) {
    case "NEW":
      return { key: "demo-new", label: "New", tone: "warning" };
    case "CONTACTED":
      return { key: "demo-contacted", label: "Contacted", tone: "info" };
    case "CONVERTED":
      return { key: "demo-converted", label: "Became a customer", tone: "success" };
    case "CLOSED":
      return { key: "demo-closed", label: "Closed", tone: "neutral" };
  }
}

import { z } from "zod";
import { normaliseEmail } from "@/lib/invites/policy";
import { normalisePhone } from "@/lib/platform/demo-requests";
import {
  HEARD_FROM,
  INDUSTRIES,
  SIGNUP_ROLES,
  STATES_AND_UTS,
  isPincode,
} from "./catalog";

/**
 * The trial sign-up rules. Pure: the form checks each step before moving
 * on, and the server checks everything again — the client's checks are a
 * courtesy, never the enforcement.
 */

const text = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? `Enter ${label}.` : `Enter ${label} (at least ${min} characters).`)
    .max(max, `Keep ${label} under ${max} characters.`);

export const companyStep = z.object({
  companyName: text("your company's name", 2, 120),
  // An empty box would coerce to 0 and read "At least 1" — say what is
  // actually missing instead.
  staffCount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce
      .number({ error: "Enter how many people work there." })
      .int("Use a whole number.")
      .min(1, "Enter how many people work there (at least 1).")
      .max(100_000, "That number looks too large."),
  ),
  industry: z.enum(INDUSTRIES, { error: "Choose your industry or trade." }),
});

export const addressStep = z.object({
  pincode: z.string().trim().refine(isPincode, "Enter a 6-digit pincode."),
  state: z.enum(STATES_AND_UTS, { error: "Choose the state." }),
  city: text("the city or town", 2, 80),
});

export const detailsStep = z.object({
  name: text("your name", 2, 120),
  email: z
    .string()
    .trim()
    .max(200)
    .email("Enter a valid email address.")
    .transform((v) => normaliseEmail(v)),
  mobile: z
    .string()
    .trim()
    .refine((v) => normalisePhone(v) !== null, "Enter a 10-digit mobile number starting 6, 7, 8 or 9.")
    .transform((v) => normalisePhone(v)!),
  role: z.enum(SIGNUP_ROLES, { error: "Choose your role in the company." }),
  heardFrom: z.enum(HEARD_FROM).optional().or(z.literal("").transform(() => undefined)),
});

export const signupSchema = companyStep.extend(addressStep.shape).extend(detailsStep.shape).extend({
  /** Purpose keys ticked for each notice — only these count as granted. */
  consents: z.object({
    account_holder: z.array(z.string()).max(10),
    customer_terms: z.array(z.string()).max(10),
  }),
  /** Honeypot: a person leaves it empty. */
  website: z.string().optional(),
});

export type SignupInput = z.input<typeof signupSchema>;
export type SignupData = z.output<typeof signupSchema>;

export type StepErrors = Partial<Record<string, string>>;

/** First error per field, for showing next to each input. */
export function stepErrors(schema: z.ZodTypeAny, values: unknown): StepErrors {
  const result = schema.safeParse(values);
  if (result.success) return {};
  const errors: StepErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return errors;
}

/** Said on step 3 as soon as the field is filled, and again at the end if need be. */
export const EMAIL_TAKEN =
  "This email is already registered on FlowHRMS. Sign in instead, or use a different email.";
export const MOBILE_TAKEN =
  "This mobile number is already registered on FlowHRMS. Sign in instead, or use a different number.";

/** How many sign-ups the whole site accepts per hour, and per IP address. */
export const MAX_SIGNUPS_PER_HOUR = 30;
export const MAX_SIGNUPS_PER_IP_PER_HOUR = 5;

export function trialEndsAt(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Whole days left in a trial; 0 on the last day, negative once ended. */
export function trialDaysLeft(endsAt: Date, now: Date): number {
  return Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export function trialExpired(
  tenant: { plan: string; trialEndsAt: Date | null },
  now: Date,
): boolean {
  return tenant.plan === "TRIAL" && tenant.trialEndsAt !== null && tenant.trialEndsAt <= now;
}

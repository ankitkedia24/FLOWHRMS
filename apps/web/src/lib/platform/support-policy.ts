/**
 * Which companies Flowacord support may open (DECISIONS.md D-PL-03,
 * docs/md/SUPPORT-ACCESS.md). Pure; tested in src/tests/support-login.test.ts.
 *
 * The owner's decision (30 Sept 2026): support may work inside real
 * companies only once their Terms say so. Until the lawyer-reviewed wording
 * is published, only the placeholder and sample companies — which hold no
 * real person's data — can be opened. After it is published, a company
 * opens once its owner has accepted that version, which they are asked to
 * do at their next sign-in.
 */

/** The notice a company's owner accepts on registering it. */
export const SUPPORT_TERMS_KEY = "customer_terms";

/**
 * The first version of that notice that allows support access: v3, prepared
 * 1 Oct 2026 for legal review (consent/documents.ts SUPPORT_SENTENCES). This
 * branch must not reach main until the wording is approved and published —
 * see docs/md/SUPPORT-ACCESS.md → Publishing.
 */
export const SUPPORT_TERMS_VERSION: number | null = 3;

/** Companies with no real person's data: the placeholder and the sample. */
export const SUPPORT_OPEN_SLUGS: readonly string[] = ["demo-co", "sunrise-traders-sample"];

/**
 * The version an owner's latest record for the Terms stands for, or null.
 * Changing an optional choice later is recorded as UPDATED — still
 * acceptance. Only a withdrawal takes it away.
 */
export function acceptedTermsVersion(
  latest: { action: "GRANTED" | "UPDATED" | "WITHDRAWN"; noticeVersion: number } | null,
): number | null {
  return latest && latest.action !== "WITHDRAWN" ? latest.noticeVersion : null;
}

/** Why support can't open this company right now, or null if it can. */
export function supportRefusal(
  tenant: { slug: string; status: string },
  /** The newest SUPPORT_TERMS_KEY version the owner has accepted, if any. */
  ownerTermsVersion: number | null,
  termsVersion: number | null = SUPPORT_TERMS_VERSION,
): string | null {
  if (tenant.status !== "ACTIVE") return "This company is suspended. Restore it before opening it as support.";
  if (SUPPORT_OPEN_SLUGS.includes(tenant.slug)) return null;
  if (termsVersion === null) {
    return "Not yet: the Terms don't cover support access. Until the reviewed wording is published, support opens only the placeholder and sample companies.";
  }
  if ((ownerTermsVersion ?? 0) < termsVersion) {
    return "Not yet: the owner hasn't accepted the updated Terms. They'll be asked at their next sign-in.";
  }
  return null;
}

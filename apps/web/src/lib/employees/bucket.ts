/**
 * Private bucket for employee documents (ID and address proofs — the most
 * sensitive files FlowHRMS holds). Provisioned by scripts/setup-storage.ts;
 * reads are signed-URL only, after a permission check, and audited.
 */
export const DOCUMENT_BUCKET = "employee-documents";

/** Constraints stated to the user before they choose a file. */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_ACCEPT = "image/*,application/pdf";

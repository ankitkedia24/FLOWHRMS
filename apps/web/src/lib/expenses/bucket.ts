/**
 * Private bucket for expense receipts (EXPENSES-MODULE.md §10).
 * Provisioned by scripts/setup-storage.ts alongside task proof and employee
 * documents; reads are signed-URL only, after a permission check, and
 * every view is audited.
 */
export const RECEIPT_BUCKET = "expense-receipts";

/** Constraints stated to the user before they choose a file. */
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const RECEIPT_MAX_FILES = 5;
export const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf";
export const RECEIPT_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;

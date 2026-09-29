/**
 * Storage bucket for task proof. Private — provisioned by
 * scripts/setup-storage.ts; reads are signed-URL only.
 * Shared by the browser uploader and the server-side signer.
 */
export const PROOF_BUCKET = "task-proof";

/** Client-side downscale target for photos (mobile-first guidelines §5). */
export const PROOF_MAX_LONG_EDGE = 2000;

/** Constraints stated to the user up front (component spec §25). */
export const PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const PROOF_MAX_FILES = 5;

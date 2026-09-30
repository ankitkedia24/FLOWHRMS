/**
 * Where private files live in storage, and which stored paths the server
 * will record or sign: employee documents, expense receipts, task proof.
 *
 * WHY this exists: the browser uploads straight into the private buckets
 * (their only storage policy is "signed-in users may insert"), then hands
 * the path back to a server action to record. That path is untrusted
 * input. Files are read through links signed server-side with the
 * service-role key, which can read EVERY company's files — so a recorded
 * path pointing at another company's, or another person's, file would
 * turn "open my document" into "open anyone's". Every path is therefore
 * checked twice: when it is recorded, and again just before it is signed.
 *
 * Layout — the company first, then the record that owns the file:
 *   employee-documents  {tenantId}/{membershipId}/{stamp}-{name}
 *   expense-receipts    {tenantId}/{membershipId}/{draftId}/{stamp}-{name}
 *   task-proof          {tenantId}/{taskId}/{stamp}-{name}
 *
 * A receipt belongs to the person claiming it: the claim does not exist
 * yet when the browser uploads, so a per-submission `draftId` groups the
 * files instead. Proof belongs to its task.
 *
 * Pure, and shared: the browser uploaders build paths with it and the
 * server actions check them with it (src/tests/storage-paths.test.ts).
 */

const MAX_PATH_LENGTH = 400;
const MAX_NAME_LENGTH = 100;

/** Ids as the database stores them (UUIDs). An empty id never forms a prefix. */
const ID = /^[A-Za-z0-9-]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** `{Date.now()}-{safe name}`, exactly as the uploaders write it. */
const STAMPED_FILE = /^\d{1,16}-[A-Za-z0-9_.-]{1,100}$/;

/**
 * A file name that is safe as the last part of a storage path: letters,
 * digits, `_`, `.` and `-` only, no `..` (the path check refuses any), and
 * short enough that the whole path stays well inside storage's limits. The
 * end is kept when trimming, so the extension survives.
 */
export function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[^\w.-]+/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(-MAX_NAME_LENGTH)
    .replace(/^\.+/, "");
  return cleaned || "file";
}

function stamped(fileName: string, now: number): string {
  return `${Math.trunc(now)}-${safeFileName(fileName)}`;
}

export function documentPath(
  tenantId: string,
  membershipId: string,
  fileName: string,
  now: number = Date.now(),
): string {
  return `${tenantId}/${membershipId}/${stamped(fileName, now)}`;
}

export function receiptPath(
  tenantId: string,
  membershipId: string,
  draftId: string,
  fileName: string,
  now: number = Date.now(),
): string {
  return `${tenantId}/${membershipId}/${draftId}/${stamped(fileName, now)}`;
}

export function proofPath(
  tenantId: string,
  taskId: string,
  fileName: string,
  now: number = Date.now(),
): string {
  return `${tenantId}/${taskId}/${stamped(fileName, now)}`;
}

/**
 * Hygiene every stored path must pass whatever its bucket: not empty, not
 * absolute, no backslashes, no `..`, no empty or padded segments. (Each
 * part is then matched strictly, which also rules out control characters.)
 */
function wellFormed(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.length > 0 &&
    path.length <= MAX_PATH_LENGTH &&
    path === path.trim() &&
    !path.startsWith("/") &&
    !path.endsWith("/") &&
    !path.includes("\\") &&
    !path.includes("..") &&
    !path.includes("//")
  );
}

/**
 * True when `path` is exactly the owners' folders followed by parts that
 * match `rest` — nothing more, nothing less. The owners come from the
 * session and the database, never from the browser.
 */
function sitsUnder(path: unknown, owners: string[], rest: RegExp[]): path is string {
  if (!wellFormed(path)) return false;
  if (!owners.every((owner) => ID.test(owner))) return false;
  const parts = path.split("/");
  if (parts.length !== owners.length + rest.length) return false;
  return (
    owners.every((owner, i) => parts[i] === owner) &&
    rest.every((pattern, i) => pattern.test(parts[owners.length + i]))
  );
}

/** An employee document in this company, filed under this person. */
export function documentPathOk(
  path: unknown,
  tenantId: string,
  membershipId: string,
): path is string {
  return sitsUnder(path, [tenantId, membershipId], [STAMPED_FILE]);
}

/** A receipt in this company, uploaded by the person who claims it. */
export function receiptPathOk(
  path: unknown,
  tenantId: string,
  membershipId: string,
): path is string {
  return sitsUnder(path, [tenantId, membershipId], [UUID, STAMPED_FILE]);
}

/** Proof in this company, filed under this task. */
export function proofPathOk(path: unknown, tenantId: string, taskId: string): path is string {
  return sitsUnder(path, [tenantId, taskId], [STAMPED_FILE]);
}

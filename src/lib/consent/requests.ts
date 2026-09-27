/**
 * Data-rights requests (DPDP Act ss. 11–13). Plain values, shared by the
 * server actions, the Account page and the platform inbox.
 */

/** Rule 14: grievances are answered within 90 days. We use it for all requests. */
export const DATA_REQUEST_DAYS = 90;

export const DATA_REQUEST_TYPES = [
  "ACCESS",
  "CORRECTION",
  "ERASURE",
  "GRIEVANCE",
  "WITHDRAWAL",
] as const;

export type DataRequestTypeKey = (typeof DATA_REQUEST_TYPES)[number];

/** What people can choose themselves (withdrawal has its own button). */
export const SELF_SERVICE_REQUEST_TYPES: Array<{
  value: Exclude<DataRequestTypeKey, "WITHDRAWAL">;
  label: string;
  hint: string;
}> = [
  { value: "ACCESS", label: "Get a summary of my data", hint: "What is held about you and how it is used." },
  { value: "CORRECTION", label: "Correct or update my data", hint: "Say what is wrong and what it should be." },
  { value: "ERASURE", label: "Erase my data", hint: "Data the law does not require to be kept is deleted." },
  { value: "GRIEVANCE", label: "Raise a grievance", hint: "Tell us what went wrong." },
];

export const DATA_REQUEST_LABEL: Record<DataRequestTypeKey, string> = {
  ACCESS: "Summary of data",
  CORRECTION: "Correction",
  ERASURE: "Erasure",
  GRIEVANCE: "Grievance",
  WITHDRAWAL: "Consent withdrawn",
};

export function dataRequestDueDate(from: Date): Date {
  return new Date(from.getTime() + DATA_REQUEST_DAYS * 24 * 60 * 60 * 1000);
}

/** Whole days until due; negative when overdue. */
export function daysUntilDue(dueAt: Date, now: Date): number {
  return Math.ceil((dueAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

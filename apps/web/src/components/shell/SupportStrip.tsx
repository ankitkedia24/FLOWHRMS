import { endSupportSessionAction } from "@/lib/platform/support-actions";

/**
 * Shown only in a support session (lib/auth/support.ts) — so only to the
 * Flowacord person, never to anyone at the company — so they can't forget
 * whose company they are changing. Exit closes the session.
 */
export function SupportStrip({ companyName, platformUserName }: { companyName: string; platformUserName: string }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-default bg-surface-sunken px-4 py-2 text-caption text-text-primary sm:px-5"
    >
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Support session:</span> you ({platformUserName}) are inside{" "}
        <span className="font-semibold">{companyName}</span> with the Owner&apos;s access. Changes are recorded as
        Flowacord support.
      </p>
      <form action={endSupportSessionAction}>
        <button
          type="submit"
          className="inline-flex min-h-9 items-center rounded-button border border-border-default bg-surface-default px-3 text-label text-text-primary hover:bg-surface-sunken"
        >
          Exit support
        </button>
      </form>
    </div>
  );
}

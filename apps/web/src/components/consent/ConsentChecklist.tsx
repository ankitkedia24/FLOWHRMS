"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { DocumentView } from "./DocumentView";
import type { ConsentDocument } from "@/lib/consent/documents";

/**
 * One notice and its consent boxes.
 *
 * The notice is shown in full — in a scroll box so the page stays usable
 * on a phone — with a link to read it on its own page (Rule 3(a): it must
 * be understandable independently of anything else). Every purpose is its
 * own box, none pre-ticked (s.6(1): a clear affirmative action for each
 * specified purpose), and optional ones are said to be optional.
 */
export function ConsentChecklist({
  doc,
  granted,
  onChange,
  error,
}: {
  doc: ConsentDocument;
  granted: string[];
  onChange: (next: string[]) => void;
  error?: string;
}) {
  function toggle(key: string, on: boolean) {
    onChange(on ? [...new Set([...granted, key])] : granted.filter((k) => k !== key));
  }

  return (
    <section className="rounded-surface-card border border-border-default bg-surface-default">
      <div
        className="max-h-80 overflow-y-auto border-b border-border-default p-4 sm:p-5"
        tabIndex={0}
        aria-label={`${doc.title} — full text`}
      >
        <DocumentView doc={doc} headingLevel={2} compact />
      </div>
      <div className="p-4 sm:p-5">
        <Link
          href={`/privacy/notice/${doc.key}`}
          target="_blank"
          className="inline-flex items-center gap-1 text-label text-brand-primary underline-offset-2 hover:underline"
        >
          Open this notice on its own page
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </Link>
        <fieldset className="mt-3">
          <legend className="sr-only">Your consent for: {doc.title}</legend>
          {doc.purposes.map((purpose) => (
            <Checkbox
              key={purpose.key}
              label={purpose.label}
              helper={purpose.required ? "Required" : "Optional"}
              checked={granted.includes(purpose.key)}
              onChange={(e) => toggle(purpose.key, e.target.checked)}
            />
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="mt-2 text-caption text-status-error-text">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

/** Every required purpose ticked? */
export function allRequiredGranted(doc: ConsentDocument, granted: string[]): boolean {
  return doc.purposes.every((p) => !p.required || granted.includes(p.key));
}

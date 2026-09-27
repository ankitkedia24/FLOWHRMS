"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConsentChecklist, allRequiredGranted } from "@/components/consent/ConsentChecklist";
import { CURRENT_DOCUMENTS, type DocumentKey } from "@/lib/consent/documents";
import { acceptNoticesAction } from "@/lib/consent/actions";

export function ConsentForm({
  keys,
  companyName,
}: {
  keys: DocumentKey[];
  companyName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [granted, setGranted] = useState<Partial<Record<DocumentKey, string[]>>>({});
  const [error, setError] = useState<string | null>(null);

  const ready = keys.every((k) => allRequiredGranted(CURRENT_DOCUMENTS[k], granted[k] ?? []));

  return (
    <div className="flex flex-col gap-5">
      {keys.includes("employee") && (
        <p className="text-secondary text-text-secondary">
          This notice is issued by {companyName}, which uses FlowHRMS for
          attendance, leave, tasks and pay.
        </p>
      )}
      {keys.map((key) => (
        <ConsentChecklist
          key={key}
          doc={CURRENT_DOCUMENTS[key]}
          granted={granted[key] ?? []}
          onChange={(next) => setGranted((g) => ({ ...g, [key]: next }))}
        />
      ))}

      {error && <Alert variant="error" title={error} live />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          size="lg"
          loading={pending}
          disabled={!ready}
          disabledReason={!ready ? "Tick every box marked Required to continue." : undefined}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await acceptNoticesAction({ choices: granted });
              if (result.ok) router.replace("/");
              else setError(result.error);
            });
          }}
        >
          I agree — continue
        </Button>
        <form action="/auth/sign-out" method="post">
          <Button type="submit" variant="tertiary">
            I don&apos;t agree — sign out
          </Button>
        </form>
      </div>
    </div>
  );
}

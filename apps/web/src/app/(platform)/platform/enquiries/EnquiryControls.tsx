"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { updateDemoRequestAction } from "@/lib/platform/actions";
import type { DemoRequestStatusKey } from "@/lib/platform/demo-requests";

/**
 * Move an enquiry along.
 *
 * "Became a customer" is deliberately NOT one of these buttons — that
 * status is set by actually creating the company, so the inbox cannot claim
 * a conversion that never happened. The link goes to the create form with
 * the details already filled in.
 */
export function EnquiryControls({
  id,
  status,
  company,
  contactName,
}: {
  id: string;
  status: DemoRequestStatusKey;
  company: string;
  contactName: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [noting, setNoting] = useState(false);

  function move(next: DemoRequestStatusKey) {
    startTransition(async () => {
      const result = await updateDemoRequestAction({ id, status: next, note });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        setNote("");
        setNoting(false);
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  if (status === "CONVERTED") {
    return (
      <p className="text-caption text-text-secondary">
        {company} is on the platform.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {noting && (
        <Input
          label="What happened"
          optional
          placeholder="Spoke to them, calling back Monday"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {status === "NEW" && (
          <Button size="sm" loading={pending} onClick={() => move("CONTACTED")}>
            Mark as called
          </Button>
        )}
        <Link
          href={`/platform/new?from=${id}`}
          className="inline-flex h-9 items-center rounded-button border border-border-default px-3 text-label text-text-primary hover:bg-surface-sunken"
          title={`Create a company for ${contactName}`}
        >
          Set up their company
        </Link>
        {!noting && (
          <Button size="sm" variant="tertiary" onClick={() => setNoting(true)}>
            Add a note
          </Button>
        )}
        {status !== "CLOSED" && (
          <Button
            size="sm"
            variant="tertiary"
            loading={pending}
            onClick={() => move("CLOSED")}
          >
            Close
          </Button>
        )}
        {noting && (
          <Button
            size="sm"
            variant="outline"
            loading={pending}
            onClick={() => move(status)}
          >
            Save note
          </Button>
        )}
      </div>
    </div>
  );
}

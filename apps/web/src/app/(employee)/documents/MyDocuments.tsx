"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { saveDocumentAction } from "@/lib/employees/documents";
import { uploadDocument } from "@/lib/employees/upload";
import { DOCUMENT_ACCEPT } from "@/lib/employees/bucket";

/** Add a document (screen E17). Constraints stated before choosing. */
export function MyDocuments({ membershipId }: { membershipId: string }) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("");
  const [file, setFile] = useState<File | null>(null);

  if (!open) {
    return (
      <div>
        <Button size="xl" onClick={() => setOpen(true)}>
          Add a document
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Add a document"
        meta="Photo or PDF · up to 10 MB"
      />
      <div className="flex flex-col gap-1">
        <Input
          label="What is it?"
          required
          placeholder="ID proof"
          helper="For example: ID proof, address proof, certificate."
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        />
        <div className="mt-2">
          <label
            htmlFor="document-file"
            className="mb-1.5 block text-label text-text-primary"
          >
            File <span className="font-normal text-text-secondary">Required</span>
          </label>
          <input
            id="document-file"
            type="file"
            accept={DOCUMENT_ACCEPT}
            capture="environment"
            className="block w-full text-body file:mr-3 file:min-h-11 file:rounded-button file:border-0 file:bg-brand-primary-subtle file:px-4 file:font-heading file:text-label file:text-brand-primary"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <p className="mt-1 text-caption text-text-secondary">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 md:flex-row">
        <Button
          size="lg"
          loading={pending}
          disabled={!kind.trim() || !file}
          disabledReason={
            !kind.trim()
              ? "Say what the document is."
              : !file
                ? "Choose a photo or PDF."
                : undefined
          }
          onClick={() =>
            startTransition(async () => {
              if (!file) return;
              const uploaded = await uploadDocument(membershipId, file);
              if (!uploaded.ok) {
                show({ variant: "error", message: uploaded.error });
                return;
              }
              const result = await saveDocumentAction({
                kind: kind.trim(),
                name: file.name,
                path: uploaded.path,
                mime: uploaded.mime,
                sizeBytes: uploaded.sizeBytes,
              });
              if (result.ok) {
                show({ variant: "success", message: result.message });
                setOpen(false);
                setKind("");
                setFile(null);
                router.refresh();
              } else {
                show({ variant: "error", message: result.error });
              }
            })
          }
        >
          Upload
        </Button>
        <Button size="lg" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { FileUpload } from "@/components/ui/FileUpload";
import { TextArea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { startTaskAction, submitProofAction } from "@/lib/tasks/actions";
import { uploadProofFiles } from "@/lib/tasks/upload";
import { useOffline } from "@/lib/offline/OfflineProvider";

/**
 * Task actions for the assignee (screens E13/E14).
 * One primary action at a time. Proof requirements are stated in text and
 * enforced server-side — this is the friendly half of that contract.
 */
export function TaskActions({
  taskId,
  status,
  proofRequirement,
  managerName,
}: {
  taskId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED_FOR_REVIEW" | "COMPLETED";
  proofRequirement: "NONE" | "PHOTO" | "FILE";
  managerName: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const { online, enqueue } = useOffline();
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");

  if (status === "SUBMITTED_FOR_REVIEW") {
    return (
      <Alert variant="info" title={`Sent to ${managerName} for review.`}>
        You&apos;ll get a note when it&apos;s reviewed.
      </Alert>
    );
  }

  if (status === "NOT_STARTED") {
    return (
      <Button
        size="xl"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await startTaskAction({ taskId });
            if (result.ok) {
              show({ variant: "success", message: result.message });
              router.refresh();
            } else {
              show({ variant: "error", message: result.error });
            }
          })
        }
      >
        Start
      </Button>
    );
  }

  if (!submitting) {
    return (
      <Button size="xl" onClick={() => setSubmitting(true)}>
        {proofRequirement === "NONE" ? "Mark complete" : "Submit Proof"}
      </Button>
    );
  }

  const needsFile = proofRequirement !== "NONE" && files.length === 0;

  return (
    <Card>
      <CardHeader
        title={proofRequirement === "NONE" ? "Complete task" : "Submit proof"}
        meta={
          proofRequirement === "PHOTO"
            ? "A photo is required for this task."
            : proofRequirement === "FILE"
              ? "A file is required for this task."
              : undefined
        }
      />

      {proofRequirement !== "NONE" && (
        <FileUpload
          label="Proof"
          constraintsText="JPG, PNG or PDF · up to 10 MB each · up to 5 files"
          onChange={setFiles}
        />
      )}

      <div className="mt-3">
        <TextArea
          label="Note"
          optional
          placeholder="Anything your manager should know"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="max-w-none"
        />
      </div>

      <div className="mt-4 flex flex-col gap-2 md:flex-row">
        <Button
          size="lg"
          loading={pending}
          disabled={needsFile}
          disabledReason={
            needsFile
              ? proofRequirement === "PHOTO"
                ? "Take a photo to send this for review."
                : "Choose a file to send this for review."
              : undefined
          }
          onClick={() =>
            startTransition(async () => {
              // Offline: keep the photo itself on the device, not just a
              // reference to it, so closing the app doesn't lose the work.
              if (!online) {
                const queued = await enqueue("taskProof", {
                  taskId,
                  note: note.trim() || undefined,
                  files: await Promise.all(
                    files.map(async (file) => ({
                      name: file.name,
                      type: file.type,
                      blob: file.slice(0, file.size, file.type),
                    })),
                  ),
                });
                show({
                  variant: queued ? "success" : "error",
                  message: queued
                    ? "Saved on this phone. It will be sent to your manager when you're back online."
                    : "This browser can't save your proof offline. Try again when you have signal.",
                });
                if (queued) {
                  setSubmitting(false);
                  setFiles([]);
                  setNote("");
                }
                return;
              }

              const uploaded = await uploadProofFiles(taskId, files);
              if (!uploaded.ok) {
                show({ variant: "error", message: uploaded.error });
                return;
              }
              const result = await submitProofAction({
                taskId,
                note: note.trim() || undefined,
                files: uploaded.files,
              });
              if (result.ok) {
                show({ variant: "success", message: result.message });
                setSubmitting(false);
                setFiles([]);
                setNote("");
                router.refresh();
              } else {
                show({ variant: "error", message: result.error });
              }
            })
          }
        >
          {proofRequirement === "NONE" ? "Mark complete" : "Send for review"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => setSubmitting(false)}
        >
          Cancel
        </Button>
      </div>
    </Card>
  );
}

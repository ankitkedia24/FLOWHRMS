"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, TextArea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { createTaskAction } from "@/lib/tasks/actions";

/**
 * Create task (screen A7). Proof options appear only for enabled features
 * — a disabled proof type is absent, and the reason is stated where its
 * absence would confuse (implementation guide §6).
 */
const schema = z.object({
  title: z.string().trim().min(1, "Give the task a title."),
  description: z.string().trim().optional(),
  assigneeId: z.string().min(1, "Choose who this is for."),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  dueDate: z.string().optional(),
  proofRequirement: z.enum(["NONE", "PHOTO", "FILE"]),
});

type FormValues = z.infer<typeof schema>;

export function CreateTaskPanel({
  assignees,
  photoProofOn,
  fileProofOn,
}: {
  assignees: Array<{ id: string; name: string }>;
  photoProofOn: boolean;
  fileProofOn: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "MEDIUM", proofRequirement: "NONE" },
  });

  const assigneeId = watch("assigneeId");
  const proofRequirement = watch("proofRequirement");
  const assigneeName = assignees.find((a) => a.id === assigneeId)?.name;

  const proofOptions = [
    { value: "NONE", label: "No proof needed" },
    ...(photoProofOn ? [{ value: "PHOTO", label: "Photo proof required" }] : []),
    ...(fileProofOn ? [{ value: "FILE", label: "File proof required" }] : []),
  ];

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>New task</Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader title="New task" />
      <form
        onSubmit={handleSubmit((values) =>
          startTransition(async () => {
            const result = await createTaskAction({
              title: values.title,
              description: values.description,
              assigneeId: values.assigneeId,
              priority: values.priority,
              dueDate: values.dueDate || undefined,
              proofRequirement: values.proofRequirement,
            });
            if (result.ok) {
              show({ variant: "success", message: result.message });
              reset({ priority: "MEDIUM", proofRequirement: "NONE" });
              setOpen(false);
              router.refresh();
            } else {
              show({ variant: "error", message: result.error });
            }
          }),
        )}
        noValidate
        className="flex flex-col gap-1"
      >
        <Input
          label="Title"
          required
          placeholder="Deliver order #4821"
          error={errors.title?.message}
          {...register("title")}
        />
        <TextArea
          label="Description"
          optional
          className="max-w-none"
          {...register("description")}
        />
        <Select
          label="Assign to"
          required
          placeholder="Choose an employee"
          options={assignees.map((a) => ({ value: a.id, label: a.name }))}
          error={errors.assigneeId?.message}
          {...register("assigneeId")}
        />
        <Select
          label="Priority"
          options={[
            { value: "HIGH", label: "High" },
            { value: "MEDIUM", label: "Medium" },
            { value: "LOW", label: "Low" },
          ]}
          {...register("priority")}
        />
        <Input label="Due date" type="date" {...register("dueDate")} />
        <Select
          label="Proof on completion"
          options={proofOptions}
          helper={
            proofRequirement !== "NONE" && assigneeName
              ? `${assigneeName} must attach a photo or file before this task can be closed.`
              : undefined
          }
          {...register("proofRequirement")}
        />

        {!photoProofOn && !fileProofOn && (
          <Alert variant="info" title="Proof options are off for your company.">
            Turn on photo or file proof in Module Management to require
            evidence on completion.
          </Alert>
        )}

        <div className="mt-4 flex flex-col gap-2 md:flex-row">
          <Button type="submit" loading={pending}>
            Assign Task
          </Button>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

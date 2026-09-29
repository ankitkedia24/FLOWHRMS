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
import {
  leaveDays,
  leaveRequestConsequence,
  payrollMonthLabel,
} from "@/lib/leave/policy";
import { requestLeaveAction } from "@/lib/leave/actions";
import { useOffline } from "@/lib/offline/OfflineProvider";

/**
 * Leave request form (screen E10).
 * The payroll consequence is computed live from the entered dates and
 * shown BEFORE the send action — never a generic warning.
 */
const schema = z
  .object({
    type: z.enum(["FULL_DAY", "HALF_DAY", "EMERGENCY"]),
    startDate: z.string().min(1, "Choose the first day of leave."),
    endDate: z.string().min(1, "Choose the last day of leave."),
    reason: z
      .string()
      .trim()
      .min(1, "Tell your manager why you need these days."),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "The end date cannot be before the start date.",
    path: ["endDate"],
  });

type FormValues = z.infer<typeof schema>;

export function LeaveRequestForm({ timezone }: { timezone: string }) {
  const router = useRouter();
  const { show } = useToast();
  const { online, enqueue } = useOffline();
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
    defaultValues: { type: "FULL_DAY" },
  });

  const type = watch("type");
  const startDate = watch("startDate");
  const endDate = watch("endDate");

  const days =
    startDate && endDate && endDate >= startDate
      ? leaveDays({
          type,
          start: new Date(`${startDate}T00:00:00.000Z`),
          end: new Date(`${endDate}T00:00:00.000Z`),
        })
      : 0;

  const consequence =
    days > 0
      ? leaveRequestConsequence({
          days,
          monthLabel: payrollMonthLabel(
            new Date(`${startDate}T00:00:00.000Z`),
            timezone,
          ),
        })
      : null;

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      // Offline: keep it and tell the person plainly that it has NOT yet
      // reached their manager (empty-loading-error-states.md §5).
      if (!online) {
        const queued = await enqueue("leaveRequest", {
          type: values.type,
          startDate: values.startDate,
          endDate: values.endDate,
          reason: values.reason,
        });
        show({
          variant: queued ? "success" : "error",
          message: queued
            ? "Saved on this phone. It has not reached your manager yet — it will be sent when you're back online."
            : "This browser can't save your request offline. Try again when you have signal.",
        });
        if (queued) {
          reset({ type: "FULL_DAY", startDate: "", endDate: "", reason: "" });
          setOpen(false);
        }
        return;
      }

      const result = await requestLeaveAction({
        type: values.type,
        startDate: values.startDate,
        endDate: values.endDate,
        reason: values.reason,
      });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        reset({ type: "FULL_DAY", startDate: "", endDate: "", reason: "" });
        setOpen(false);
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  if (!open) {
    return (
      <Button size="xl" onClick={() => setOpen(true)}>
        Request Leave
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader title="Request leave" meta="Goes to your manager" />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-1">
        <Select
          label="Leave type"
          options={[
            { value: "FULL_DAY", label: "Full day — one or more full days" },
            { value: "HALF_DAY", label: "Half day — first or second half" },
            { value: "EMERGENCY", label: "Emergency — same-day, needs a reason" },
          ]}
          {...register("type")}
        />
        <Input
          label="From"
          type="date"
          required
          error={errors.startDate?.message}
          {...register("startDate")}
        />
        <Input
          label="To"
          type="date"
          required
          error={errors.endDate?.message}
          {...register("endDate")}
        />
        <TextArea
          label="Reason"
          required
          placeholder="Tell your manager why you need these days"
          error={errors.reason?.message}
          className="max-w-none"
          {...register("reason")}
        />

        {/* Consequence before the action. */}
        {consequence && (
          <div className="mt-2">
            <Alert variant="consequence" title={consequence.sentence}>
              {consequence.detail}
            </Alert>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 md:flex-row">
          <Button
            type="submit"
            size="lg"
            loading={pending}
            aria-label={
              consequence
                ? `Send request. ${consequence.sentence}`
                : "Send request"
            }
          >
            Send request
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

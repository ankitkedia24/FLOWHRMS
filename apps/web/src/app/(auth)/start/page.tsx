import type { Metadata } from "next";
import Link from "next/link";
import { FlowHRMSLockup } from "@/components/brand/FlowHRMSWordmark";
import { StartTrialForm } from "./StartTrialForm";

export const metadata: Metadata = {
  title: "Start your free trial",
  description:
    "Try FlowHRMS free for 30 days — attendance, leave, tasks and payroll inputs for your team. No card needed.",
};

/**
 * Self-serve trial sign-up: four short steps, then the company is created
 * and the person chooses a password on the same screen. No call, no
 * emailed link, no waiting.
 */
export default function StartTrialPage() {
  return (
    <main
      data-surface="employee"
      className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-5 pb-12 pt-10"
    >
      <Link href="/" aria-label="FlowHRMS home" className="w-max">
        <FlowHRMSLockup height={28} />
      </Link>
      <StartTrialForm />
      <p className="mt-8 text-caption text-text-tertiary">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-brand-primary underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  ChartNoAxesColumn,
  Clock,
  ListChecks,
  ReceiptIndianRupee,
} from "lucide-react";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Attendance, task ownership, leave approval, payroll visibility and accountability in one phone-first system.",
};

/**
 * Landing home / features (screens M1–M3). Copy is verbatim from
 * copy-deck.md §11 — no statistics, no customer names, no prices.
 */
const capabilities = [
  {
    icon: Clock,
    title: "Attendance",
    body: "Check in and out with the time and the permitted place of work. Working away from a branch is a normal event to confirm, not a fault to catch.",
  },
  {
    icon: ListChecks,
    title: "Task ownership",
    body: "Assign work with a due date and, where it matters, proof on completion. Everyone can see what was asked and what was done.",
  },
  {
    icon: CalendarDays,
    title: "Leave approval",
    body: "Requests reach the right person straight away, with the effect on pay shown before anyone decides.",
  },
  {
    icon: ReceiptIndianRupee,
    title: "Payroll visibility",
    body: "Payroll inputs you can review before you pay: attendance, approved leave and the components your accountant defines.",
  },
  {
    icon: ChartNoAxesColumn,
    title: "Accountability",
    body: "Approvals keep the person, the reason and the time. A daily summary tells you what actually happened.",
  },
];

export default function ProductPage() {
  return (
    <>
      <section className="border-b border-border-default bg-surface-default">
        <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-8 lg:py-24">
          <p className="micro-label text-text-tertiary">
            Designed for Indian SMEs
          </p>
          <h1 className="mt-3 max-w-[18ch] font-heading text-display text-text-primary text-balance">
            Know who is working, what got done, and what you owe.
          </h1>
          <p className="mt-4 max-w-[60ch] text-body-lg text-text-secondary">
            FlowHRMS runs attendance, tasks, leave and payroll
            inputs from one phone-first system — so your day stops running
            on calls, registers and memory.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/start"
              className="inline-flex h-12 items-center justify-center rounded-button bg-brand-primary px-6 font-heading text-body font-semibold text-text-on-primary shadow-primary-action hover:bg-brand-primary-hover"
            >
              Start free trial
            </Link>
            <Link
              href="#how"
              className="inline-flex h-12 items-center justify-center rounded-button border-[1.5px] border-border-strong bg-surface-default px-6 font-heading text-body font-semibold text-text-primary hover:bg-surface-sunken"
            >
              See how it works
            </Link>
          </div>
          <p className="mt-5 text-secondary text-text-secondary">
            Built for hardware and trading businesses, warehouses, dispatch,
            delivery and field teams.
          </p>
        </div>
      </section>

      <section
        id="how"
        aria-labelledby="capabilities"
        className="mx-auto max-w-[1200px] px-5 py-16 lg:px-8"
      >
        <h2
          id="capabilities"
          className="font-heading text-h1 text-text-primary text-balance"
        >
          Five things that decide your day
        </h2>
        <p className="mt-3 max-w-[72ch] text-body-lg text-text-secondary">
          Not a smaller version of corporate HR software. A working tool for
          businesses where presence, movement and follow-through are the job.
        </p>

        <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((item) => (
            <li key={item.title}>
              <Card className="h-full">
                <item.icon
                  aria-hidden="true"
                  className="size-6 text-brand-primary"
                />
                <h3 className="mt-3 font-heading text-h3 text-text-primary">
                  {item.title}
                </h3>
                <p className="mt-1 text-secondary text-text-secondary">
                  {item.body}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="trust"
        className="border-y border-border-default bg-surface-default"
      >
        <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-8">
          <p className="micro-label text-text-tertiary">Respectful by design</p>
          <h2
            id="trust"
            className="mt-3 font-heading text-h1 text-text-primary"
          >
            Evidence, not surveillance
          </h2>
          <p className="mt-4 max-w-[72ch] text-body-lg text-text-secondary">
            Location is captured at check-in and check-out — not
            continuously. Employees see exactly what was recorded about them,
            in the same words their manager sees. Working outside a branch is
            a normal event to confirm, not a fault to catch.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 py-16 lg:px-8">
        <div className="rounded-card bg-brand-navy-deep px-6 py-12 lg:px-12">
          <h2 className="font-heading text-h1 text-text-inverse text-balance">
            See it with your own team&apos;s day
          </h2>
          <p className="mt-3 max-w-[60ch] text-body-lg text-[color:var(--fh-color-brand-primary-subtle)]">
            Set up your company in minutes and try it with your own team —
            free for 30 days, no card needed.
          </p>
          <Link
            href="/start"
            className="mt-6 inline-flex h-12 items-center rounded-button bg-surface-default px-6 font-heading text-body font-semibold text-brand-primary hover:bg-surface-sunken"
          >
            Start free trial
          </Link>
        </div>
      </section>
    </>
  );
}

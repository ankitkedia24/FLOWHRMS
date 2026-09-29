"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/authz/guard";
import { getDb } from "@/lib/db";
import { applyPlanToTenant } from "./activate";
import { planModuleProblems } from "./plan-modules";
import { saveSeller, type PlanFeature } from "./store";
import { sellerGaps } from "./seller";

/**
 * Flowacord's controls over what it sells: plan prices and modules, the
 * seller details on invoices, and putting a company on a paid plan by hand
 * (a bank transfer, a deal agreed on the phone). Every change is audited.
 */

type Result = { ok: true; message: string } | { ok: false; error: string };

async function auditPlatform(input: {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  tenantId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string;
}) {
  await getDb().auditEvent.create({
    data: {
      tenantId: input.tenantId ?? null,
      actorType: "PLATFORM",
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      reason: input.reason,
      before: input.before as object | undefined,
      after: input.after as object | undefined,
    },
  });
}

/** "* Everything in Starter" → a bold line; one feature per line. */
function parseFeatureLines(text: string): PlanFeature[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((l) => (l.startsWith("*") ? { label: l.replace(/^\*\s*/, "").slice(0, 80), strong: true } : { label: l.slice(0, 80) }));
}

/** Whole rupees between `min` and `max`, with the ceiling named in the error. */
const rupeesField = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `Enter the ${label} in whole rupees.` })
    .int(`The ${label} is whole rupees.`)
    .min(min, `The ${label} must be at least ₹${min.toLocaleString("en-IN")}.`)
    .max(max, `That ${label} looks wrong — ₹${max.toLocaleString("en-IN")} is the ceiling.`);

const planSchema = z.object({
  id: z.string().uuid().optional(),
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,39}$/, "Key: 2–40 lowercase letters, digits or hyphens."),
  name: z.string().trim().min(2, "Give the plan a name.").max(40),
  target: z.string().trim().max(80),
  priceMonthly: rupeesField("monthly base price", 1, 10_00_000),
  priceAnnual: rupeesField("yearly base price", 1, 1_20_00_000),
  includedEmployees: z.coerce
    .number({ error: "Enter how many employees the plan includes." })
    .int("Employees included is a whole number.")
    .min(0, "Employees included can't be negative.")
    .max(1_00_000, "That many employees included looks wrong."),
  extraEmployeeMonthly: rupeesField("monthly price per extra employee", 0, 10_000),
  extraEmployeeAnnual: rupeesField("yearly price per extra employee", 0, 1_20_000),
  modules: z.array(z.string()).max(40),
  features: z.string().max(2000),
  flagship: z.boolean(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export async function savePlanAction(input: z.input<typeof planSchema>): Promise<Result> {
  const session = await requirePlatformAdmin();
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the plan." };
  const d = parsed.data;
  const problems = planModuleProblems(d.modules);
  if (problems.length) return { ok: false, error: `${problems.join(". ")}.` };
  if (d.priceAnnual > d.priceMonthly * 12) {
    return { ok: false, error: "The yearly base price should not be more than twelve monthly ones." };
  }
  if (d.extraEmployeeAnnual > d.extraEmployeeMonthly * 12) {
    return { ok: false, error: "The yearly price per extra employee should not be more than twelve monthly ones." };
  }

  const db = getDb();
  const data = {
    name: d.name,
    target: d.target,
    priceMonthly: d.priceMonthly,
    priceAnnual: d.priceAnnual,
    includedEmployees: d.includedEmployees,
    extraEmployeeMonthly: d.extraEmployeeMonthly,
    extraEmployeeAnnual: d.extraEmployeeAnnual,
    modules: [...new Set(d.modules)],
    features: parseFeatureLines(d.features) as unknown as object,
    flagship: d.flagship,
    active: d.active,
    sortOrder: d.sortOrder,
    updatedById: session.user.id,
  };

  const before = d.id ? await db.billingPlan.findUnique({ where: { id: d.id } }) : null;
  if (d.id && !before) return { ok: false, error: "That plan no longer exists." };
  if (!d.id && (await db.billingPlan.findUnique({ where: { key: d.key } }))) {
    return { ok: false, error: `A plan with the key “${d.key}” already exists.` };
  }

  const saved = await db.$transaction(async (tx) => {
    // Exactly one plan is the highlighted one on the website.
    if (d.flagship) await tx.billingPlan.updateMany({ where: { flagship: true }, data: { flagship: false } });
    return d.id
      ? tx.billingPlan.update({ where: { id: d.id }, data })
      : tx.billingPlan.create({ data: { ...data, key: d.key } });
  });

  await auditPlatform({
    actorUserId: session.user.id,
    action: d.id ? "billing.plan_changed" : "billing.plan_created",
    entityType: "billing_plan",
    entityId: saved.id,
    before: before
      ? {
          name: before.name,
          priceMonthly: before.priceMonthly,
          priceAnnual: before.priceAnnual,
          includedEmployees: before.includedEmployees,
          extraEmployeeMonthly: before.extraEmployeeMonthly,
          extraEmployeeAnnual: before.extraEmployeeAnnual,
          modules: before.modules,
          active: before.active,
          flagship: before.flagship,
        }
      : undefined,
    after: {
      name: saved.name,
      priceMonthly: saved.priceMonthly,
      priceAnnual: saved.priceAnnual,
      includedEmployees: saved.includedEmployees,
      extraEmployeeMonthly: saved.extraEmployeeMonthly,
      extraEmployeeAnnual: saved.extraEmployeeAnnual,
      modules: saved.modules,
      active: saved.active,
      flagship: saved.flagship,
    },
  });
  revalidatePath("/platform/plans");
  revalidatePath("/pricing");
  revalidatePath("/");
  return {
    ok: true,
    message: `${saved.name} saved. New prices apply to the next payment; newly added modules reach companies already on it when they next pay or when you apply the plan to them.`,
  };
}

/** Bring every paid company on a plan in line with its current module list. */
export async function applyPlanToCompaniesAction(input: { planId: string }): Promise<Result> {
  const session = await requirePlatformAdmin();
  const db = getDb();
  const plan = await db.billingPlan.findUnique({ where: { id: String(input.planId) } });
  if (!plan) return { ok: false, error: "That plan no longer exists." };
  const tenants = await db.tenant.findMany({
    where: { billingPlanId: plan.id, plan: "PAID" },
    select: { id: true, name: true },
  });
  let changed = 0;
  for (const t of tenants) {
    const changes = await db.$transaction((tx) => applyPlanToTenant(tx, t.id, plan.modules, session.user.id));
    if (changes.length) {
      changed++;
      await auditPlatform({
        actorUserId: session.user.id,
        tenantId: t.id,
        action: "billing.plan_modules_applied",
        entityType: "tenant",
        entityId: t.id,
        after: { plan: plan.key, changes },
      });
    }
  }
  revalidatePath("/platform/plans");
  return {
    ok: true,
    message:
      tenants.length === 0
        ? `No paid companies are on ${plan.name} yet.`
        : `${plan.name}'s modules applied: ${changed} of ${tenants.length} ${tenants.length === 1 ? "company" : "companies"} changed.`,
  };
}

export async function saveSellerAction(input: Record<string, string>): Promise<Result> {
  const session = await requirePlatformAdmin();
  const { before, after } = await saveSeller(input, session.user.id);
  await auditPlatform({
    actorUserId: session.user.id,
    action: "billing.seller_changed",
    entityType: "platform_setting",
    entityId: "billing_seller",
    before,
    after,
  });
  revalidatePath("/platform/billing");
  const gaps = sellerGaps(after);
  return gaps.length
    ? { ok: true, message: `Saved. Still needed before companies can pay: ${gaps.join(", ")}.` }
    : { ok: true, message: "Saved. Invoices will carry these details from the next payment." };
}

const manualSchema = z.object({
  tenantId: z.string().uuid(),
  planKey: z.string().min(1),
  cycle: z.enum(["MONTHLY", "ANNUAL"]),
  /** "YYYY-MM-DD" — paid until the end of that day, India time. Empty: no end. */
  until: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  reason: z.string().trim().min(3, "Say why — e.g. “Paid by bank transfer, UTR 1234”. It goes on the record.").max(300),
});

/**
 * Put a company on a paid plan without an online payment. No invoice is
 * issued here — one paid offline is invoiced offline.
 */
export async function setCompanyPlanAction(input: z.input<typeof manualSchema>): Promise<Result> {
  const session = await requirePlatformAdmin();
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const db = getDb();
  const [tenant, plan] = await Promise.all([
    db.tenant.findUnique({ where: { id: d.tenantId } }),
    db.billingPlan.findUnique({ where: { key: d.planKey } }),
  ]);
  if (!tenant) return { ok: false, error: "That company no longer exists." };
  if (!plan) return { ok: false, error: "Choose a plan." };
  const paidUntil = d.until ? new Date(`${d.until}T23:59:59.000+05:30`) : null;
  if (paidUntil && paidUntil <= new Date()) return { ok: false, error: "Choose a date in the future, or leave it empty for no end." };

  const changes = await db.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: tenant.id },
      data: { plan: "PAID", billingPlanId: plan.id, billingCycle: d.cycle, paidUntil, trialEndsAt: null },
    });
    return applyPlanToTenant(tx, tenant.id, plan.modules, session.user.id);
  });
  await auditPlatform({
    actorUserId: session.user.id,
    tenantId: tenant.id,
    action: "tenant.plan_set_by_platform",
    entityType: "tenant",
    entityId: tenant.id,
    reason: d.reason,
    before: {
      plan: tenant.plan,
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      paidUntil: tenant.paidUntil?.toISOString() ?? null,
    },
    after: { plan: "PAID", billingPlan: plan.key, cycle: d.cycle, paidUntil: paidUntil?.toISOString() ?? null, modules: changes },
  });
  revalidatePath(`/platform/companies/${tenant.id}`);
  revalidatePath("/platform");
  return {
    ok: true,
    message: `${tenant.name} is on ${plan.name}${paidUntil ? ` until ${d.until}` : " with no end date"}.`,
  };
}

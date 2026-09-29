"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { recordAuditEvent } from "@/lib/audit";
import { checkAccess } from "@/lib/authz/guard";
import { getPolicy, setPolicy } from "@/lib/policies";
import type { AppSession } from "@/lib/auth/types";
import {
  buildSalaryLines,
  normalizePackPercents,
  packById,
  planPackSwitch,
  resolvePayMode,
  type PackComponent,
  type PayMode,
  type PaySetupPolicy,
} from "./simple";

/**
 * Pay items and per-employee salaries.
 *
 * Most tenants never see components at all: the simple path
 * (setMonthlySalaryAction, bulkSetSalariesAction) turns one typed number
 * into the structures the engine already understands. The component
 * vocabulary survives as the advanced path for companies that need it.
 * FlowHRMS supplies no statutory formulas either way (D-P3-01).
 */

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

type Tx = Prisma.TransactionClient;

const CUSTOM_SETUP_ERROR =
  "This company uses a custom pay setup, so salaries are set per pay item. Use the Salaries page.";

/** Resolve which pay mode the tenant is actually in, from the database. */
async function currentPayMode(tenantId: string): Promise<PayMode> {
  const db = getDb();
  const [policy, components] = await Promise.all([
    getPolicy<PaySetupPolicy>(tenantId, "pay_setup"),
    db.salaryComponent.findMany({
      where: { tenantId, isActive: true },
      select: { key: true, kind: true, calculation: true, prorated: true },
    }),
  ]);
  return resolvePayMode(policy, components);
}

/**
 * D-P3-05: a structure must not be back-dated into an approved period.
 * Returns the refusal message, or null when the date is safe.
 */
async function lockedPeriodError(
  tenantId: string,
  effectiveFrom: Date,
): Promise<string | null> {
  const lockedRun = await getDb().payrollRun.findFirst({
    where: {
      tenantId,
      status: "APPROVED",
      periodMonth: { gte: effectiveFrom },
    },
    orderBy: { periodMonth: "asc" },
  });
  return lockedRun
    ? "Payroll for that period is approved and locked. Choose a later effective date, or use an adjustment."
    : null;
}

/**
 * Upsert the components a mode needs; returns their ids by key.
 *
 * The update path re-asserts the invariants the maths depends on (kind,
 * calculation, prorated, active) but NEVER the name — a tenant who renamed
 * "Monthly salary" keeps their word for it.
 */
async function ensureComponents(
  tx: Tx,
  tenantId: string,
  components: readonly PackComponent[],
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const c of components) {
    const row = await tx.salaryComponent.upsert({
      where: { tenantId_key: { tenantId, key: c.key } },
      update: {
        kind: c.kind,
        calculation: c.calculation,
        prorated: c.prorated,
        isActive: true,
      },
      create: {
        tenantId,
        key: c.key,
        name: c.name,
        kind: c.kind,
        calculation: c.calculation,
        prorated: c.prorated,
        isStatutory: false,
        sortOrder: c.sortOrder,
      },
    });
    ids.set(c.key, row.id);
  }
  return ids;
}

/**
 * The one place a salary structure is written. Both the advanced editor
 * and the simple ₹ forms come through here, so they cannot drift.
 */
async function persistStructure(
  tx: Tx,
  session: AppSession,
  data: {
    membershipId: string;
    effectiveFrom: Date;
    baseAmount: number;
    note?: string;
    lines: Array<{ componentId: string; amount: number; percent: number }>;
  },
): Promise<{ structureId: string; employee: string; previousBase: number | null }> {
  const member = await tx.tenantMembership.findFirst({
    where: {
      id: data.membershipId,
      tenantId: session.tenant.id, // tenant isolation
    },
    include: { user: true },
  });
  if (!member) throw new Error("That employee is no longer available.");

  const previous = await tx.salaryStructure.findFirst({
    where: { tenantId: session.tenant.id, membershipId: member.id },
    orderBy: { effectiveFrom: "desc" },
  });

  const structure = await tx.salaryStructure.upsert({
    where: {
      tenantId_membershipId_effectiveFrom: {
        tenantId: session.tenant.id,
        membershipId: member.id,
        effectiveFrom: data.effectiveFrom,
      },
    },
    update: {
      baseAmount: data.baseAmount,
      note: data.note,
      lines: {
        deleteMany: {},
        create: data.lines,
      },
    },
    create: {
      tenantId: session.tenant.id,
      membershipId: member.id,
      effectiveFrom: data.effectiveFrom,
      baseAmount: data.baseAmount,
      note: data.note,
      createdById: session.user.id,
      lines: { create: data.lines },
    },
  });

  return {
    structureId: structure.id,
    employee: member.user.displayName,
    previousBase: previous ? Number(previous.baseAmount) : null,
  };
}

// ---------------------------------------------------------------- advanced

const componentSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores."),
  name: z.string().trim().min(1, "Name the pay item.").max(120),
  kind: z.enum(["EARNING", "DEDUCTION"]),
  calculation: z.enum(["FIXED", "PERCENT_OF_BASE", "PER_DAY"]),
  isStatutory: z.boolean().default(false),
  prorated: z.boolean().default(true),
});

export async function saveSalaryComponentAction(
  input: z.input<typeof componentSchema>,
): Promise<ActionResult> {
  const parsed = componentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the pay item details.",
    };
  }

  const { session, decision } = await checkAccess({
    module: "PAYROLL",
    permission: "payroll.edit",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to Payroll." };
  }

  const db = getDb();
  const count = await db.salaryComponent.count({
    where: { tenantId: session.tenant.id },
  });

  const component = await db.salaryComponent.upsert({
    where: {
      tenantId_key: { tenantId: session.tenant.id, key: parsed.data.key },
    },
    update: {
      name: parsed.data.name,
      kind: parsed.data.kind,
      calculation: parsed.data.calculation,
      isStatutory: parsed.data.isStatutory,
      prorated: parsed.data.prorated,
    },
    create: {
      tenantId: session.tenant.id,
      key: parsed.data.key,
      name: parsed.data.name,
      kind: parsed.data.kind,
      calculation: parsed.data.calculation,
      isStatutory: parsed.data.isStatutory,
      prorated: parsed.data.prorated,
      sortOrder: (count + 1) * 10,
    },
  });

  await recordAuditEvent(session, {
    action: "payroll.component_saved",
    entityType: "salary_component",
    entityId: component.id,
    after: { key: component.key, name: component.name, kind: component.kind },
  });

  revalidatePath("/admin/payroll/salaries");
  return { ok: true, message: `${component.name} saved.` };
}

const structureSchema = z.object({
  membershipId: z.string().uuid(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  baseAmount: z.number().nonnegative(),
  note: z.string().trim().max(500).optional(),
  lines: z
    .array(
      z.object({
        componentId: z.string().uuid(),
        amount: z.number().nonnegative().default(0),
        percent: z.number().min(0).max(100).default(0),
      }),
    )
    .min(1, "Add at least one pay item."),
});

export async function saveSalaryStructureAction(
  input: z.input<typeof structureSchema>,
): Promise<ActionResult> {
  const parsed = structureSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the salary details.",
    };
  }

  const { session, decision } = await checkAccess({
    module: "PAYROLL",
    permission: "payroll.edit",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to Payroll." };
  }

  const db = getDb();
  const effectiveFrom = new Date(`${parsed.data.effectiveFrom}T00:00:00.000Z`);

  const locked = await lockedPeriodError(session.tenant.id, effectiveFrom);
  if (locked) return { ok: false, error: locked };

  let saved: Awaited<ReturnType<typeof persistStructure>>;
  try {
    saved = await db.$transaction((tx) =>
      persistStructure(tx, session, {
        membershipId: parsed.data.membershipId,
        effectiveFrom,
        baseAmount: parsed.data.baseAmount,
        note: parsed.data.note,
        lines: parsed.data.lines,
      }),
    );
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "That salary could not be saved.",
    };
  }

  await recordAuditEvent(session, {
    action: "payroll.structure_saved",
    entityType: "salary_structure",
    entityId: saved.structureId,
    before:
      saved.previousBase != null ? { baseAmount: saved.previousBase } : undefined,
    after: {
      employee: saved.employee,
      effectiveFrom: parsed.data.effectiveFrom,
      baseAmount: parsed.data.baseAmount,
      components: parsed.data.lines.length,
    },
  });

  revalidatePath("/admin/payroll/salaries");
  revalidatePath("/admin/payroll");

  return {
    ok: true,
    message: `Salary saved for ${saved.employee}.`,
  };
}

// ------------------------------------------------------------------ simple

const simpleSalarySchema = z.object({
  membershipId: z.string().uuid(),
  monthlySalary: z
    .number()
    .positive("Enter the monthly salary.")
    .max(99_999_999, "That amount is too large."),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
});

/**
 * Set one person's pay from one number. Used by the employee profile card
 * and the Salaries page.
 */
export async function setMonthlySalaryAction(
  input: z.input<typeof simpleSalarySchema>,
): Promise<ActionResult> {
  const parsed = simpleSalarySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the salary details.",
    };
  }

  const { session, decision } = await checkAccess({
    module: "PAYROLL",
    permission: "payroll.edit",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to Payroll." };
  }

  // Re-checked server-side on purpose: a stale client showing the ₹ form
  // for a tenant that moved to custom must not save a structure that
  // ignores half of someone's pay.
  const mode = await currentPayMode(session.tenant.id);
  if (mode.mode === "CUSTOM") return { ok: false, error: CUSTOM_SETUP_ERROR };

  const effectiveFrom = new Date(`${parsed.data.effectiveFrom}T00:00:00.000Z`);
  const locked = await lockedPeriodError(session.tenant.id, effectiveFrom);
  if (locked) return { ok: false, error: locked };

  const db = getDb();
  let saved: Awaited<ReturnType<typeof persistStructure>>;
  try {
    saved = await db.$transaction(async (tx) => {
      const componentIdByKey = await ensureComponents(
        tx,
        session.tenant.id,
        mode.mode === "PACK" ? mode.pack.components : [mode.carrier],
      );
      const lines = buildSalaryLines({
        mode,
        monthlySalary: parsed.data.monthlySalary,
        componentIdByKey,
      });
      return persistStructure(tx, session, {
        membershipId: parsed.data.membershipId,
        effectiveFrom,
        // Equal to the salary so percent packs have a sane base and the
        // "Base" column stays meaningful. The lines are what actually pay.
        baseAmount: parsed.data.monthlySalary,
        lines,
      });
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "That salary could not be saved.",
    };
  }

  await recordAuditEvent(session, {
    action: "payroll.structure_saved",
    entityType: "salary_structure",
    entityId: saved.structureId,
    before:
      saved.previousBase != null ? { baseAmount: saved.previousBase } : undefined,
    after: {
      employee: saved.employee,
      effectiveFrom: parsed.data.effectiveFrom,
      baseAmount: parsed.data.monthlySalary,
      mode: mode.mode,
    },
  });

  revalidatePath("/admin/payroll/salaries");
  revalidatePath("/admin/payroll");
  revalidatePath(`/admin/employees/${parsed.data.membershipId}`);

  return { ok: true, message: `Salary saved for ${saved.employee}.` };
}

const bulkSalariesSchema = z.object({
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  rows: z
    .array(
      z.object({
        membershipId: z.string().uuid(),
        monthlySalary: z
          .number()
          .positive("Enter the monthly salary.")
          .max(99_999_999, "That amount is too large."),
      }),
    )
    .min(1, "Enter at least one salary.")
    .max(200, "Save at most 200 salaries at a time."),
});

/** Set many salaries at once. All-or-nothing. */
export async function bulkSetSalariesAction(
  input: z.input<typeof bulkSalariesSchema>,
): Promise<ActionResult> {
  const parsed = bulkSalariesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the salaries.",
    };
  }

  const { session, decision } = await checkAccess({
    module: "PAYROLL",
    permission: "payroll.edit",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to Payroll." };
  }

  const mode = await currentPayMode(session.tenant.id);
  if (mode.mode === "CUSTOM") return { ok: false, error: CUSTOM_SETUP_ERROR };

  const effectiveFrom = new Date(`${parsed.data.effectiveFrom}T00:00:00.000Z`);
  const locked = await lockedPeriodError(session.tenant.id, effectiveFrom);
  if (locked) return { ok: false, error: locked };

  const db = getDb();
  let results: Array<{ employee: string; baseAmount: number }>;
  try {
    results = await db.$transaction(
      async (tx) => {
        const componentIdByKey = await ensureComponents(
          tx,
          session.tenant.id,
          mode.mode === "PACK" ? mode.pack.components : [mode.carrier],
        );
        const saved: Array<{ employee: string; baseAmount: number }> = [];
        for (const row of parsed.data.rows) {
          const lines = buildSalaryLines({
            mode,
            monthlySalary: row.monthlySalary,
            componentIdByKey,
          });
          const result = await persistStructure(tx, session, {
            membershipId: row.membershipId,
            effectiveFrom,
            baseAmount: row.monthlySalary,
            lines,
          });
          saved.push({ employee: result.employee, baseAmount: row.monthlySalary });
        }
        return saved;
      },
      // Generous bounds: up to 200 structures over a pooled connection.
      { timeout: 60_000, maxWait: 10_000 },
    );
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Nothing was saved. ${error.message}`
          : "Nothing was saved. Try again.",
    };
  }

  // One user action, one legible audit entry — fifty per-row events would
  // drown the activity log.
  await recordAuditEvent(session, {
    action: "payroll.salaries_bulk_set",
    entityType: "salary_structure",
    after: {
      effectiveFrom: parsed.data.effectiveFrom,
      count: results.length,
      employees: results,
    },
  });

  revalidatePath("/admin/payroll/salaries");
  revalidatePath("/admin/payroll");

  return {
    ok: true,
    message: `${results.length} ${results.length === 1 ? "salary" : "salaries"} saved.`,
  };
}

const packSchema = z.object({
  pack: z.enum(["single", "basic_hra", "custom"]),
  percents: z.record(z.string(), z.number().min(0).max(100)).optional(),
});

/**
 * Choose how salaries are shaped from now on. Existing structures are
 * never rewritten — the pack only changes what NEW saves look like.
 */
export async function applyStarterPackAction(
  input: z.input<typeof packSchema>,
): Promise<ActionResult> {
  const parsed = packSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the pay setup choice." };
  }

  const { session, decision } = await checkAccess({
    module: "PAYROLL",
    permission: "payroll.edit",
  });
  if (!decision.allowed) {
    return { ok: false, error: decision.message ?? "You don't have access to Payroll." };
  }

  const db = getDb();
  const previous = await getPolicy<PaySetupPolicy>(session.tenant.id, "pay_setup");
  const percents = normalizePackPercents(parsed.data.pack, parsed.data.percents);

  if (parsed.data.pack !== "custom") {
    const components = await db.salaryComponent.findMany({
      where: { tenantId: session.tenant.id },
      include: { _count: { select: { lines: true } } },
    });
    const plan = planPackSwitch(
      parsed.data.pack,
      components.map((c) => ({
        key: c.key,
        name: c.name,
        kind: c.kind,
        calculation: c.calculation,
        prorated: c.prorated,
        isActive: c.isActive,
        referenced: c._count.lines > 0,
      })),
    );

    // An honest refusal beats a switch that quietly is not one: a
    // referenced pay item can neither be deactivated (the engine pays ₹0
    // for inactive components) nor ignored (the mode would stay custom
    // and the button would look dead — which is how this bug was found).
    if (!plan.ok) {
      return {
        ok: false,
        error: `Can't switch: ${plan.blocking.join(", ")} ${plan.blocking.length === 1 ? "is" : "are"} part of a saved salary. Re-save those salaries without it first, or keep the custom setup.`,
      };
    }

    await db.$transaction(async (tx) => {
      await ensureComponents(tx, session.tenant.id, plan.ensure);
      if (plan.deactivateKeys.length > 0) {
        await tx.salaryComponent.updateMany({
          where: {
            tenantId: session.tenant.id,
            key: { in: plan.deactivateKeys },
            // Belt and braces: the plan only lists unreferenced keys, and
            // this predicate makes the database enforce the same rule.
            lines: { none: {} },
          },
          data: { isActive: false },
        });
      }
    });
  }

  // The policy records a switch that actually happened — writing it before
  // the component work could leave a stale declaration on failure.
  await setPolicy(
    session.tenant.id,
    "pay_setup",
    { pack: parsed.data.pack, percents } satisfies PaySetupPolicy,
    session.user.id,
  );

  await recordAuditEvent(session, {
    action: "payroll.pay_setup_changed",
    entityType: "tenant_policy",
    before: previous ? { pack: previous.pack } : undefined,
    after: { pack: parsed.data.pack, percents },
  });

  revalidatePath("/admin/payroll/salaries");
  revalidatePath("/admin/payroll");

  const label =
    parsed.data.pack === "custom"
      ? "Custom pay items"
      : packById(parsed.data.pack)!.label;
  return { ok: true, message: `Pay setup changed to ${label}.` };
}

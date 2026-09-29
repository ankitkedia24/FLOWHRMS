/**
 * Paying for a plan, against the real database: the invoice is numbered
 * and frozen, the company moves onto the plan with the plan's modules, a
 * second report of the same payment changes nothing, and an issued invoice
 * cannot be edited or deleted.
 *
 * Everything runs in a transaction that is always rolled back — including
 * the invoice counter — so no real invoice number is ever used up here.
 */
import { describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
const HAS_DB = Boolean(process.env.DATABASE_URL);

vi.mock("server-only", () => ({}));

import { getDb } from "@/lib/db";
import { issueInvoiceTx } from "@/lib/billing/activate";
import { normaliseSeller } from "@/lib/billing/seller";
import { addMonths, quote } from "@/lib/billing/pricing";

class Rollback extends Error {}

const d = describe.skipIf(!HAS_DB);
const DAY = 24 * 60 * 60 * 1000;

d("paying for a plan (integration)", () => {
  it("issues one frozen invoice and moves the company onto the plan", async () => {
    const seen: Record<string, unknown> = {};
    try {
      await getDb().$transaction(
        async (tx) => {
          const now = new Date();
          const trialEndsAt = new Date(now.getTime() + 10 * DAY);
          const tenant = await tx.tenant.create({
            data: { slug: `billing-test-${Date.now()}`, name: "Billing Test Co", plan: "TRIAL", trialEndsAt },
          });
          const modules = await tx.module.findMany({ select: { id: true, key: true } });
          // A trial with Expenses on and Payroll "not in your plan".
          await tx.tenantModuleSetting.createMany({
            data: modules.map((m) => ({
              tenantId: tenant.id,
              moduleId: m.id,
              enabled: ["EMPLOYEES", "ATTENDANCE", "LEAVE", "NOTIFICATIONS", "EXPENSES"].includes(m.key),
              allowedByPlatform: m.key !== "PAYROLL",
            })),
          });
          const plan = await tx.billingPlan.findUniqueOrThrow({ where: { key: "operations" } });
          const q = quote({ plan, cycle: "MONTHLY", employees: 4, sellerState: "Odisha", buyerState: "Odisha" });
          const order = await tx.billingPayment.create({
            data: {
              tenantId: tenant.id,
              tenantName: tenant.name,
              planId: plan.id,
              planKey: plan.key,
              planName: plan.name,
              cycle: q.cycle,
              months: q.months,
              employees: q.employees,
              rateRupees: q.rate,
              subtotalPaise: q.subtotalPaise,
              cgstPaise: q.cgstPaise,
              sgstPaise: q.sgstPaise,
              igstPaise: q.igstPaise,
              totalPaise: q.totalPaise,
              razorpayOrderId: `order_test_${Date.now()}`,
              buyer: { name: "Billing Test Co", gstin: "", address: "1 Test Road", city: "Bhubaneswar", state: "Odisha", pincode: "751001", email: "" },
            },
          });

          // Unpaid orders can still be annotated.
          await tx.billingPayment.update({ where: { id: order.id }, data: { failureReason: "first try declined" } });

          const seller = normaliseSeller({ legalName: "Flowacord Test", gstin: "27AAPFU0939F1ZV", address: "X", state: "Maharashtra" });
          const input = {
            paymentRowId: order.id,
            razorpay: { id: `pay_test_${Date.now()}`, method: "upi" },
            seller,
            planModules: plan.modules,
            now,
          };
          const first = await issueInvoiceTx(tx, input);
          const second = await issueInvoiceTx(tx, { ...input, razorpay: { id: "pay_other", method: null } });
          seen.first = first;
          seen.secondAlready = second.already;
          seen.secondNumber = second.row.invoiceNumber;
          seen.trialEndsAt = trialEndsAt;

          const after = await tx.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
          seen.tenant = after;
          const settings = await tx.tenantModuleSetting.findMany({
            where: { tenantId: tenant.id },
            include: { module: { select: { key: true } } },
          });
          seen.modules = Object.fromEntries(settings.map((s) => [s.module.key, [s.enabled, s.allowedByPlatform]]));
          seen.audit = await tx.auditEvent.count({ where: { tenantId: tenant.id, action: "billing.payment_received" } });

          const refusals: string[] = [];
          for (const [label, sql] of [
            ["edit", `UPDATE billing_payments SET "totalPaise" = 1 WHERE id = '${order.id}'`],
            ["delete", `DELETE FROM billing_payments WHERE id = '${order.id}'`],
          ] as const) {
            await tx.$executeRawUnsafe("SAVEPOINT attempt");
            try {
              await tx.$executeRawUnsafe(sql);
              refusals.push(`${label}: allowed`);
            } catch (e) {
              refusals.push(`${label}: ${/is issued and cannot be/.test(String(e)) ? "refused" : String(e)}`);
            }
            await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT attempt");
          }
          seen.refusals = refusals;
          throw new Rollback();
        },
        { timeout: 60_000, maxWait: 10_000 },
      );
    } catch (e) {
      if (!(e instanceof Rollback)) throw e;
    }

    const first = seen.first as { already: boolean; row: { status: string; invoiceNumber: string; periodStart: Date; periodEnd: Date; invoice: { totalPaise: number; cgstPaise: number; placeOfSupply: { code: string } } } };
    expect(first.already).toBe(false);
    expect(first.row.status).toBe("PAID");
    expect(first.row.invoiceNumber).toMatch(/^FH\/\d{4}\/\d{5,}$/);
    // The unused trial days are kept: the paid month starts when the trial ends.
    expect(first.row.periodStart).toEqual(seen.trialEndsAt);
    expect(first.row.periodEnd).toEqual(addMonths(seen.trialEndsAt as Date, 1));
    expect(first.row.invoice.totalPaise).toBe(79 * 4 * 118);
    expect(first.row.invoice.cgstPaise).toBe(79 * 4 * 9);
    expect(first.row.invoice.placeOfSupply.code).toBe("21");

    // Reported twice (Checkout and webhook): one invoice, same number.
    expect(seen.secondAlready).toBe(true);
    expect(seen.secondNumber).toBe(first.row.invoiceNumber);
    expect(seen.audit).toBe(1);

    const tenant = seen.tenant as { plan: string; trialEndsAt: Date | null; paidUntil: Date; billingCycle: string };
    expect(tenant.plan).toBe("PAID");
    expect(tenant.trialEndsAt).toBeNull();
    expect(tenant.paidUntil).toEqual(first.row.periodEnd);
    expect(tenant.billingCycle).toBe("MONTHLY");

    const modules = seen.modules as Record<string, [boolean, boolean]>;
    expect(modules.PAYROLL).toEqual([true, true]); // newly included → on
    expect(modules.EXPENSES).toEqual([false, false]); // not in Operations → off and locked
    expect(modules.LEAVE).toEqual([true, true]);

    expect(seen.refusals).toEqual(["edit: refused", "delete: refused"]);
  }, 90_000);
});

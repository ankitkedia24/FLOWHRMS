"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { STATES_AND_UTS } from "@/lib/signup/catalog";
import { buyerSchema } from "@/lib/billing/policy";
import { formatPaise, quote, type Cycle } from "@/lib/billing/pricing";
import {
  confirmCheckoutAction,
  reportCheckoutFailureAction,
  startCheckoutAction,
  type CheckoutOptions,
} from "@/lib/billing/actions";

interface PlanOption {
  key: string;
  name: string;
  target: string;
  priceMonthly: number;
  priceAnnual: number;
  flagship: boolean;
  features: Array<{ label: string; strong?: boolean }>;
  /** Module names, for "Includes …". */
  modules: string[];
}

/** The billing form as typed: every field a string until it is checked. */
type BuyerDraft = Record<"name" | "gstin" | "address" | "city" | "state" | "pincode", string>;

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (response: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

type Phase =
  | { name: "choose" }
  | { name: "paying" }
  | { name: "done"; message: string; paymentId: string };

/**
 * Choose a plan and a cycle, give the invoice details, see exactly what
 * will be charged (GST included), and pay through Razorpay Checkout. The
 * figures here are for showing; the server recomputes every one of them.
 */
export function SubscribeForm({
  plans,
  currentPlanKey,
  currentCycle,
  employees,
  sellerState,
  startsLabel,
  startsLater,
  ready,
  buyer: initialBuyer,
}: {
  plans: PlanOption[];
  currentPlanKey: string | null;
  currentCycle: Cycle | null;
  employees: number;
  sellerState: string;
  startsLabel: string;
  startsLater: boolean;
  ready: boolean;
  buyer: BuyerDraft;
}) {
  const router = useRouter();
  const [cycle, setCycle] = useState<Cycle>(currentCycle ?? "MONTHLY");
  const [planKey, setPlanKey] = useState(
    currentPlanKey ?? plans.find((p) => p.flagship)?.key ?? plans[0]?.key ?? "",
  );
  const [buyer, setBuyer] = useState<BuyerDraft>(initialBuyer);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "choose" });

  const plan = plans.find((p) => p.key === planKey) ?? null;
  const q = useMemo(
    () =>
      plan
        ? quote({ plan, cycle, employees, sellerState, buyerState: buyer.state })
        : null,
    [plan, cycle, employees, sellerState, buyer.state],
  );
  const bestSaving = Math.max(
    0,
    ...plans.map((p) => (p.priceMonthly > 0 ? Math.round((1 - p.priceAnnual / p.priceMonthly) * 100) : 0)),
  );

  const set = (field: keyof BuyerDraft) => (value: string) => {
    setBuyer((b) => ({ ...b, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  async function pay() {
    setFormError(null);
    const parsed = buyerSchema.safeParse(buyer);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      document.querySelector<HTMLElement>(`[name="buyer-${Object.keys(next)[0]}"]`)?.focus();
      return;
    }
    setPhase({ name: "paying" });
    const [loaded, started] = await Promise.all([
      loadCheckout(),
      startCheckoutAction({ planKey, cycle, buyer: parsed.data }),
    ]);
    if (!started.ok) {
      setPhase({ name: "choose" });
      if (started.field) setErrors({ [started.field]: started.error });
      else setFormError(started.error);
      return;
    }
    if (!loaded || !window.Razorpay) {
      setPhase({ name: "choose" });
      setFormError("Razorpay's payment window didn't load. Check your connection and try again.");
      return;
    }
    openCheckout(started.checkout);
  }

  function openCheckout(options: CheckoutOptions) {
    const rzp = new window.Razorpay!({
      key: options.key,
      order_id: options.orderId,
      amount: options.amount,
      currency: options.currency,
      name: options.name,
      description: options.description,
      prefill: options.prefill,
      theme: { color: "#7166F3" },
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        const result = await confirmCheckoutAction({
          orderId: response.razorpay_order_id,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        });
        if (result.ok) {
          setPhase({ name: "done", message: result.message, paymentId: result.paymentId });
          window.scrollTo({ top: 0, behavior: "smooth" });
          router.refresh();
        } else {
          setPhase({ name: "choose" });
          setFormError(result.error);
        }
      },
      modal: {
        ondismiss: () => setPhase((p) => (p.name === "paying" ? { name: "choose" } : p)),
      },
    });
    rzp.on("payment.failed", (response) => {
      void reportCheckoutFailureAction({
        orderId: options.orderId,
        reason: response.error?.description ?? "Payment failed.",
      });
    });
    rzp.open();
  }

  if (phase.name === "done") {
    return (
      <Alert
        variant="success"
        title="Payment received"
        live
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/subscription/invoice/${phase.paymentId}`}>
              <Button size="sm" variant="secondary">
                View invoice
              </Button>
            </Link>
            <Link href="/admin">
              <Button size="sm">Go to FlowHRMS</Button>
            </Link>
          </div>
        }
      >
        {phase.message}
      </Alert>
    );
  }

  if (plans.length === 0) {
    return (
      <Alert variant="info" title="Plans are being updated">
        Write to help@flowacord.com or call +91 89088 88880 and we&apos;ll set you up.
      </Alert>
    );
  }

  const busy = phase.name === "paying";

  return (
    <>
      <Card>
        <CardHeader
          title="Choose your plan"
          meta={`Priced per active employee per month, before GST. You have ${employees} active ${employees === 1 ? "employee" : "employees"}.`}
        />
        <div className="mb-5 inline-flex rounded-button border border-border-default bg-surface-sunken p-1" role="group" aria-label="How often to pay">
          {(["MONTHLY", "ANNUAL"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cycle === c}
              onClick={() => setCycle(c)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-[10px] px-4 text-label transition-colors",
                cycle === c ? "bg-surface-default text-text-primary shadow-elevation-1" : "text-text-secondary",
              )}
            >
              {c === "MONTHLY" ? "Monthly" : "Yearly"}
              {c === "ANNUAL" && bestSaving > 0 && (
                <span className="rounded-full bg-status-success-bg px-2 py-0.5 text-caption font-semibold text-status-success-text">
                  Save up to {bestSaving}%
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Plan">
          {plans.map((p) => {
            const selected = p.key === planKey;
            const rate = cycle === "ANNUAL" ? p.priceAnnual : p.priceMonthly;
            return (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPlanKey(p.key)}
                className={cn(
                  "relative flex flex-col rounded-surface-card border-2 p-4 text-left transition-colors",
                  selected
                    ? "border-brand-primary bg-brand-primary-subtle"
                    : "border-border-default bg-surface-default hover:border-border-strong",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-heading text-h3 text-text-primary">{p.name}</span>
                  {p.key === currentPlanKey ? (
                    <span className="rounded-full bg-status-success-bg px-2 py-0.5 text-caption font-semibold text-status-success-text">
                      Current
                    </span>
                  ) : p.flagship ? (
                    <span className="rounded-full bg-brand-primary px-2 py-0.5 text-caption font-semibold text-text-on-primary">
                      Popular
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 text-caption text-text-secondary">{p.target}</span>
                <span className="mt-3 font-mono text-h2 font-semibold text-text-primary">
                  ₹{rate}
                  <span className="text-caption font-normal text-text-secondary"> / employee / month</span>
                </span>
                {cycle === "ANNUAL" && p.priceMonthly > p.priceAnnual && (
                  <span className="text-caption text-status-success-text">
                    ₹{p.priceMonthly - p.priceAnnual} less than monthly
                  </span>
                )}
                <ul className="mt-3 flex flex-col gap-1">
                  {p.features.map((f) => (
                    <li key={f.label} className="flex items-start gap-1.5 text-secondary text-text-secondary">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-brand-primary" strokeWidth={3} aria-hidden="true" />
                      <span className={f.strong ? "font-semibold text-text-primary" : undefined}>{f.label}</span>
                    </li>
                  ))}
                </ul>
                {p.modules.length > 0 && (
                  <span className="mt-3 text-caption text-text-tertiary">Includes {p.modules.join(", ")}</span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Billing details" meta="Printed on your GST tax invoice." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            name="buyer-name"
            label="Name on invoice"
            helper="Your company's legal or trade name"
            value={buyer.name}
            onChange={(e) => set("name")(e.target.value)}
            error={errors.name}
            autoComplete="organization"
          />
          <Input
            name="buyer-gstin"
            label="GSTIN"
            optional
            helper="Add it to claim input tax credit"
            value={buyer.gstin}
            onChange={(e) => set("gstin")(e.target.value.toUpperCase())}
            error={errors.gstin}
            maxLength={15}
            autoCapitalize="characters"
          />
          <div className="sm:col-span-2">
            <Input
              name="buyer-address"
              label="Address"
              value={buyer.address}
              onChange={(e) => set("address")(e.target.value)}
              error={errors.address}
              autoComplete="street-address"
            />
          </div>
          <Input
            name="buyer-city"
            label="City"
            value={buyer.city}
            onChange={(e) => set("city")(e.target.value)}
            error={errors.city}
            autoComplete="address-level2"
          />
          <Input
            name="buyer-pincode"
            label="Pincode"
            value={buyer.pincode}
            onChange={(e) => set("pincode")(e.target.value.replace(/\D/g, "").slice(0, 6))}
            error={errors.pincode}
            inputMode="numeric"
            autoComplete="postal-code"
          />
          <div className="sm:col-span-2">
            <Select
              name="buyer-state"
              label="State"
              value={buyer.state}
              onChange={(e) => set("state")(e.target.value)}
              error={errors.state}
              placeholder="Choose the state"
              options={STATES_AND_UTS.map((s) => ({ value: s, label: s }))}
            />
          </div>
        </div>
      </Card>

      {plan && q && (
        <Card>
          <CardHeader title="Summary" />
          <dl className="flex flex-col gap-2 text-body">
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">
                {plan.name} · {q.employees} {q.employees === 1 ? "employee" : "employees"} × ₹{q.rate} × {q.months}{" "}
                {q.months === 1 ? "month" : "months"}
              </dt>
              <dd className="font-mono text-text-primary">{formatPaise(q.subtotalPaise)}</dd>
            </div>
            {q.intraState ? (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">CGST 9%</dt>
                  <dd className="font-mono text-text-primary">{formatPaise(q.cgstPaise)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">SGST 9%</dt>
                  <dd className="font-mono text-text-primary">{formatPaise(q.sgstPaise)}</dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">IGST 18%</dt>
                <dd className="font-mono text-text-primary">{formatPaise(q.igstPaise)}</dd>
              </div>
            )}
            <div className="mt-1 flex justify-between gap-4 border-t border-border-default pt-3">
              <dt className="font-semibold text-text-primary">Total</dt>
              <dd className="font-mono text-h3 font-semibold text-text-primary">{formatPaise(q.totalPaise)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-secondary text-text-secondary">
            {startsLater
              ? `Covers ${q.months === 12 ? "1 year" : "1 month"} starting ${startsLabel}, when your current period ends — you lose no days.`
              : `Covers ${q.months === 12 ? "1 year" : "1 month"} starting today.`}{" "}
            Charged for the {q.employees} {q.employees === 1 ? "person" : "people"} active in FlowHRMS today; people you
            add later are included until the next payment.
          </p>

          {formError && (
            <Alert variant="error" title="Payment not started" className="mt-4" live>
              {formError}
            </Alert>
          )}
          {!ready && (
            <Alert variant="info" title="Online payment opens shortly" className="mt-4">
              To start a plan today, write to help@flowacord.com or call +91 89088 88880.
            </Alert>
          )}

          <Button
            size="lg"
            className="mt-4 w-full sm:w-auto"
            onClick={pay}
            loading={busy}
            disabled={!ready || busy}
            disabledReason={!ready ? "Online payment isn't open yet" : undefined}
          >
            Pay {formatPaise(q.totalPaise)}
          </Button>
          <p className="mt-2 flex items-center gap-1.5 text-caption text-text-secondary">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            Secure payment by Razorpay — UPI, cards, net banking and wallets. Nothing renews automatically.
          </p>
        </Card>
      )}
    </>
  );
}

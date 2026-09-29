"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ENTERPRISE_CONTACT,
  ENTERPRISE_NOTE,
  PLANS,
  PRICING_FOOTNOTE,
  monthsFreeAcross,
  rupees,
  type Plan,
} from "@/lib/marketing/plans";

/**
 * Pricing cards with a monthly/annual toggle.
 *
 * The two buttons are a pressed-state pair rather than a switch: a switch
 * announces on/off, which says nothing about WHICH billing period is
 * showing. `aria-pressed` on both makes the current choice audible, and
 * the price itself is announced politely when it changes, because the
 * number moving under a toggle is the entire point of pressing it.
 *
 * Each card is a base price, the employees it covers, and the price of
 * each employee above that. Bullet points appear only if a plan has them
 * (/platform/plans); what each plan unlocks is decided tier by tier later.
 */
export function Pricing({ plans = PLANS }: { plans?: readonly Plan[] }) {
  const [annual, setAnnual] = useState(false);
  const free = monthsFreeAcross(plans);

  return (
    <>
      <div className="mb-7 flex items-center gap-3">
        <button
          type="button"
          className="m-pill"
          aria-pressed={!annual}
          onClick={() => setAnnual(false)}
        >
          Monthly
        </button>
        <button
          type="button"
          className="m-pill"
          aria-pressed={annual}
          onClick={() => setAnnual(true)}
        >
          Annual
          {free > 0 && (
            <span
              className="rounded-full px-2 py-[3px] text-[11px] font-bold"
              style={{
                background: annual ? "var(--m-green)" : "rgba(47,158,111,.15)",
                color: annual ? "#fff" : "var(--m-green-text)",
              }}
            >
              Save {free} {free === 1 ? "month" : "months"}
            </span>
          )}
        </button>
      </div>

      <div
        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-stretch gap-5"
        aria-live="polite"
      >
        {plans.map((plan) => {
          const dark = plan.flagship;
          const ink = dark ? "var(--m-cream)" : "var(--m-navy)";
          const sub = dark ? "var(--m-on-navy-2)" : "var(--m-muted-2)";
          const extra = annual ? plan.extraAnnual : plan.extraMonthly;
          return (
            <div key={plan.key} className="m-plan" data-flagship={dark}>
              {plan.flagship && (
                <span className="absolute -top-[13px] left-7 rounded-full bg-[color:var(--m-red)] px-3 py-1.5 text-[11.5px] font-bold tracking-[0.06em] text-white shadow-[0_3px_8px_rgba(240,78,48,.35)]">
                  MOST POPULAR
                </span>
              )}

              <div
                className="font-[family-name:var(--m-font-head)] text-xl font-extrabold"
                style={{ color: ink }}
              >
                {plan.name}
              </div>
              <div className="mb-[22px] mt-1 text-[13px]" style={{ color: sub }}>
                {plan.target}
              </div>

              <div className="flex items-baseline gap-2">
                <span className="m-plan-price" style={{ color: ink }}>
                  {rupees(annual ? plan.annual : plan.monthly)}
                </span>
                <span className="text-[13px] font-semibold" style={{ color: sub }}>
                  / {annual ? "year" : "month"}
                </span>
              </div>
              <div className="mt-1 text-xs" style={{ color: sub }}>
                {annual
                  ? `billed yearly · ${rupees(plan.monthly)} a month if paid monthly`
                  : "billed monthly"}
              </div>

              <div
                className="mb-[18px] mt-[22px] border-t"
                style={{ borderColor: dark ? "rgba(245,245,245,.15)" : "var(--m-border-inner)" }}
              />

              <ul className="flex flex-1 flex-col gap-[11px]">
                <li className="flex items-start gap-2.5 text-sm" style={{ color: ink }}>
                  <span className="m-tick" aria-hidden="true">
                    ✓
                  </span>
                  <span style={{ fontWeight: 700 }}>
                    {plan.includedEmployees} employees included
                  </span>
                </li>
                <li className="flex items-start gap-2.5 text-sm" style={{ color: ink }}>
                  <span className="m-tick" aria-hidden="true">
                    +
                  </span>
                  <span style={{ fontWeight: 500 }}>
                    {rupees(extra)} per additional employee / {annual ? "year" : "month"}
                  </span>
                </li>
                {plan.features.map((f) => (
                  <li
                    key={f.label}
                    className="flex items-start gap-2.5 text-sm"
                    style={{ color: ink }}
                  >
                    <span className="m-tick" aria-hidden="true">
                      ✓
                    </span>
                    <span style={{ fontWeight: f.strong ? 700 : 500 }}>{f.label}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/start"
                className="mt-[26px] rounded-[13px] p-3.5 text-center text-[15px] font-bold transition-transform duration-[180ms] hover:-translate-y-0.5"
                style={
                  dark
                    ? {
                        background: "var(--m-red)",
                        color: "#fff",
                        boxShadow: "0 3px 10px rgba(240,78,48,.4)",
                      }
                    : {
                        background: "transparent",
                        color: "var(--m-navy)",
                        border: "1.5px solid var(--m-navy)",
                      }
                }
              >
                Start free trial
              </Link>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-[13px] text-[color:var(--m-muted-2)]">
        {PRICING_FOOTNOTE}{" "}
        <span className="font-semibold text-[color:var(--m-navy)]">{ENTERPRISE_NOTE}</span>{" "}
        <a href={ENTERPRISE_CONTACT} className="font-semibold text-[color:var(--m-navy)] underline underline-offset-2">
          Talk to us
        </a>
      </p>
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, ArrowLeft } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SetupProgress } from "@/components/brand/SetupProgress";
import { ConsentChecklist, allRequiredGranted } from "@/components/consent/ConsentChecklist";
import { CURRENT_DOCUMENTS } from "@/lib/consent/documents";
import {
  HEARD_FROM,
  INDUSTRIES,
  SIGNUP_ROLES,
  STATES_AND_UTS,
  stateForPincode,
} from "@/lib/signup/catalog";
import { addressStep, companyStep, detailsStep, stepErrors, type StepErrors } from "@/lib/signup/validate";
import { startTrialAction, type StartTrialResult } from "@/lib/signup/actions";
import { checkSignupContactAction } from "@/lib/signup/contact-check";
import { AcceptInviteForm } from "../invite/[token]/AcceptInviteForm";
import { cn } from "@/lib/cn";

const STEPS = ["Company", "Address", "Your details", "Consent"] as const;

type Success = Extract<StartTrialResult, { ok: true }>;

type Phase =
  | { name: "form" }
  /** `result` arrives while the animation is still playing out. */
  | { name: "creating"; result: Success | null }
  | { name: "done"; result: Success };

export function StartTrialForm() {
  const [step, setStep] = useState(1);
  const [phase, setPhase] = useState<Phase>({ name: "form" });
  const [errors, setErrors] = useState<StepErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Step 1
  const [companyName, setCompanyName] = useState("");
  const [staffCount, setStaffCount] = useState("");
  const [industry, setIndustry] = useState("");
  // Step 2
  const [pincode, setPincode] = useState("");
  const [state, setState] = useState("");
  const [stateAuto, setStateAuto] = useState(true);
  const [city, setCity] = useState("");
  // Step 3
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [role, setRole] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  // Step 4
  const [accountConsent, setAccountConsent] = useState<string[]>([]);
  const [companyConsent, setCompanyConsent] = useState<string[]>([]);
  const [website, setWebsite] = useState("");
  const [checking, setChecking] = useState(false);

  const values = {
    companyName, staffCount, industry, pincode, state, city,
    name, email, mobile, role, heardFrom,
  };

  function validate(which: number): boolean {
    const schema = which === 1 ? companyStep : which === 2 ? addressStep : detailsStep;
    const found = stepErrors(schema, values);
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  /**
   * Already registered? Asked the moment the email or mobile field is
   * left, and again before step 4 — so nobody fills in the consent step
   * only to be sent back.
   */
  async function checkTaken(fields: { email?: string; mobile?: string }): Promise<boolean> {
    const found = await checkSignupContactAction(fields).catch(() => ({}) as Awaited<ReturnType<typeof checkSignupContactAction>>);
    let taken = false;
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of ["email", "mobile"] as const) {
        if (!(key in found)) continue;
        const message = found[key];
        if (message) {
          next[key] = message;
          taken = true;
        } else if (next[key]?.includes("already registered")) {
          delete next[key];
        }
      }
      return next;
    });
    return taken || Boolean(found.email || found.mobile);
  }

  async function next() {
    setFormError(null);
    if (step < 4 && !validate(step)) return;
    if (step === 3) {
      setChecking(true);
      const taken = await checkTaken({ email, mobile });
      setChecking(false);
      if (taken) return;
    }
    setStep((s) => Math.min(4, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setErrors({});
    setFormError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  const consentReady =
    allRequiredGranted(CURRENT_DOCUMENTS.account_holder, accountConsent) &&
    allRequiredGranted(CURRENT_DOCUMENTS.customer_terms, companyConsent);

  async function submit() {
    setFormError(null);
    setPhase({ name: "creating", result: null });
    const result = await startTrialAction({
        companyName,
        staffCount,
        industry: industry as (typeof INDUSTRIES)[number],
        pincode,
        state: state as (typeof STATES_AND_UTS)[number],
        city,
        name,
        email,
        mobile,
        role: role as (typeof SIGNUP_ROLES)[number],
        heardFrom: (heardFrom || undefined) as (typeof HEARD_FROM)[number] | undefined,
        consents: { account_holder: accountConsent, customer_terms: companyConsent },
        website,
      });
    if (result.ok) {
      // Hand the result to the animation; it finishes its steps and then
      // moves on (SetupProgress onComplete) — never an abrupt cut.
      setPhase({ name: "creating", result });
      return;
    }
    setPhase({ name: "form" });
    if (result.step) setStep(result.step);
    if (result.field && result.field !== "consents") {
      setErrors({ [result.field]: result.error });
    } else {
      setFormError(result.error);
    }
  }

  if (phase.name === "creating") {
    const ready = phase.result;
    return (
      <div className="mt-8">
        <SetupProgress
          companyName={companyName}
          done={ready !== null}
          readyTitle="Your free trial has started"
          readyMessage={`${companyName.trim() || "Your company"} is ready. Next, choose your password.`}
          onComplete={() => {
            if (ready) {
              setPhase({ name: "done", result: ready });
              window.scrollTo({ top: 0 });
            }
          }}
        />
      </div>
    );
  }

  if (phase.name === "done") {
    const r = phase.result;
    const ends = new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(new Date(r.trialEndsAt));
    return (
      <div className="mt-8 flex flex-col gap-5">
        <div className="rounded-surface-card border border-status-success-border bg-status-success-bg p-5 motion-safe:animate-[fh-confirm-pulse_var(--fh-motion-duration-slow)_var(--fh-motion-easing-spring-subtle)]">
          <CircleCheck aria-hidden="true" className="size-9 text-status-success-fg" />
          <h1 role="status" className="mt-3 font-heading text-h1 text-status-success-text">
            Your {r.trialDays}-day free trial has started!
          </h1>
          <p className="mt-2 text-body text-status-success-text">
            {r.companyName} is set up on FlowHRMS. Your trial runs until{" "}
            <strong>{ends}</strong>.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-h2 text-text-primary">
            Last step, {r.ownerFirstName}: choose a password
          </h2>
          <p className="mt-1 text-secondary text-text-secondary">
            You&apos;ll sign in with {r.email}.
            {r.verificationEmailSent
              ? " We've also sent you an email to confirm your address — confirm it to invite your team."
              : " Confirm your email address later from your dashboard to invite your team."}
          </p>
          <div className="mt-5">
            <AcceptInviteForm token={r.token} employeeName={r.ownerFirstName} variant="owner" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-7">
      <h1 className="font-heading text-h1 text-text-primary">Start your free trial</h1>
      <p className="mt-1 text-body text-text-secondary">
        30 days free, every feature your team needs. No card, no call.
      </p>

      {/* Progress: text plus bar, never the bar alone. */}
      <div className="mt-6" aria-label={`Step ${step} of 4: ${STEPS[step - 1]}`}>
        <p className="text-label text-text-secondary">
          Step {step} of 4 · <span className="text-text-primary">{STEPS[step - 1]}</span>
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={cn(
                "h-1.5 rounded-full",
                i < step ? "bg-brand-primary" : "bg-border-default",
              )}
            />
          ))}
        </div>
      </div>

      <form
        noValidate
        className="mt-6 flex flex-col gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 4) void next();
          else if (consentReady) void submit();
        }}
      >
        {step > 1 && (
          <button
            type="button"
            onClick={back}
            className="mb-2 inline-flex w-max items-center gap-1.5 text-label text-brand-primary"
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> Back
          </button>
        )}

        {formError && (
          <div className="mb-3">
            <Alert variant="error" title={formError} live />
          </div>
        )}

        {step === 1 && (
          <>
            <Input
              label="Company name"
              required
              autoFocus
              autoComplete="organization"
              value={companyName}
              error={errors.companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <Input
              label="How many people work there?"
              required
              type="number"
              inputMode="numeric"
              min={1}
              value={staffCount}
              error={errors.staffCount}
              onChange={(e) => setStaffCount(e.target.value)}
            />
            <Select
              label="Industry or trade"
              required
              placeholder="Choose one"
              value={industry}
              error={errors.industry}
              onChange={(e) => setIndustry(e.target.value)}
              options={INDUSTRIES.map((i) => ({ value: i, label: i }))}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Input label="Country" value="India" disabled helper="FlowHRMS is available in India." />
            <Input
              label="Pincode"
              required
              inputMode="numeric"
              maxLength={6}
              autoComplete="postal-code"
              value={pincode}
              error={errors.pincode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setPincode(v);
                const suggested = stateForPincode(v);
                if (suggested && (stateAuto || !state)) {
                  setState(suggested);
                  setStateAuto(true);
                }
              }}
            />
            <Select
              label="State"
              required
              placeholder="Choose the state"
              value={state}
              error={errors.state}
              helper={stateAuto && state ? "Filled in from the pincode — change it if it's wrong." : undefined}
              onChange={(e) => {
                setState(e.target.value);
                setStateAuto(false);
              }}
              options={STATES_AND_UTS.map((s) => ({ value: s, label: s }))}
            />
            <Input
              label="City or town"
              required
              autoComplete="address-level2"
              value={city}
              error={errors.city}
              onChange={(e) => setCity(e.target.value)}
            />
          </>
        )}

        {step === 3 && (
          <>
            <Input
              label="Your name"
              required
              autoComplete="name"
              value={name}
              error={errors.name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Work email"
              required
              type="email"
              autoComplete="email"
              helper="You'll sign in with this. We'll send a link to confirm it."
              value={email}
              error={errors.email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => {
                if (detailsStep.shape.email.safeParse(email).success) void checkTaken({ email });
              }}
            />
            <Input
              label="Mobile number"
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              prefix={<span className="text-text-secondary">+91</span>}
              value={mobile}
              error={errors.mobile}
              onChange={(e) => setMobile(e.target.value)}
              onBlur={() => {
                if (detailsStep.shape.mobile.safeParse(mobile).success) void checkTaken({ mobile });
              }}
            />
            <Select
              label="Your role in the company"
              required
              placeholder="Choose one"
              helper="You'll have full access to set up the company."
              value={role}
              error={errors.role}
              onChange={(e) => setRole(e.target.value)}
              options={SIGNUP_ROLES.map((r) => ({ value: r, label: r }))}
            />
            <Select
              label="How did you hear about us?"
              optional
              placeholder="Choose one"
              value={heardFrom}
              onChange={(e) => setHeardFrom(e.target.value)}
              options={HEARD_FROM.map((h) => ({ value: h, label: h }))}
            />
          </>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-5">
            <p className="text-body text-text-secondary">
              Please read how your personal data is used and tick each box
              you agree to. Boxes marked Required are needed to run your
              account; the rest are your choice.
            </p>
            <ConsentChecklist
              doc={CURRENT_DOCUMENTS.account_holder}
              granted={accountConsent}
              onChange={setAccountConsent}
            />
            <ConsentChecklist
              doc={CURRENT_DOCUMENTS.customer_terms}
              granted={companyConsent}
              onChange={setCompanyConsent}
            />
            <p className="text-secondary text-text-secondary">
              Read the{" "}
              <Link href="/terms" target="_blank" className="text-brand-primary underline-offset-2 hover:underline">
                Terms of Service
              </Link>{" "}
              and the{" "}
              <Link href="/privacy" target="_blank" className="text-brand-primary underline-offset-2 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        )}

        {/* Left empty by a person, filled by most bots. Hidden from sight
            and from screen readers, and never focusable. */}
        <div aria-hidden="true" className="sr-only">
          <label htmlFor="start-website">Leave this field empty</label>
          <input
            id="start-website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <div className="mt-4">
          {step < 4 ? (
            <Button type="submit" size="xl" className="w-full" loading={checking}>
              Continue
            </Button>
          ) : (
            <Button
              type="submit"
              size="xl"
              className="w-full"
              disabled={!consentReady}
              disabledReason={!consentReady ? "Tick every box marked Required to continue." : undefined}
            >
              Start my free trial
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

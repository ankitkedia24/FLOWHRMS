import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppSession, hasSupabaseUser } from "@/lib/auth/session";
import { CtaBand } from "@/components/marketing/CtaBand";
import { Evidence } from "@/components/marketing/Evidence";
import { HeroPanel } from "@/components/marketing/HeroPanel";
import { OperatingLoop } from "@/components/marketing/OperatingLoop";
import { Pricing } from "@/components/marketing/Pricing";
import { loadMarketingPlans } from "@/lib/billing/store";
import { Reveal } from "@/components/marketing/Reveal";
import { Ticker } from "@/components/marketing/Ticker";
import { UseCases } from "@/components/marketing/UseCases";

export const metadata: Metadata = {
  title: "FlowHRMS by Flowacord",
  description:
    "Know who is working, what got done, and what you owe—from one phone-first system built for Indian SMEs.",
};

/**
 * The landing page, served AT the root.
 *
 * It used to be a redirect to /product, then an import of that page. Both
 * were wrong for the same reason: the address people type, share and print
 * should be the one they end up on. It is now a page in its own right.
 *
 * Signed-in people are still routed to their own surface, because the root
 * is also where they arrive from a bookmark.
 */
export default async function LandingPage() {
  const session = await getAppSession();
  if (session) {
    if (session.permissions.has("admin.access")) redirect("/admin");
    redirect("/home");
  }
  // Authenticated with Supabase but no usable FlowHRMS account — sign-in says
  // why, rather than dropping them on marketing with no explanation.
  if (await hasSupabaseUser()) redirect("/sign-in?error=no-access");

  return (
    <>
      {/* ---------------------------------------------------------- hero */}
      <header
        id="top"
        className="m-shell grid grid-cols-[repeat(auto-fit,minmax(min(100%,470px),1fr))] items-center gap-14 pb-[72px] pt-[150px]"
      >
        <div>
          <Reveal>
            <p className="m-eyebrow inline-flex items-center gap-2 rounded-full border border-[rgba(240,78,48,.25)] bg-[rgba(240,78,48,.08)] px-3.5 py-[7px]">
              <span className="size-[7px] rounded-full bg-[color:var(--m-red)]" />
              DESIGNED FOR INDIAN SMEs
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="m-h1 mb-5 mt-[22px]">
              Work happens in the field. Your system should too.
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="m-lede mb-8 max-w-[52ch]">
              Know who is working, what got done, and what you owe—from one phone-first system.
            </p>
          </Reveal>
          <Reveal delay={240} className="flex flex-wrap gap-3.5">
            <Link href="/start" className="m-btn-primary">
              Start free trial
            </Link>
            <a href="#how" className="m-btn-outline">
              See how it works
            </a>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <HeroPanel />
        </Reveal>
      </header>

      <Ticker />

      {/* ------------------------------------------------ operating loop */}
      <section id="how" className="m-shell py-24" aria-labelledby="how-heading">
        <Reveal className="mb-12 max-w-[640px]">
          <p className="m-eyebrow mb-3.5">THE OPERATING LOOP</p>
          <h2 id="how-heading" className="m-h2 mb-3.5">
            Five things that decide your day
          </h2>
          <p className="m-section-lede">
            Every morning starts with the same questions. FlowHRMS answers them before the first chai.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <OperatingLoop />
        </Reveal>
      </section>

      {/* ------------------------------------------------------ evidence */}
      <section
        id="evidence"
        className="bg-[color:var(--m-navy)] px-7 py-24"
        aria-labelledby="evidence-heading"
      >
        <div className="mx-auto max-w-[1240px]">
          <Reveal className="mb-12 max-w-[620px]">
            <p className="m-eyebrow mb-3.5 text-[color:var(--m-amber)]">RESPECTFUL BY DESIGN</p>
            <h2 id="evidence-heading" className="m-h2 mb-3.5 text-[color:var(--m-cream)]">
              Evidence, not surveillance
            </h2>
            <p className="m-section-lede text-[color:var(--m-on-navy-2)]">
              Location is captured at check-in and check-out—not continuously. Your team sees
              exactly what you see.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <Evidence />
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------- use cases */}
      <section id="usecases" className="m-shell py-24" aria-labelledby="usecases-heading">
        <Reveal className="mb-11 max-w-[620px]">
          <p className="m-eyebrow mb-3.5">WHO RUNS ON FLOWHRMS</p>
          <h2 id="usecases-heading" className="m-h2 mb-3.5">
            Built for the way real teams work
          </h2>
          <p className="m-section-lede">
            Hardware counters, godowns, delivery fleets, field teams—phone-first for the people
            doing the work.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <UseCases />
        </Reveal>
      </section>

      {/* ------------------------------------------------------- pricing */}
      <section id="pricing" className="m-shell pb-24" aria-labelledby="pricing-heading">
        <Reveal className="mb-10 max-w-[620px]">
          <p className="m-eyebrow mb-3.5">PRICING</p>
          <h2 id="pricing-heading" className="m-h2 mb-3.5">
            Three plans. Nothing hidden.
          </h2>
          <p className="m-section-lede">
            Each plan covers a set number of employees. Grow past it and you pay only for the extra people.
          </p>
        </Reveal>
        <Reveal delay={80}>
          <Pricing plans={await loadMarketingPlans()} />
        </Reveal>
      </section>

      <CtaBand />
    </>
  );
}

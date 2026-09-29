import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ParamSelect } from "@/components/filters/ParamSelect";
import { TravelClaimForm } from "@/components/field-visits/TravelClaimForm";
import { VehicleChooser } from "@/components/field-visits/VehicleChooser";
import { existingTravelClaim, loadMonthTravel, loadTravelContext, type TravelBlocker } from "@/lib/field-visits/conveyance";
import { claimableMonths, monthName } from "@/lib/field-visits/state";

export const metadata: Metadata = { title: "Travel allowance" };

const BLOCKED: Record<TravelBlocker, { title: string; body: string }> = {
  "field-visits-off": { title: "Field visits aren't switched on.", body: "Travel allowance comes from field visits." },
  "not-a-recorder": { title: "You don't record field visits.", body: "Travel allowance is claimed by the people who do." },
  "expenses-off": {
    title: "Expenses isn't switched on for your company.",
    body: "Travel allowance is paid as an expense claim. Ask your admin.",
  },
  "expenses-unpublished": {
    title: "Your company hasn't published its expense rules yet.",
    body: "Travel can be claimed once it has. Ask your admin.",
  },
  "no-rates": {
    title: "No travel rate is set yet.",
    body: "Your company sets a rate per km for each vehicle in its field visit rules. Ask your admin.",
  },
};

/**
 * Travel allowance (FIELD-VISITS-MODULE.md §7): a month that has ended,
 * its kilometres from the trips (declined ones left out), the rate for the
 * person's vehicle, and one claim into Expenses.
 */
export default async function TravelClaimPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { session, decision } = await checkAccess({ module: "FIELD_VISITS" });
  if (!decision.allowed) redirect("/unauthorized");
  if (devFixtureOffline()) redirect("/home");

  const loaded = await loadTravelContext(session);
  const header = (
    <div className="mt-2">
      <Link href="/field-visits" className="text-label text-brand-primary underline-offset-2 hover:underline">
        ← My day
      </Link>
      <h1 className="mt-2 font-heading text-h1 text-text-primary">Travel allowance</h1>
    </div>
  );
  if (!loaded.ok) {
    const b = BLOCKED[loaded.blocker];
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Card flush>
          <EmptyState title={b.title} body={b.body} />
        </Card>
      </div>
    );
  }
  const { context } = loaded;
  const months = claimableMonths(context.thisMonth);
  const asked = (await searchParams).month;
  const month = asked && months.includes(asked) ? asked : months[0];
  const label = monthName(month);

  const [existing, travel] = await Promise.all([
    existingTravelClaim(session.tenant.id, session.membership.id, month),
    loadMonthTravel(session.tenant.id, session.membership.id, month),
  ]);

  return (
    <div className="flex flex-col gap-4">
      {header}

      <Card>
        <CardHeader title="Your vehicle" meta="Travel is paid per km at your vehicle's rate" />
        {context.vehicle ? (
          <p className="text-body text-text-primary">
            {context.vehicle.name} · ₹{context.vehicle.ratePerKm?.toFixed(2)} per km
            <span className="block text-caption text-text-secondary">Ask your admin if this needs to change.</span>
          </p>
        ) : context.vehicleGone ? (
          <Alert variant="warning" title="Your vehicle is no longer paid for.">
            Ask your admin to set the vehicle you use.
          </Alert>
        ) : (
          <>
            <p className="mb-3 text-secondary text-text-secondary">
              Choose the vehicle you use for work. You choose once; after that your admin can change it.
            </p>
            <VehicleChooser
              vehicles={context.vehicles.map((v) => ({ key: v.key, name: v.name, ratePerKm: v.ratePerKm ?? 0 }))}
              current={null}
            />
          </>
        )}
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-heading text-h2 text-text-primary">{label}</h2>
        <ParamSelect
          param="month"
          label="Month"
          options={months.map((m) => ({ value: m, label: monthName(m) }))}
          selected={month}
        />
      </div>

      {existing ? (
        <Alert variant="info" title={`${label} is claimed — ${existing.ref}, ${existing.claimedKm} km.`}>
          <Link href={`/expenses/${existing.claimId}`} className="text-brand-primary underline-offset-2 hover:underline">
            Open the claim
          </Link>
          {" "}to see where it stands. If it&apos;s refused or you withdraw it, you can claim the month again.
        </Alert>
      ) : !travel || travel.tripsCounted === 0 ? (
        <Card flush>
          <EmptyState
            title={`No trips in ${label}.`}
            body={travel?.tripsDeclined ? "Your trips that month were declined, so there's nothing to claim." : "Trips you make show here the month after."}
          />
        </Card>
      ) : (
        <Card>
          <ul className="mb-3 flex flex-col gap-1 text-secondary">
            {travel.days.map((d) => (
              <li key={d.date} className="flex justify-between gap-3 border-b border-border-subtle pb-1 last:border-0">
                <span className="text-text-primary">
                  {new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
                    new Date(`${d.date}T00:00:00.000Z`),
                  )}
                  <span className="text-text-secondary"> · {d.trips} trip{d.trips === 1 ? "" : "s"}</span>
                </span>
                <span className="font-mono tabular-nums text-text-primary">
                  {d.km} km{d.estimatedKm > 0 ? <span className="text-text-secondary"> (about {d.estimatedKm})</span> : ""}
                </span>
              </li>
            ))}
          </ul>
          {(travel.tripsDeclined > 0 || travel.tripsAwaiting > 0 || travel.estimatedKm > 0) && (
            <ul className="mb-3 list-disc pl-5 text-caption text-text-secondary">
              {travel.tripsDeclined > 0 && (
                <li>
                  {travel.tripsDeclined} declined trip{travel.tripsDeclined === 1 ? " is" : "s are"} left out.
                </li>
              )}
              {travel.tripsAwaiting > 0 && (
                <li>
                  {travel.tripsAwaiting} trip{travel.tripsAwaiting === 1 ? " hasn't" : "s haven't"} been approved yet —
                  counted, and your approver is told.
                </li>
              )}
              {travel.estimatedKm > 0 && (
                <li>{travel.estimatedKm} km are straight-line estimates, because the road distance isn&apos;t known.</li>
              )}
            </ul>
          )}
          {context.vehicle && context.vehicle.ratePerKm !== null ? (
            <TravelClaimForm
              month={month}
              monthLabel={label}
              recordedKm={travel.recordedKm}
              ratePerKm={context.vehicle.ratePerKm}
              vehicleName={context.vehicle.name}
            />
          ) : (
            <p className="text-secondary text-text-secondary">Choose your vehicle above to claim.</p>
          )}
        </Card>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { devFixtureOffline } from "@/lib/auth/fixture";
import { FieldVisitsTabs } from "@/components/field-visits/FieldVisitsTabs";
import { PlacesManager } from "@/components/field-visits/PlacesManager";
import { loadFieldVisitsPolicy } from "@/lib/field-visits/access";
import { capitalise } from "@/lib/field-visits/policy";
import { loadPlaces } from "@/lib/field-visits/team";

export const metadata: Metadata = { title: "Field visit places" };

/**
 * The saved places (FIELD-VISITS-MODULE.md §6), for whoever sees everyone's
 * field visits: rename, fix the pin, merge repeats, retire.
 */
export default async function FieldVisitPlacesPage() {
  const { session, decision } = await checkAccess({ module: "FIELD_VISITS", permission: "fieldvisits.view" });
  if (!decision.allowed) redirect("/unauthorized");
  if (devFixtureOffline()) redirect("/admin");
  const published = await loadFieldVisitsPolicy(session.tenant.id);
  if (!published) redirect("/admin/field-visits");

  const tz = session.tenant.timezone;
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: tz });
  const places = (await loadPlaces(session.tenant.id)).map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    isActive: p.isActive,
    visits: p.visits,
    lastVisit: p.lastVisitAt ? date.format(p.lastVisitAt) : null,
  }));
  const word = published.policy.placeWord;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-h1 text-text-primary">Field visits</h1>
      <FieldVisitsTabs current="places" places />
      <p className="text-secondary text-text-secondary">
        {capitalise(word.plural)} are added from the phone, at the spot, the first time someone visits.
        {" "}{places.filter((p) => p.isActive).length} in use.
      </p>
      <PlacesManager places={places} word={word} farFlagMeters={published.policy.farFlagMeters} />
    </div>
  );
}

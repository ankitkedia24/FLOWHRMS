import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { STATUS } from "@/lib/status";
import { MODULES, MODULE_DEPENDENCIES } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Modules",
  description:
    "Core and optional modules, their dependencies, and what is deliberately out of scope.",
};

/**
 * Module overview (screen M4). States dependencies and the V1 exclusions
 * plainly — a customer should know what FlowHRMS does not do before buying.
 */
export default function ModulesPage() {
  const core = Object.values(MODULES).filter((m) => m.category !== "OPTIONAL");
  const optional = Object.values(MODULES).filter(
    (m) => m.category === "OPTIONAL",
  );

  const dependencyLine = (key: string) => {
    const deps = MODULE_DEPENDENCIES.filter((d) => d.module === key);
    if (deps.length === 0) return null;
    const all = deps.filter((d) => !d.anyOfGroup).map((d) => MODULES[d.requires].name);
    const any = deps.filter((d) => d.anyOfGroup).map((d) => MODULES[d.requires].name);
    const parts: string[] = [];
    if (all.length) parts.push(all.join(" and "));
    if (any.length) parts.push(any.join(" or "));
    return `Needs ${parts.join(", and ")}`;
  };

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-8">
      <h1 className="font-heading text-h1 text-text-primary">Modules</h1>
      <p className="mt-3 max-w-[72ch] text-body-lg text-text-secondary">
        You turn on what your business uses. Each module is controlled per
        company, and turning one off removes it from the app for everyone —
        without deleting the records it already holds.
      </p>

      <section aria-labelledby="core-modules" className="mt-10">
        <h2
          id="core-modules"
          className="font-heading text-h2 text-text-primary"
        >
          Core modules
        </h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {core.map((moduleDef) => {
            const deps = dependencyLine(moduleDef.key);
            return (
              <li key={moduleDef.key}>
                <Card className="h-full">
                  <h3 className="font-heading text-h3 text-text-primary">
                    {moduleDef.name}
                  </h3>
                  <p className="mt-1 text-secondary text-text-secondary">
                    {moduleDef.description}
                  </p>
                  {deps && (
                    <p className="mt-2 text-caption text-text-tertiary">
                      {deps}
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="optional-modules" className="mt-10">
        <h2
          id="optional-modules"
          className="font-heading text-h2 text-text-primary"
        >
          Optional modules
        </h2>
        <p className="mt-2 max-w-[72ch] text-secondary text-text-secondary">
          Available once their detailed rules are agreed with you.
        </p>
        <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {optional.map((moduleDef) => (
            <li key={moduleDef.key}>
              <Card className="h-full">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-heading text-h3 text-text-primary">
                    {moduleDef.name}
                  </h3>
                  <StatusChip status={STATUS.notAvailable} size="sm" />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="not-included" className="mt-10">
        <h2
          id="not-included"
          className="font-heading text-h2 text-text-primary"
        >
          Not included
        </h2>
        <p className="mt-2 max-w-[72ch] text-secondary text-text-secondary">
          Deliberately out of scope, so you know before you start:
        </p>
        <ul className="mt-4 grid gap-2 text-body text-text-secondary md:grid-cols-2">
          {[
            "Biometric, face, QR or RFID attendance",
            "Continuous or background location tracking",
            "Visitor register",
            "Bank transfer generation",
            "Accounting integrations (Tally, Busy, Zoho)",
            "CRM and inventory",
            "Holiday calendar and earned-leave balances",
            "Additional language packs",
          ].map((item) => (
            <li
              key={item}
              className="rounded-md border border-border-default bg-surface-default px-4 py-2.5"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

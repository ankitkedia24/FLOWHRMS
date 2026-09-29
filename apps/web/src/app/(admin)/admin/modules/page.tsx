import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { checkAccess } from "@/lib/authz/guard";
import { loadEntitlements } from "@/lib/authz/entitlements";
import { getDb } from "@/lib/db";
import { devFixtureOffline } from "@/lib/auth/fixture";
import {
  FEATURES,
  MODULES,
  MODULE_DEPENDENCIES,
  type ModuleKey,
} from "@/lib/catalog";
import { disableImpact, missingRequirements, type EnabledMap } from "@/lib/modules/impact";
import { STATUS } from "@/lib/status";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { FeatureSwitch, ModuleSwitch } from "./ModuleSwitch";

export const metadata: Metadata = { title: "Module Management" };

/**
 * Module Management (screens A20/A21/A22). Cards, feature controls,
 * dependency warnings and affected counts are live; toggles are governed
 * switches backed by server actions with impact confirmation and audit.
 */
export default async function ModuleManagementPage() {
  const { session, decision } = await checkAccess({
    module: "EMPLOYEES",
    permission: "modules.manage",
  });
  if (!decision.allowed) redirect("/unauthorized");

  const entitlements = await loadEntitlements(
    session.tenant.id,
    session.user.id,
  );
  const enabledMap = entitlements.modules as EnabledMap;

  // Modules Flowacord has not included for this company (trial package or
  // plan). The company cannot switch these on itself.
  const notAllowed = new Set(
    devFixtureOffline()
      ? []
      : (
          await getDb().tenantModuleSetting.findMany({
            where: { tenantId: session.tenant.id, allowedByPlatform: false },
            select: { module: { select: { key: true } } },
          })
        ).map((s) => s.module.key),
  );

  const [employees, admins] = devFixtureOffline()
    ? [0, 0]
    : await Promise.all([
        getDb().tenantMembership.count({
          where: { tenantId: session.tenant.id, status: "ACTIVE" },
        }),
        getDb().tenantMembership.count({
          where: {
            tenantId: session.tenant.id,
            status: "ACTIVE",
            role: {
              permissions: {
                some: { permission: { key: "admin.access" } },
              },
            },
          },
        }),
      ]);

  const dependencyLine = (key: ModuleKey): string | null => {
    const deps = MODULE_DEPENDENCIES.filter((d) => d.module === key);
    if (deps.length === 0) return null;
    const all = deps.filter((d) => !d.anyOfGroup).map((d) => MODULES[d.requires].name);
    const any = deps.filter((d) => d.anyOfGroup).map((d) => MODULES[d.requires].name);
    const parts: string[] = [];
    if (all.length) parts.push(all.join(" and "));
    if (any.length) parts.push(any.join(" or "));
    return `Requires ${parts.join(", and ")}`;
  };

  const isEnabled = (key: ModuleKey) =>
    MODULES[key].category === "CORE" || enabledMap[key] === true;

  const groups = [
    {
      title: "V1 modules",
      modules: Object.values(MODULES).filter((m) => m.category !== "OPTIONAL"),
    },
    {
      title: "Optional modules",
      modules: Object.values(MODULES).filter((m) => m.category === "OPTIONAL"),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-h1 text-text-primary">
        Module Management
      </h1>

      <Alert variant="info" title="How module changes behave">
        Turning a module off removes it from navigation, blocks it in the
        app, stops its notifications and scheduled jobs, and is recorded in
        the activity log. No business data is deleted.
      </Alert>

      {groups.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h2 className="mb-3 font-heading text-h2 text-text-primary">
            {group.title}
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {group.modules.map((moduleDef) => {
              const enabled = isEnabled(moduleDef.key);
              const notInPlan = !enabled && notAllowed.has(moduleDef.key);
              const optionalUnavailable =
                notInPlan || (moduleDef.category === "OPTIONAL" && !enabled);
              const features = FEATURES.filter((f) => f.module === moduleDef.key);
              const deps = dependencyLine(moduleDef.key);
              const missing = missingRequirements(enabledMap, moduleDef.key);
              const impact = disableImpact(enabledMap, moduleDef.key, {
                employees,
                adminUsers: admins,
              });

              return (
                <Card key={moduleDef.key} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-h3 text-text-primary">
                        {moduleDef.name}
                      </h3>
                      <p className="mt-0.5 text-secondary text-text-secondary">
                        {moduleDef.description}
                      </p>
                    </div>
                    <StatusChip
                      status={
                        optionalUnavailable
                          ? STATUS.notAvailable
                          : enabled
                            ? STATUS.enabled
                            : STATUS.disabled
                      }
                      size="sm"
                    />
                  </div>

                  {deps && (
                    <p className="text-caption text-text-secondary">{deps}</p>
                  )}

                  {optionalUnavailable ? (
                    <p className="text-secondary text-text-secondary">
                      {notInPlan
                        ? "Not included in your plan. Write to help@flowacord.com or call +91 89088 88880 to add it."
                        : "Ask your Flowacord contact to enable this after its rules are approved."}
                    </p>
                  ) : (
                    <ModuleSwitch
                      moduleKey={moduleDef.key}
                      moduleName={moduleDef.name}
                      enabled={enabled}
                      core={moduleDef.category === "CORE"}
                      locked={!enabled && missing.length > 0}
                      lockedReason={
                        !enabled && missing.length > 0
                          ? `Requires ${missing.map((m) => MODULES[m].name).join(" or ")} to be on.`
                          : undefined
                      }
                      impact={impact}
                      affectedEmployees={employees}
                      affectedAdmins={admins}
                    />
                  )}

                  {enabled && features.length > 0 && (
                    <div className="border-t border-border-subtle pt-3">
                      <p className="micro-label mb-1 text-text-tertiary">
                        Feature controls
                      </p>
                      <ul className="flex flex-col">
                        {features.map((feature) => {
                          const setting =
                            entitlements.features[
                              `${feature.module}.${feature.key}`
                            ];
                          const featureOn = setting
                            ? setting.enabled
                            : feature.defaultEnabled;
                          return (
                            <li key={feature.key}>
                              <FeatureSwitch
                                moduleKey={moduleDef.key}
                                featureKey={feature.key}
                                featureName={feature.name}
                                enabled={featureOn}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

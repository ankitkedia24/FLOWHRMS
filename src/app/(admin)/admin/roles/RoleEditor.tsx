"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Lock } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { saveRolePermissionsAction } from "@/lib/roles/actions";

/**
 * One role's permission set, with a LIVE impact banner that says what a
 * pending change lets people see before it is saved (user-flows.md §9).
 */
interface PermissionOption {
  key: string;
  name: string;
  isSensitive: boolean;
}

export function RoleEditor({
  roleId,
  roleKey,
  roleName,
  description,
  memberCount,
  granted,
  permissions,
}: {
  roleId: string;
  roleKey: string;
  roleName: string;
  description: string | null;
  memberCount: number;
  granted: string[];
  permissions: PermissionOption[];
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>(granted);
  const [open, setOpen] = useState(false);

  const isOwner = roleKey === "OWNER";
  const added = selected.filter((k) => !granted.includes(k));
  const removed = granted.filter((k) => !selected.includes(k));
  const dirty = added.length > 0 || removed.length > 0;

  const sensitiveAdded = added.filter(
    (k) => permissions.find((p) => p.key === k)?.isSensitive,
  );

  const grouped = [
    { title: "General", items: permissions.filter((p) => !p.isSensitive) },
    { title: "Sensitive", items: permissions.filter((p) => p.isSensitive) },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-h3 text-text-primary">
            {roleName}
          </h2>
          {description && (
            <p className="mt-0.5 max-w-[60ch] text-secondary text-text-secondary">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusChip
            status={{
              key: "members",
              label: `${memberCount} ${memberCount === 1 ? "person" : "people"}`,
              tone: "neutral",
            }}
            size="sm"
          />
          <StatusChip
            status={{
              key: "perms",
              label: `${granted.length} permissions`,
              tone: "info",
            }}
            size="sm"
          />
        </div>
      </div>

      {isOwner ? (
        <p className="mt-3 inline-flex items-center gap-2 text-secondary text-text-secondary">
          <Lock aria-hidden="true" className="size-4" />
          The Owner always keeps full access to their own company.
        </p>
      ) : !open ? (
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            Edit permissions
          </Button>
        </div>
      ) : (
        <div className="mt-4 border-t border-border-subtle pt-4">
          {grouped.map((group) => (
            <fieldset key={group.title} className="mb-4">
              <legend className="micro-label mb-2 text-text-tertiary">
                {group.title}
                {group.title === "Sensitive" && (
                  <EyeOff aria-hidden="true" className="ml-1 inline size-3" />
                )}
              </legend>
              <div className="flex flex-col gap-1">
                {group.items.map((permission) => (
                  <Checkbox
                    key={permission.key}
                    checked={selected.includes(permission.key)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked
                          ? [...prev, permission.key]
                          : prev.filter((k) => k !== permission.key),
                      )
                    }
                    label={permission.name}
                  />
                ))}
              </div>
            </fieldset>
          ))}

          {/* Live impact banner — states what the change lets people see. */}
          {dirty && (
            <Alert
              variant={sensitiveAdded.length > 0 ? "warning" : "info"}
              title={`You are about to change what ${memberCount} ${memberCount === 1 ? "person" : "people"} can see.`}
            >
              {sensitiveAdded.length > 0 &&
                `Adding ${sensitiveAdded
                  .map((k) => permissions.find((p) => p.key === k)?.name)
                  .join(", ")} lets every ${roleName} see it. `}
              {removed.length > 0 &&
                `Removing ${removed.length} permission(s) takes access away on their next request.`}
            </Alert>
          )}

          <div className="mt-4 flex flex-col gap-2 md:flex-row">
            <Button
              loading={pending}
              disabled={!dirty}
              disabledReason={!dirty ? "Nothing has changed yet." : undefined}
              onClick={() =>
                startTransition(async () => {
                  const result = await saveRolePermissionsAction({
                    roleId,
                    permissions: selected,
                  });
                  if (result.ok) {
                    show({ variant: "success", message: result.message });
                    setOpen(false);
                    router.refresh();
                  } else {
                    show({ variant: "error", message: result.error });
                  }
                })
              }
            >
              Save changes
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelected(granted);
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

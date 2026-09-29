"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { saveNotificationSettingsAction } from "@/lib/settings/actions";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  type NotificationPolicy,
} from "@/lib/settings/constants";

/**
 * Event × channel matrix (screen A18).
 *
 * A channel with no provider renders disabled WITH ITS REASON, rather
 * than being hidden — the admin needs to know why it cannot be used.
 */
function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function NotificationMatrix({
  policy,
  version,
  available,
}: {
  policy: NotificationPolicy | null;
  version: number;
  available: Record<string, boolean>;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();

  const [matrix, setMatrix] = useState<Record<string, boolean>>(
    policy?.matrix ?? {},
  );
  const [quiet, setQuiet] = useState(
    policy?.quietHours ?? {
      enabled: true,
      fromMinutes: 21 * 60,
      toMinutes: 7 * 60,
    },
  );

  const isOn = (event: string, channel: string) => {
    if (channel === "in_app") return true;
    return matrix[`${event}.${channel}`] ?? false;
  };

  return (
    <>
      <Card flush>
        <div className="p-5 pb-0">
          <CardHeader
            title="What gets sent, and where"
            meta={`Version ${version}`}
          />
        </div>
        {/*
          Below md: one card per event, channels stacked beneath it.
          A 6-column matrix in a horizontal scroller means the event name
          scrolls out of view while you are toggling its channels, so you
          lose track of which row you are changing — exactly the fallback
          the design system rules out (Table.tsx docblock).
        */}
        <ul className="flex flex-col gap-3 p-5 pt-0 md:hidden">
          {NOTIFICATION_EVENTS.map((event) => (
            <li
              key={event.key}
              className="rounded-surface-card border border-border-default p-4"
            >
              <p className="text-body font-medium text-text-primary">
                {event.label}
              </p>
              <div className="mt-2 flex flex-col gap-1">
                {NOTIFICATION_CHANNELS.map((channel) => {
                  const locked = channel.alwaysOn || !available[channel.key];
                  return (
                    <label
                      key={channel.key}
                      className="flex min-h-11 items-center justify-between gap-3"
                    >
                      <span className="text-secondary text-text-secondary">
                        {channel.label}
                        {channel.alwaysOn && " — always on"}
                        {!channel.alwaysOn && !available[channel.key] && (
                          <span className="block text-caption text-text-tertiary">
                            No provider configured
                          </span>
                        )}
                      </span>
                      <input
                        type="checkbox"
                        className="size-5 shrink-0 accent-[var(--fh-color-brand-primary)] disabled:cursor-not-allowed"
                        checked={isOn(event.key, channel.key)}
                        disabled={locked}
                        aria-label={`${event.label} by ${channel.label}`}
                        onChange={(e) =>
                          setMatrix((prev) => ({
                            ...prev,
                            [`${event.key}.${channel.key}`]: e.target.checked,
                          }))
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden p-5 pt-0 md:block">
          <table className="w-full border-collapse">
            <caption className="sr-only">
              Notification events by delivery channel
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="micro-label px-2 py-2 text-left text-text-tertiary"
                >
                  Event
                </th>
                {NOTIFICATION_CHANNELS.map((channel) => (
                  <th
                    key={channel.key}
                    scope="col"
                    className="micro-label px-2 py-2 text-center text-text-tertiary"
                  >
                    {channel.label}
                    {!available[channel.key] && (
                      <span className="block font-body text-caption normal-case tracking-normal text-text-tertiary">
                        Not configured
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_EVENTS.map((event) => (
                <tr key={event.key} className="border-t border-border-subtle">
                  <th
                    scope="row"
                    className="px-2 py-2.5 text-left text-body font-medium text-text-primary"
                  >
                    {event.label}
                  </th>
                  {NOTIFICATION_CHANNELS.map((channel) => {
                    const locked = channel.alwaysOn || !available[channel.key];
                    return (
                      <td key={channel.key} className="px-2 py-2.5 text-center">
                        <input
                          type="checkbox"
                          className="size-5 accent-[var(--fh-color-brand-primary)] disabled:cursor-not-allowed"
                          checked={isOn(event.key, channel.key)}
                          disabled={locked}
                          aria-label={`${event.label} by ${channel.label}${
                            channel.alwaysOn
                              ? " — always on"
                              : !available[channel.key]
                                ? " — no provider configured"
                                : ""
                          }`}
                          onChange={(e) =>
                            setMatrix((prev) => ({
                              ...prev,
                              [`${event.key}.${channel.key}`]: e.target.checked,
                            }))
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 pb-5 text-caption text-text-secondary">
          In-app is always on so nothing is missed. SMS and WhatsApp need a
          provider in Company settings to switch them on.
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Quiet hours for employees"
          meta="Nothing is lost — messages wait rather than waking someone."
        />
        <Checkbox
          checked={quiet.enabled}
          onChange={(e) => setQuiet({ ...quiet, enabled: e.target.checked })}
          label="Hold notifications overnight"
        />
        {quiet.enabled && (
          <div className="mt-3 grid gap-x-6 md:grid-cols-2">
            <Input
              label="From"
              type="time"
              value={toTime(quiet.fromMinutes)}
              onChange={(e) =>
                setQuiet({ ...quiet, fromMinutes: toMinutes(e.target.value) })
              }
            />
            <Input
              label="Until"
              type="time"
              value={toTime(quiet.toMinutes)}
              onChange={(e) =>
                setQuiet({ ...quiet, toMinutes: toMinutes(e.target.value) })
              }
            />
          </div>
        )}
        <p className="mt-2 text-caption text-text-secondary">
          Urgent task changes are still delivered.
        </p>

        <div className="mt-4">
          <Button
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await saveNotificationSettingsAction({
                  matrix,
                  quietHours: quiet,
                });
                if (result.ok) {
                  show({ variant: "success", message: result.message });
                  router.refresh();
                } else {
                  show({ variant: "error", message: result.error });
                }
              })
            }
          >
            Save changes
          </Button>
        </div>
      </Card>
    </>
  );
}

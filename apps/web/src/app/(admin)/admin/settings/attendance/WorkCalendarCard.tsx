"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { saveWorkCalendarAction } from "@/lib/policies/actions";
import {
  describeWeekdays,
  isDateKey,
  WEEKDAYS,
  type Holiday,
} from "@/lib/attendance/calendar";

/**
 * Weekly offs and holidays. Both are paid days off: they never count as
 * absent, and coming in on one is never late. Changes are kept on the page
 * until "Save changes", like the other policy cards, so one save makes one
 * version.
 */
export function WorkCalendarCard({
  weeklyOffDays,
  holidays,
  version,
  peopleWithOwnWeeklyOff,
  today,
}: {
  weeklyOffDays: number[];
  holidays: Holiday[];
  version: number;
  peopleWithOwnWeeklyOff: number;
  /** "YYYY-MM-DD" in the company's timezone, to grey out past holidays. */
  today: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [offDays, setOffDays] = useState<number[]>(weeklyOffDays);
  const [list, setList] = useState<Holiday[]>(holidays);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const allOff = offDays.length >= 7;

  function toggleDay(day: number, on: boolean) {
    setOffDays((current) =>
      on ? [...new Set([...current, day])].sort() : current.filter((d) => d !== day),
    );
  }

  function addHoliday() {
    setAddError(null);
    if (!isDateKey(newDate)) {
      setAddError("Choose the date.");
      return;
    }
    if (!newName.trim()) {
      setAddError("Name the holiday, e.g. Diwali.");
      return;
    }
    if (list.some((h) => h.date === newDate)) {
      setAddError("That date is already a holiday.");
      return;
    }
    setList((current) =>
      [...current, { date: newDate, name: newName.trim() }].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    );
    setNewDate("");
    setNewName("");
  }

  function save() {
    startTransition(async () => {
      const result = await saveWorkCalendarAction({
        weeklyOffDays: offDays,
        holidays: list,
      });
      if (result.ok) {
        show({
          variant: "success",
          message: result.detail ? `${result.message} ${result.detail}` : result.message,
        });
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Working days & holidays"
        meta={`Version ${version}`}
      />
      <p className="text-secondary text-text-secondary">
        Weekly offs and holidays are paid days off. They never count as absent,
        and anyone who comes in on one is never marked late.
      </p>

      <fieldset className="mt-4">
        <legend className="text-label text-text-primary">Weekly off</legend>
        {/* Sized by the card, not the screen: "Wednesday" must never
            spill past the edge on a narrow card. */}
        <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-4">
          {WEEKDAYS.map((name, day) => (
            <Checkbox
              key={name}
              label={name}
              checked={offDays.includes(day)}
              onChange={(e) => toggleDay(day, e.target.checked)}
            />
          ))}
        </div>
        <p className="mt-1 text-caption text-text-secondary">
          {allOff
            ? "Leave at least one working day in the week."
            : `${offDays.length === 0 ? "No weekly off" : `${describeWeekdays(offDays)} off`} for everyone${
                peopleWithOwnWeeklyOff > 0
                  ? `, except ${peopleWithOwnWeeklyOff} ${peopleWithOwnWeeklyOff === 1 ? "person who has" : "people who have"} their own weekly off on their employee record.`
                  : ". A person can have a different off day — set it on their employee record."
              }`}
        </p>
      </fieldset>

      <div className="mt-5">
        <p className="text-label text-text-primary">Holidays</p>
        {list.length === 0 ? (
          <p className="mt-1 text-secondary text-text-secondary">
            No holidays yet. Add the days your company closes — national
            holidays, festivals, local days.
          </p>
        ) : (
          <ul className="mt-1 flex flex-col">
            {list.map((holiday) => {
              const past = holiday.date < today;
              return (
                <li
                  key={holiday.date}
                  className="flex items-center justify-between gap-3 border-b border-border-subtle py-2 last:border-0"
                >
                  <span className={past ? "text-text-tertiary" : "text-text-primary"}>
                    <span className="font-mono text-data tabular-nums">
                      {formatHolidayDate(holiday.date)}
                    </span>
                    <span className="ms-3 text-body">{holiday.name}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="tertiary"
                    aria-label={`Remove ${holiday.name}`}
                    leadingIcon={<X aria-hidden="true" />}
                    onClick={() =>
                      setList((current) => current.filter((h) => h.date !== holiday.date))
                    }
                  >
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 grid gap-x-3 lg:grid-cols-[12rem_1fr_auto] lg:items-start">
          <Input
            label="Date"
            type="date"
            value={newDate}
            onChange={(e) => {
              setNewDate(e.target.value);
              setAddError(null);
            }}
          />
          <Input
            label="Holiday name"
            placeholder="Diwali"
            error={addError ?? undefined}
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setAddError(null);
            }}
          />
          <div className="lg:pt-7">
            <Button variant="outline" onClick={addHoliday}>
              Add holiday
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Button
          loading={pending}
          disabled={allOff}
          disabledReason={allOff ? "Leave at least one working day in the week." : undefined}
          onClick={save}
        >
          Save changes
        </Button>
      </div>
    </Card>
  );
}

/** "Fri, 2 Oct 2026" from "2026-10-02", without timezone drift. */
function formatHolidayDate(key: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}T00:00:00.000Z`));
}

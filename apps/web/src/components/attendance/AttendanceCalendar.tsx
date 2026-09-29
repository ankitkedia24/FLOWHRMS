"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { StatusChip } from "@/components/ui/StatusChip";
import { cn } from "@/lib/cn";
import type { Status } from "@/lib/status";

/**
 * Attendance calendar (screen E8, component-specifications.md §6).
 *
 * - A real `role="grid"` with arrow / Home / End / PageUp / PageDown keys.
 * - Every day's accessible name carries the DATE AND ITS STATUS
 *   ("7 August 2026, Present") — status is never colour alone.
 * - Week starts Monday; Indian date order throughout.
 * - One status dot per day; the day panel below shows the detail.
 */
export interface CalendarDay {
  /** YYYY-MM-DD, tenant-local. */
  date: string;
  status: Status | null;
  detail?: string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const dotTone: Record<Status["tone"], string> = {
  success: "bg-status-success-fg",
  warning: "bg-status-warning-fg",
  error: "bg-status-error-fg",
  info: "bg-status-info-fg",
  neutral: "bg-status-neutral-fg",
};

function parse(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function AttendanceCalendar({
  month,
  days,
}: {
  /** First day of the month shown, YYYY-MM-DD. */
  month: string;
  days: CalendarDay[];
}) {
  const byDate = useMemo(
    () => new Map(days.map((day) => [day.date, day])),
    [days],
  );

  const monthStart = parse(month);
  const year = monthStart.getUTCFullYear();
  const monthIndex = monthStart.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  // Monday-first offset for the 1st of the month.
  const firstWeekday = (monthStart.getUTCDay() + 6) % 7;

  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState<string>(toKey(monthStart));
  const gridRef = useRef<HTMLDivElement>(null);

  const cells: Array<string | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toKey(new Date(Date.UTC(year, monthIndex, i + 1))),
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthStart);

  function move(from: string, delta: number) {
    const next = addDays(parse(from), delta);
    if (next.getUTCMonth() !== monthIndex || next.getUTCFullYear() !== year) {
      return; // stay inside the month shown
    }
    const key = toKey(next);
    setFocused(key);
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${key}"]`)
        ?.focus();
    });
  }

  function onKeyDown(event: React.KeyboardEvent, date: string) {
    const keys: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      PageUp: -28,
      PageDown: 28,
    };
    if (event.key in keys) {
      event.preventDefault();
      move(date, keys[event.key]);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      move(date, 1 - parse(date).getUTCDate());
    }
    if (event.key === "End") {
      event.preventDefault();
      move(date, daysInMonth - parse(date).getUTCDate());
    }
  }

  const selectedDay = selected ? byDate.get(selected) : null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-heading text-h2 text-text-primary">{monthLabel}</h2>
        <div className="flex gap-1">
          <IconButton label="Previous month" disabled>
            <ChevronLeft />
          </IconButton>
          <IconButton label="Next month" disabled>
            <ChevronRight />
          </IconButton>
        </div>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={`Attendance for ${monthLabel}`}
        className="rounded-surface-card border border-border-default bg-surface-default p-3"
      >
        <div role="row" className="grid grid-cols-7">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              role="columnheader"
              aria-label={day}
              className="micro-label pb-2 text-center text-text-tertiary"
            >
              {day}
            </div>
          ))}
        </div>

        {Array.from({ length: cells.length / 7 }, (_, week) => (
          <div role="row" key={week} className="grid grid-cols-7">
            {cells.slice(week * 7, week * 7 + 7).map((date, index) => {
              if (!date) {
                return (
                  <div
                    role="gridcell"
                    key={`empty-${week}-${index}`}
                    aria-hidden="true"
                    className="aspect-square"
                  />
                );
              }
              const day = byDate.get(date);
              const dayNumber = parse(date).getUTCDate();
              const longDate = new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(parse(date));

              return (
                <div role="gridcell" key={date} className="p-0.5">
                  <button
                    type="button"
                    data-date={date}
                    tabIndex={focused === date ? 0 : -1}
                    onKeyDown={(e) => onKeyDown(e, date)}
                    onFocus={() => setFocused(date)}
                    onClick={() => setSelected(date)}
                    // Date AND status — never colour alone.
                    aria-label={
                      day?.status
                        ? `${longDate}, ${day.status.label}`
                        : `${longDate}, no record`
                    }
                    aria-pressed={selected === date}
                    className={cn(
                      "flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-md",
                      "text-body text-text-primary",
                      "hover:bg-surface-sunken",
                      selected === date &&
                        "bg-brand-primary-subtle ring-2 ring-brand-primary",
                    )}
                  >
                    <span className="font-mono tabular-nums">{dayNumber}</span>
                    {day?.status ? (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-1.5 rounded-pill",
                          dotTone[day.status.tone],
                        )}
                      />
                    ) : (
                      <span aria-hidden="true" className="size-1.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Day detail — the dot is never the only carrier of meaning. */}
      <div className="mt-3" role="status">
        {selectedDay ? (
          <div className="rounded-surface-card border border-border-default bg-surface-default p-4">
            <p className="text-label text-text-primary">
              {new Intl.DateTimeFormat("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              }).format(parse(selectedDay.date))}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {selectedDay.status ? (
                <StatusChip status={selectedDay.status} size="sm" />
              ) : (
                <p className="text-secondary text-text-secondary">
                  Nothing recorded for this day.
                </p>
              )}
            </div>
            {selectedDay.detail && (
              <p className="mt-2 font-mono text-data text-text-secondary tabular-nums">
                {selectedDay.detail}
              </p>
            )}
          </div>
        ) : (
          <p className="text-caption text-text-secondary">
            Choose a day to see what was recorded.
          </p>
        )}
      </div>
    </div>
  );
}

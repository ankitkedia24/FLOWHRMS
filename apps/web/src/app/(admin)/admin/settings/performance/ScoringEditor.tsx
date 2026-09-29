"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { publishScoringAction } from "@/lib/performance/actions";
import {
  RULE_KEYS,
  RULE_LABELS,
  type RuleKey,
  type ScoringPolicy,
} from "@/lib/performance/scoring";

/**
 * Every rule: one switch, one value. Companies differ; the module bends
 * (owner requirement, PERFORMANCE-MODULE.md §1.3).
 */

const RULE_HELP: Record<RuleKey, string> = {
  on_time: "Checked in within the grace period.",
  full_day: "Both check-in and check-out recorded.",
  early_bird: "Checked in well before the shift starts.",
  task_completed: "Any task finished.",
  task_on_time: "Finished on or before the due date.",
  task_early: "Finished well ahead of the due date.",
  task_priority: "A high-priority task finished.",
  proof_accepted: "Required proof accepted by the reviewer.",
  proof_first_time: "Accepted without details being requested.",
  first_task_before_noon: "The day's first task, done before noon.",
  perfect_week: "On time on enough days of one week.",
  streak_7: "Seven consecutive on-time days.",
  streak_30: "Thirty consecutive on-time days.",
  streak_100: "A hundred consecutive on-time days.",
  comeback: "Back on track after a broken streak.",
  perfect_month: "Every worked day of a month on time.",
  clean_month: "A month with no location exceptions.",
  month_tasks_10: "Ten tasks completed inside one month.",
  month_tasks_25: "Twenty-five tasks inside one month.",
  month_tasks_50: "Fifty tasks inside one month.",
  team_day: "The whole department on time the same day.",
  planned_leave: "Leave requested well ahead, then approved.",
  onboarding_complete: "Documents verified and profile filled in.",
  work_anniversary: "Each completed year of service.",
  weekly_quest: "This week's rotating goal, finished.",
};

const GROUPS: Array<{ title: string; keys: RuleKey[] }> = [
  {
    title: "Attendance",
    keys: ["on_time", "full_day", "early_bird"],
  },
  {
    title: "Consistency",
    keys: ["perfect_week", "streak_7", "streak_30", "streak_100", "comeback"],
  },
  {
    title: "Tasks",
    keys: [
      "task_completed",
      "task_on_time",
      "task_early",
      "task_priority",
      "proof_accepted",
      "proof_first_time",
      "first_task_before_noon",
    ],
  },
  {
    title: "Month awards",
    keys: [
      "perfect_month",
      "clean_month",
      "month_tasks_10",
      "month_tasks_25",
      "month_tasks_50",
      "team_day",
    ],
  },
  {
    title: "Milestones in the job",
    keys: ["planned_leave", "onboarding_complete", "work_anniversary", "weekly_quest"],
  },
];

export function ScoringEditor({
  initial,
  published,
}: {
  initial: ScoringPolicy;
  published: boolean;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [rules, setRules] = useState(initial.rules);
  const [thresholds, setThresholds] = useState({
    earlyBirdMinutes: String(initial.earlyBirdMinutes),
    taskEarlyHours: String(initial.taskEarlyHours),
    perfectWeekDays: String(initial.perfectWeekDays),
    comebackRunLength: String(initial.comebackRunLength),
    dailyTaskCap: String(initial.dailyTaskCap),
    monthMinDays: String(initial.monthMinDays),
    plannedLeaveDays: String(initial.plannedLeaveDays),
  });
  const [levelNames, setLevelNames] = useState<string[]>([...initial.levelNames]);

  function setRule(key: RuleKey, patch: Partial<{ enabled: boolean; points: number }>) {
    setRules((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function publish() {
    startTransition(async () => {
      const result = await publishScoringAction({
        rules,
        earlyBirdMinutes: Number(thresholds.earlyBirdMinutes),
        taskEarlyHours: Number(thresholds.taskEarlyHours),
        perfectWeekDays: Number(thresholds.perfectWeekDays),
        comebackRunLength: Number(thresholds.comebackRunLength),
        dailyTaskCap: Number(thresholds.dailyTaskCap),
        monthMinDays: Number(thresholds.monthMinDays),
        plannedLeaveDays: Number(thresholds.plannedLeaveDays),
        levelNames,
      });
      if (result.ok) {
        show({ variant: "success", message: result.message });
        router.refresh();
      } else {
        show({ variant: "error", message: result.error });
      }
    });
  }

  const enabledCount = RULE_KEYS.filter((k) => rules[k].enabled).length;

  return (
    <div className="flex flex-col gap-4">
      {GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader title={group.title} />
          <ul className="flex flex-col divide-y divide-border-subtle">
            {group.keys.map((key) => (
              <li
                key={key}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <Checkbox
                    checked={rules[key].enabled}
                    onChange={(e) => setRule(key, { enabled: e.target.checked })}
                    label={RULE_LABELS[key]}
                    helper={RULE_HELP[key]}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-caption text-text-secondary">+</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={10000}
                    aria-label={`Points for ${RULE_LABELS[key]}`}
                    disabled={!rules[key].enabled}
                    value={rules[key].points}
                    onChange={(e) =>
                      setRule(key, { points: Number(e.target.value || 0) })
                    }
                    className="h-11 w-24 rounded-input border-[1.5px] border-border-default bg-surface-default px-3 text-right font-mono text-data text-text-primary tabular-nums hover:border-border-strong disabled:opacity-40"
                  />
                  <span className="w-10 text-caption text-text-secondary">pts</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <Card>
        <CardHeader
          title="Thresholds"
          meta="The knobs behind the rules above."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Early bird — minutes before shift"
            type="number"
            inputMode="numeric"
            value={thresholds.earlyBirdMinutes}
            onChange={(e) =>
              setThresholds((p) => ({ ...p, earlyBirdMinutes: e.target.value }))
            }
          />
          <Input
            label="Well ahead — hours before due"
            type="number"
            inputMode="numeric"
            helper="Measured in whole days on the ledger."
            value={thresholds.taskEarlyHours}
            onChange={(e) =>
              setThresholds((p) => ({ ...p, taskEarlyHours: e.target.value }))
            }
          />
          <Input
            label="Perfect week — on-time days needed"
            type="number"
            inputMode="numeric"
            value={thresholds.perfectWeekDays}
            onChange={(e) =>
              setThresholds((p) => ({ ...p, perfectWeekDays: e.target.value }))
            }
          />
          <Input
            label="Comeback — days back on track"
            type="number"
            inputMode="numeric"
            value={thresholds.comebackRunLength}
            onChange={(e) =>
              setThresholds((p) => ({ ...p, comebackRunLength: e.target.value }))
            }
          />
          <Input
            label="Daily task-points cap"
            type="number"
            inputMode="numeric"
            helper="0 = no cap. Stops point farming via micro-tasks."
            value={thresholds.dailyTaskCap}
            onChange={(e) =>
              setThresholds((p) => ({ ...p, dailyTaskCap: e.target.value }))
            }
          />
          <Input
            label="Month awards — worked days needed"
            type="number"
            inputMode="numeric"
            helper="Stops one worked day from being a perfect month."
            value={thresholds.monthMinDays}
            onChange={(e) =>
              setThresholds((p) => ({ ...p, monthMinDays: e.target.value }))
            }
          />
          <Input
            label="Planned leave — days requested ahead"
            type="number"
            inputMode="numeric"
            value={thresholds.plannedLeaveDays}
            onChange={(e) =>
              setThresholds((p) => ({ ...p, plannedLeaveDays: e.target.value }))
            }
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Level names"
          meta="Lifetime points climb through five levels. The thresholds are fixed; the words are yours."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {levelNames.map((name, i) => (
            <Input
              key={i}
              label={`Level ${i + 1}`}
              value={name}
              onChange={(e) =>
                setLevelNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))
              }
            />
          ))}
        </div>
      </Card>

      <div>
        <Button
          size="lg"
          loading={pending}
          disabled={enabledCount === 0}
          disabledReason={
            enabledCount === 0
              ? "Enable at least one rule — a scoreboard where nothing scores isn't one."
              : undefined
          }
          onClick={publish}
        >
          {published ? "Publish new version" : "Publish and start counting"}
        </Button>
        <p className="mt-2 text-caption text-text-secondary">
          Publishing is recorded in the activity log. Employees see exactly
          these rules under &quot;How points work&quot;.
        </p>
      </div>
    </div>
  );
}

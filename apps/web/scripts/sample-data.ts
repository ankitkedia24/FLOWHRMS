/**
 * A whole working company, invented from nothing, so every screen in FlowHRMS
 * can be seen with something real-shaped in it.
 *
 * This creates its OWN tenant — "Sunrise Traders (sample)" — and touches
 * nothing else. No real customer's data is read or written, and the people
 * in it are invented (product rule: placeholder seed data only, never a
 * real company or employee).
 *
 * The company is created through the SAME provisioning path the product
 * uses, and its points are awarded by the SAME scoring engine the live
 * check-in and task actions use. So what you see is what a customer gets,
 * not a fixture arranged to flatter the app.
 *
 * What it deliberately does NOT do is write a payroll run. Salary
 * structures and attendance are payroll's INPUTS; the figures are the
 * engine's job, computed when the Payroll screen is opened. Writing
 * numbers here would be inventing payroll, which this product does not do.
 *
 * Usage (npm, not npx — see scripts/tsconfig.json for why):
 *   npm run sample-data                        create it
 *   npm run sample-data -- --clear             remove it entirely
 *   npm run sample-data -- --days 45           more history
 *   npm run sample-data -- --origin http://localhost:3000
 *
 * Re-running replaces it: the old sample tenant is purged first, so this
 * is safe to run repeatedly and never accumulates duplicates.
 */
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });

// Thousands of rows go in here, so prefer the direct connection over the
// transaction pooler. Set before the client is built: getDb() reads
// DATABASE_URL once and caches the client.
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { getDb } from "../src/lib/db";
import { raiseActionRequest } from "../src/lib/actions/service";
import { provisionTenant } from "../src/lib/platform/provision";
import { purgeTenant } from "../src/lib/platform/purge";
import { setPolicy } from "../src/lib/policies";
import { workDateInTimezone } from "../src/lib/attendance/policy";
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiryFrom,
  inviteUrl,
} from "../src/lib/invites/token";
import {
  DEFAULT_SCORING,
  applyDailyTaskCap,
  checkInAwards,
  checkOutAwards,
  currentStreak,
  hasBrokenRun,
  proofAwards,
  taskAwards,
  weekKey,
  type Award,
  type DayStanding,
} from "../src/lib/performance/scoring";

/** The one slug this script is ever allowed to write to or delete. */
const SLUG = "sunrise-traders-sample";
const NAME = "Sunrise Traders (sample)";
const OWNER_NAME = "Sunita Rao";
const EMAIL_DOMAIN = "sunrise-sample.example";
const OWNER_EMAIL = `sunita.rao@${EMAIL_DOMAIN}`;
const TZ = "Asia/Kolkata";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(`--${flag}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const clearOnly = process.argv.includes("--clear");
const ORIGIN =
  arg("origin") ??
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

/** Deterministic PRNG — the same command twice invents the same company. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}
const rand = makeRandom(20260819);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const chance = (p: number) => rand() < p;

// ---------------------------------------------------------------- the cast

const BRANCHES = [
  { name: "Bhiwandi Warehouse", address: "Plot 14, MIDC, Bhiwandi", lat: 19.2967, lng: 73.0631, radiusM: 300 },
  { name: "Andheri Shop", address: "Shop 3, Link Road, Andheri West, Mumbai", lat: 19.1364, lng: 72.8296, radiusM: 120 },
  { name: "Thane Counter", address: "Ghodbunder Road, Thane West", lat: 19.2183, lng: 72.9781, radiusM: 150 },
];

const SHIFTS = [
  { name: "General 9:30–6:30", startMinutes: 9 * 60 + 30, endMinutes: 18 * 60 + 30, graceMinutes: 10, isDefault: true },
  { name: "Early 7:00–4:00", startMinutes: 7 * 60, endMinutes: 16 * 60, graceMinutes: 10, isDefault: false },
  { name: "Late 12:00–9:00", startMinutes: 12 * 60, endMinutes: 21 * 60, graceMinutes: 15, isDefault: false },
];

const DEPARTMENTS = ["Warehouse", "Sales", "Delivery", "Accounts"];

/** Invented people. Any resemblance to a real person is coincidence. */
const PEOPLE = [
  "Rajesh Kulkarni", "Priya Deshmukh", "Amit Sharma", "Sneha Patil",
  "Vikram Joshi", "Anjali Nair", "Suresh Pawar", "Meera Iyer",
  "Karan Mehta", "Divya Rao", "Nikhil Bhosale", "Pooja Shetty",
  "Rohit Gaikwad", "Kavita Menon", "Sandeep More", "Rekha Kadam",
  "Arjun Salunkhe", "Nisha Kulkarni", "Manish Jadhav", "Swati Bhat",
  "Deepak Chavan", "Asha Naik", "Ganesh Sawant", "Neha Kamble",
  "Prakash Rane", "Sunita Wagh", "Ravi Thakur", "Shalini Dubey",
  "Yogesh Patil", "Madhuri Shinde", "Ajay Borkar", "Trupti Mane",
  "Harish Lokhande", "Vaishali Kale", "Sachin Dalvi",
];

const DESIGNATIONS: Record<string, string[]> = {
  Warehouse: ["Warehouse Supervisor", "Stock Assistant", "Loader", "Inventory Clerk"],
  Sales: ["Sales Executive", "Counter Sales", "Field Sales", "Sales Assistant"],
  Delivery: ["Delivery Rider", "Route Driver", "Dispatch Assistant"],
  Accounts: ["Accounts Assistant", "Billing Clerk", "Cashier"],
};

const HEAD_DESIGNATION: Record<string, string> = {
  Warehouse: "Warehouse Manager",
  Sales: "Sales Manager",
  Delivery: "Dispatch Head",
  Accounts: "Accounts Head",
};

const TASK_TITLES = [
  "Count stock in aisle {n}", "Deliver order #{n}", "Call back customer about order #{n}",
  "Restock the counter display", "Verify GRN for consignment {n}", "Prepare the dispatch list",
  "Collect payment for order #{n}", "Update the price board", "Clean and arrange rack {n}",
  "Reconcile cash for the day", "Photograph damaged goods in order #{n}",
  "Follow up pending indent {n}", "Load the van for the Thane route", "Check expiry on shelf {n}",
  "Return unsold stock to the warehouse", "Match supplier bill {n} with the challan",
];

const LEAVE_REASONS = [
  "Family function at my home town.", "Medical check-up in the morning.",
  "Child's school event.", "Personal work at the bank.", "Not well since last night.",
];

const OUTSIDE_REASONS = [
  "Customer visit at Kalyan.", "Delivery run — started from the customer's godown.",
  "Working from home today, cleared with the manager.", "Collecting payment at Vashi.",
];

// ------------------------------------------------------------------ helpers

const DAY_MS = 86_400_000;
/** Today in the tenant's timezone, as a UTC date-only value. */
const TODAY = workDateInTimezone(new Date(), TZ);
/** The date-only value `back` days before today. */
const dayAgo = (back: number): Date => new Date(TODAY.getTime() - back * DAY_MS);
/** A moment on `date` at the given tenant-local minute of the day. */
const atMinute = (date: Date, minute: number): Date =>
  new Date(date.getTime() + (minute - 330) * 60_000); // IST is UTC+5:30
const dateKey = (d: Date): string => d.toISOString().slice(0, 10);
const isSunday = (d: Date) => d.getUTCDay() === 0;

/**
 * How far back the history runs. By default: to the first day of LAST
 * month, so there is always one COMPLETE calendar month on record.
 *
 * That matters for payroll. A month still in progress prorates everyone
 * down, because days not yet worked are not payable days — correct, but it
 * makes the sample look like everybody is on half pay. With a whole month
 * behind it, the Payroll screen has a period it can show in full.
 */
const DEFAULT_HISTORY_DAYS = Math.round(
  (TODAY.getTime() -
    Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - 1, 1)) /
    DAY_MS,
);
const HISTORY_DAYS = Number(arg("days") ?? DEFAULT_HISTORY_DAYS);

async function main() {
  const db = getDb();

  // Everything below is scoped to one tenant, found by this one slug.
  const existing = await db.tenant.findUnique({ where: { slug: SLUG } });
  if (existing) {
    process.stdout.write(`Removing the previous ${existing.name}… `);
    const removed = await purgeTenant(db, existing.id);
    console.log(`done (${removed.memberships} people).`);
  } else if (clearOnly) {
    console.log("Nothing to clear — the sample company does not exist.");
    return;
  }
  if (clearOnly) return;

  // ------------------------------------------------------- the company
  console.log(`Creating ${NAME}…`);
  const provisioned = await provisionTenant(db, {
    name: NAME,
    ownerName: OWNER_NAME,
    ownerEmail: OWNER_EMAIL,
    slug: SLUG,
    timezone: TZ,
    origin: ORIGIN,
    actor: { type: "SYSTEM", via: "scripts/sample-data.ts" },
  });
  if (!provisioned.ok) throw new Error(provisioned.error);
  const tenantId = provisioned.tenantId;

  // Turn every module on, so nothing in the sample hides behind a flag.
  const modules = await db.module.findMany();
  await db.tenantModuleSetting.updateMany({
    where: { tenantId, moduleId: { in: modules.map((m) => m.id) } },
    data: { enabled: true },
  });

  const roles = await db.role.findMany({ where: { tenantId } });
  const roleIdByKey = new Map(roles.map((r) => [r.key, r.id]));
  const employeeRoleId = roleIdByKey.get("EMPLOYEE")!;
  const headRoleId =
    roleIdByKey.get("MANAGER") ?? roleIdByKey.get("TEAM_LEADER") ?? employeeRoleId;

  // ------------------------------------------------- branches and shifts
  // Coordinates are nullable in the schema — a branch may not have one yet —
  // but these are written from the literals above, so carry them non-null
  // rather than asserting later at every use.
  const branches: Array<{ id: string; lat: number; lng: number }> = [];
  for (const b of BRANCHES) {
    const row = await db.branch.create({ data: { tenantId, ...b } });
    branches.push({ id: row.id, lat: b.lat, lng: b.lng });
  }
  const shifts = [];
  for (const s of SHIFTS) shifts.push(await db.shift.create({ data: { tenantId, ...s } }));

  const departments = [];
  for (const name of DEPARTMENTS) {
    departments.push(await db.department.create({ data: { tenantId, name } }));
  }

  // ---------------------------------------------------------- the people
  const owner = await db.tenantMembership.findFirstOrThrow({ where: { tenantId } });
  await db.tenantMembership.update({
    where: { id: owner.id },
    data: {
      designation: "Proprietor",
      employeeCode: "EMP-001",
      branchId: branches[0].id,
      shiftId: shifts[0].id,
      joinedOn: dayAgo(1_200),
      // ACTIVE so the dev preview session can resolve this owner. The
      // invite still works: acceptance re-affirms ACTIVE and sets the
      // password, it does not require INVITED.
      status: "ACTIVE",
    },
  });
  await db.user.update({
    where: { id: owner.userId },
    data: { status: "ACTIVE" },
  });

  interface Member {
    id: string;
    userId: string;
    name: string;
    email: string;
    department: string;
    branchId: string;
    shiftIndex: number;
    /** 0–1: how reliably this person turns up on time. Drives the history. */
    reliability: number;
    isHead: boolean;
  }
  const members: Member[] = [];

  for (const [index, fullName] of PEOPLE.entries()) {
    const department = DEPARTMENTS[index % DEPARTMENTS.length];
    const dept = departments[index % DEPARTMENTS.length];
    const isHead = index < DEPARTMENTS.length; // first person in each is its head
    const shiftIndex =
      department === "Delivery" ? 1 : department === "Sales" && chance(0.4) ? 2 : 0;
    const branch = department === "Warehouse" ? branches[0] : pick(branches);
    const email = `${fullName.toLowerCase().replace(/\s+/g, ".")}@${EMAIL_DOMAIN}`;

    const user = await db.user.create({
      data: { email, displayName: fullName, status: "ACTIVE" },
    });
    const membership = await db.tenantMembership.create({
      data: {
        tenantId,
        userId: user.id,
        roleId: isHead ? headRoleId : employeeRoleId,
        status: "ACTIVE",
        employeeCode: `EMP-${String(index + 2).padStart(3, "0")}`,
        branchId: branch.id,
        shiftId: shifts[shiftIndex].id,
        departmentId: dept.id,
        designation: isHead ? HEAD_DESIGNATION[department] : pick(DESIGNATIONS[department]),
        joinedOn: dayAgo(HISTORY_DAYS + 30 + Math.floor(rand() * 800)),
        employmentType: chance(0.12) ? "PART_TIME" : "FULL_TIME",
        canCheckInAtAnyBranch: department === "Delivery",
      },
    });

    members.push({
      id: membership.id,
      userId: user.id,
      name: fullName,
      email,
      department,
      branchId: branch.id,
      shiftIndex,
      // A spread of characters: a few stars, most solid, a couple struggling.
      reliability: index < 3 ? 0.98 : index < 10 ? 0.92 : chance(0.2) ? 0.62 : 0.82,
      isHead,
    });
  }

  // Heads of department; everyone reports to their head, heads to the owner.
  for (const [i, dept] of departments.entries()) {
    const head = members[i];
    await db.department.update({ where: { id: dept.id }, data: { headId: head.id } });
    await db.tenantMembership.updateMany({
      where: { tenantId, departmentId: dept.id, id: { not: head.id } },
      data: { reportingToId: head.id },
    });
    await db.tenantMembership.update({
      where: { id: head.id },
      data: { reportingToId: owner.id },
    });
  }
  console.log(
    `  ${members.length + 1} people · ${departments.length} departments (each with a head) · ` +
      `${branches.length} branches · ${shifts.length} shifts`,
  );

  // ------------------------------------------------------------- salaries
  // One fixed monthly earning — the simple pay mode the Salaries screen
  // uses. Illustrative figures; a real tenant sets their own.
  const component = await db.salaryComponent.create({
    data: {
      tenantId,
      key: "monthly_salary",
      name: "Monthly salary",
      kind: "EARNING",
      calculation: "FIXED",
      prorated: true,
      isStatutory: false,
      sortOrder: 10,
    },
  });
  const effectiveFrom = new Date(
    Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - 2, 1),
  );
  for (const m of members) {
    const amount =
      m.isHead ? 34_000 + Math.floor(rand() * 8) * 1_000
      : m.department === "Accounts" ? 22_000 + Math.floor(rand() * 6) * 1_000
      : 16_000 + Math.floor(rand() * 8) * 1_000;
    await db.salaryStructure.create({
      data: {
        tenantId,
        membershipId: m.id,
        effectiveFrom,
        baseAmount: amount,
        lines: { create: [{ componentId: component.id, amount, percent: 0 }] },
      },
    });
  }
  console.log(`  ${members.length} salaries set (simple monthly pay)`);

  // -------------------------------------------------- publish the scoring
  // Points only count once a definition exists, so publish before writing
  // the history — exactly the order a real company would follow.
  await setPolicy(tenantId, "performance", DEFAULT_SCORING, owner.userId);
  const policy = DEFAULT_SCORING;

  // --------------------------------------------------------------- leave
  // Written before attendance, because approved leave changes what an
  // absence MEANS: it pauses a streak instead of breaking it.
  const leaveDays = new Map<string, Set<string>>();
  const leaveRows = [];
  /** Leave still waiting on somebody — the approval screen needs content. */
  const pendingLeave: Array<{ id: string; member: Member; dates: string }> = [];

  for (const m of members) {
    if (!chance(0.45)) continue;
    const length = chance(0.6) ? 1 : 2;
    // The first few are deliberately UNDECIDED and dated in the next days:
    // leaving that to chance produced a sample with an empty approval queue,
    // which is the one screen an owner most wants to see working.
    const stillOpen = pendingLeave.length < 4;
    const startBack = stillOpen
      ? -(1 + Math.floor(rand() * 4)) // starts tomorrow or soon after
      : 1 + Math.floor(rand() * (HISTORY_DAYS - length - 1));
    const decided = !stillOpen && startBack > 2;
    const paid = chance(0.7);
    const halfDay = length === 1 && chance(0.3);
    const startDate = dayAgo(startBack + length - 1);
    const endDate = dayAgo(startBack);

    const id = randomUUID();
    if (!decided) {
      const fmt = (d: Date) =>
        d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
      pendingLeave.push({
        id,
        member: m,
        dates:
          startDate.getTime() === endDate.getTime()
            ? fmt(startDate)
            : `${fmt(startDate)} – ${fmt(endDate)}`,
      });
    }

    leaveRows.push({
      id,
      tenantId,
      membershipId: m.id,
      type: halfDay ? ("HALF_DAY" as const) : ("FULL_DAY" as const),
      halfDayPart: halfDay ? ("FIRST_HALF" as const) : null,
      startDate,
      endDate,
      reason: pick(LEAVE_REASONS),
      unpaidDays: paid ? 0 : length,
      status: decided ? ("APPROVED" as const) : ("PENDING" as const),
      paid: decided ? paid : null,
      decidedById: decided ? owner.id : null,
      decidedAt: decided ? atMinute(endDate, 11 * 60) : null,
      decisionReason: decided
        ? paid
          ? "Approved as paid leave."
          : "Approved, but as unpaid leave."
        : null,
    });

    if (decided && !halfDay) {
      const days = new Set<string>();
      for (let d = 0; d < length; d++) days.add(dateKey(dayAgo(startBack + d)));
      leaveDays.set(m.id, days);
    }
  }
  await db.leaveRequest.createMany({ data: leaveRows });
  console.log(
    `  ${leaveRows.length} leave requests ` +
      `(${leaveRows.filter((l) => l.status === "PENDING").length} awaiting a decision)`,
  );

  // ---------------------------------------------------------- attendance
  const recordRows = [];
  const punchRows = [];
  const pointRows = [];

  // Standings per person, most recent day FIRST — the streak engine's input.
  const standings = new Map<string, DayStanding[]>(members.map((m) => [m.id, []]));
  const branchById = new Map(branches.map((b) => [b.id, b]));
  /** Exceptions nobody has ruled on yet — the review queue needs content. */
  const pendingExceptions: Array<{ id: string; member: Member; detail: string }> = [];

  let exceptions = 0;
  let openNow = 0;

  // Oldest → newest, so streaks build the way they actually would.
  for (let back = HISTORY_DAYS; back >= 0; back--) {
    const workDate = dayAgo(back);

    if (isSunday(workDate)) {
      for (const m of members) standings.get(m.id)!.unshift("leave");
      continue;
    }

    for (const m of members) {
      const standing = standings.get(m.id)!;

      if (leaveDays.get(m.id)?.has(dateKey(workDate))) {
        standing.unshift("leave"); // approved leave pauses, never breaks
        continue;
      }
      if (!chance(m.reliability + 0.05)) {
        // Absent: no record at all, which is exactly what FlowHRMS would hold.
        standing.unshift("leave");
        continue;
      }

      const shift = SHIFTS[m.shiftIndex];
      const branch = branchById.get(m.branchId)!;
      const late = !chance(m.reliability);
      const minutesEarly = late
        ? 0
        : chance(0.35)
          ? 15 + Math.floor(rand() * 25)
          : Math.floor(rand() * 12);
      const lateMinutes = late ? shift.graceMinutes + 1 + Math.floor(rand() * 40) : 0;
      const checkInMinute = shift.startMinutes - minutesEarly + lateMinutes;
      const checkInAt = atMinute(workDate, checkInMinute);

      // A few check-ins away from the branch — that IS what an exception is.
      const outside = chance(0.05);
      const reviewed = outside && back > 3; // recent ones still await review
      const approved = reviewed && chance(0.75);
      const outsideReason = outside ? pick(OUTSIDE_REASONS) : null;

      // Someone is still checked in today: the open-shift state on Home.
      const stillOpen = back === 0 && chance(0.35);
      const workedMinutes = 8 * 60 + Math.floor(rand() * 90);
      const checkOutAt = stillOpen ? null : atMinute(workDate, checkInMinute + workedMinutes);
      if (stillOpen) openNow += 1;

      const id = randomUUID();
      recordRows.push({
        id,
        tenantId,
        membershipId: m.id,
        workDate,
        checkInAt,
        checkInLat: outside ? branch.lat + 0.04 : branch.lat + (rand() - 0.5) * 0.0004,
        checkInLng: outside ? branch.lng + 0.04 : branch.lng + (rand() - 0.5) * 0.0004,
        checkInAccuracyM: 8 + Math.floor(rand() * 14),
        checkInDistanceM: outside ? 4_200 + Math.floor(rand() * 3_000) : Math.floor(rand() * 60),
        checkInOutcome: (outside ? "OUTSIDE" : "INSIDE") as "OUTSIDE" | "INSIDE",
        checkInReason: outsideReason,
        lateMinutes,
        reviewStatus: (outside
          ? reviewed
            ? approved
              ? "APPROVED"
              : "REJECTED"
            : "PENDING"
          : "NONE") as "APPROVED" | "REJECTED" | "PENDING" | "NONE",
        reviewedById: reviewed ? owner.id : null,
        reviewedAt: reviewed ? atMinute(workDate, 18 * 60) : null,
        reviewReason: reviewed
          ? approved
            ? "Confirmed with the customer."
            : "Not an agreed visit."
          : null,
        checkOutAt,
        checkOutLat: checkOutAt ? branch.lat : null,
        checkOutLng: checkOutAt ? branch.lng : null,
        checkOutOutcome: (checkOutAt ? "INSIDE" : null) as "INSIDE" | null,
        branchId: branch.id,
      });
      if (outside) exceptions += 1;
      if (outside && !reviewed) {
        pendingExceptions.push({
          id,
          member: m,
          detail: `Checked in about ${Math.round(4.2 + rand())} km away — "${outsideReason}"`,
        });
      }

      punchRows.push({
        tenantId,
        recordId: id,
        sequence: 1,
        checkInAt,
        checkInLat: branch.lat,
        checkInLng: branch.lng,
        checkInOutcome: (outside ? "OUTSIDE" : "INSIDE") as "OUTSIDE" | "INSIDE",
        checkInDistanceM: outside ? 4_200 : 40,
        checkInReason: outsideReason,
        checkOutAt,
        checkOutOutcome: (checkOutAt ? "INSIDE" : null) as "INSIDE" | null,
        branchId: branch.id,
      });

      // On time means: not late, and not sitting on an unresolved or refused
      // location exception. The same judgement the live action makes.
      const onTime = lateMinutes === 0 && (!outside || approved);
      standing.unshift(onTime ? "on_time" : "break");
      if (!onTime) continue;

      // ---- points, through the very engine the live actions use
      const prior = standing.slice(1); // index i = i+1 calendar days ago
      const thisWeek = weekKey(workDate);
      let onTimeThisWeek = 1;
      for (let i = 0; i < prior.length; i++) {
        if (weekKey(new Date(workDate.getTime() - (i + 1) * DAY_MS)) !== thisWeek) break;
        if (prior[i] === "on_time") onTimeThisWeek += 1;
      }

      const earned = checkInAwards(policy, {
        onTime: true,
        minutesBeforeShift: minutesEarly,
        isFirstPunchOfDay: true,
        streakIncludingToday: 1 + currentStreak(prior),
        hadEarlierBrokenRun: hasBrokenRun(prior, policy.comebackRunLength),
        onTimeDaysThisWeek: onTimeThisWeek,
      });
      const all = checkOutAt ? [...earned, ...checkOutAwards(policy)] : earned;

      for (const a of all) {
        pointRows.push({
          tenantId,
          membershipId: m.id,
          workDate,
          kind: a.kind,
          points: a.points,
          note: a.note,
          sourceType: "attendance_record",
          sourceId: id,
          // One award per source event; period awards keyed by their period.
          dedupeKey: a.kind === "perfect_week" ? thisWeek : id,
          policyVersion: 1,
        });
      }
    }
  }

  await db.attendanceRecord.createMany({ data: recordRows });
  await db.attendancePunch.createMany({ data: punchRows });
  console.log(
    `  ${recordRows.length} attendance days · ${exceptions} location exceptions · ` +
      `${openNow} still checked in right now`,
  );

  // --------------------------------------------------------------- tasks
  const taskRows = [];
  const proofRows = [];
  const taskPointsToday = new Map<string, number>();
  /** Proof submitted and not yet judged — the review queue needs content. */
  const pendingProofs: Array<{ id: string; member: Member; title: string }> = [];
  let completed = 0;
  let awaitingReview = 0;

  for (let i = 0; i < 55; i++) {
    const assignee = pick(members);
    const head = members.find((m) => m.isHead && m.department === assignee.department)!;
    const createdBack = 2 + Math.floor(rand() * (HISTORY_DAYS - 2));
    const dueBack = Math.max(0, createdBack - (1 + Math.floor(rand() * 5)));
    const dueDate = dayAgo(dueBack);
    const priority = chance(0.2)
      ? ("HIGH" as const)
      : chance(0.5)
        ? ("MEDIUM" as const)
        : ("LOW" as const);
    const proofRequirement = chance(0.45)
      ? chance(0.7)
        ? ("PHOTO" as const)
        : ("FILE" as const)
      : ("NONE" as const);
    const title = pick(TASK_TITLES).replace("{n}", String(1_000 + Math.floor(rand() * 8_999)));

    // Most are done; some are in flight; a few are still open past their date.
    const outcome = chance(0.68) ? "done" : chance(0.55) ? "in_progress" : "open";
    const needsReview = outcome === "done" && proofRequirement !== "NONE" && chance(0.3);
    const finishedBack = outcome === "done" ? Math.max(0, dueBack - (chance(0.35) ? 1 : 0)) : 0;
    const finishedAt =
      outcome === "done"
        ? atMinute(dayAgo(finishedBack), 10 * 60 + Math.floor(rand() * 420))
        : null;

    const id = randomUUID();
    const status =
      outcome === "open"
        ? ("NOT_STARTED" as const)
        : outcome === "in_progress"
          ? ("IN_PROGRESS" as const)
          : needsReview
            ? ("SUBMITTED_FOR_REVIEW" as const)
            : ("COMPLETED" as const);

    taskRows.push({
      id,
      tenantId,
      createdById: head.id,
      assigneeId: assignee.id,
      title,
      description: chance(0.5) ? "Check with your supervisor if anything is unclear." : null,
      priority,
      dueDate,
      proofRequirement,
      status,
      startedAt: outcome === "open" ? null : atMinute(dayAgo(createdBack), 10 * 60),
      completedAt: status === "COMPLETED" ? finishedAt : null,
      createdAt: atMinute(dayAgo(createdBack), 9 * 60 + 45),
    });
    if (status === "COMPLETED") completed += 1;
    if (status === "SUBMITTED_FOR_REVIEW") {
      awaitingReview += 1;
      pendingProofs.push({ id, member: assignee, title });
    }

    if (proofRequirement !== "NONE" && outcome === "done") {
      proofRows.push({
        tenantId,
        taskId: id,
        submittedById: assignee.id,
        note: pick([
          "Done, photo attached.",
          "Completed as asked.",
          "Handed over at the counter, signature taken.",
        ]),
        submittedAt: finishedAt ?? new Date(),
        decision: (needsReview ? "PENDING" : "APPROVED") as "PENDING" | "APPROVED",
        decidedById: needsReview ? null : head.id,
        decidedAt: needsReview ? null : finishedAt,
        decisionReason: needsReview ? null : "Looks right.",
      });
    }

    if (status !== "COMPLETED" || !finishedAt) continue;

    // Task points, capped per day exactly as the live action caps them.
    const workDate = dayAgo(finishedBack);
    const capKey = `${assignee.id}:${dateKey(workDate)}`;
    const already = taskPointsToday.get(capKey) ?? 0;
    const daysEarly = Math.round((dueDate.getTime() - workDate.getTime()) / DAY_MS);

    const awards = [
      ...taskAwards(policy, {
        onTime: daysEarly >= 0,
        // Punctuality is judged by DATE, as the live path does — an exact
        // due instant does not exist on a date-only column.
        hoursBeforeDue: daysEarly > 0 ? daysEarly * 24 : null,
        highPriority: priority === "HIGH",
        isFirstTaskBeforeNoon: false,
      }),
      ...(proofRequirement !== "NONE" ? proofAwards(policy, { firstTimeRight: true }) : []),
    ];
    const kept: Award[] = applyDailyTaskCap(policy, already, awards);
    taskPointsToday.set(capKey, already + kept.reduce((s, a) => s + a.points, 0));

    for (const a of kept) {
      pointRows.push({
        tenantId,
        membershipId: assignee.id,
        workDate,
        kind: a.kind,
        points: a.points,
        note: a.note,
        sourceType: "task",
        sourceId: id,
        dedupeKey: id,
        policyVersion: 1,
      });
    }
  }

  await db.task.createMany({ data: taskRows });
  await db.taskProof.createMany({ data: proofRows });
  console.log(
    `  ${taskRows.length} tasks · ${completed} completed · ${awaitingReview} proofs awaiting review`,
  );

  // -------------------------------------------------------------- points
  await db.performanceEvent.createMany({ data: pointRows, skipDuplicates: true });
  const total = pointRows.reduce((s, p) => s + p.points, 0);
  console.log(
    `  ${pointRows.length} point events · ${total.toLocaleString("en-IN")} points earned`,
  );

  // --------------------------------------------------------- action tiles
  // Every undecided thing gets its tile, raised through the real path — so
  // the audience is worked out the way it is in production (the person's
  // department head, plus whoever else holds the deciding permission), not
  // guessed at here.
  for (const e of pendingExceptions) {
    await raiseActionRequest({
      tenantId,
      kind: "ATTENDANCE_EXCEPTION",
      subjectType: "attendance_record",
      subjectId: e.id,
      aboutMembershipId: e.member.id,
      title: `${e.member.name} — attendance needs a decision`,
      body: e.detail,
      href: `/admin/attendance?record=${e.id}`,
      actorUserId: e.member.userId,
    });
  }
  for (const l of pendingLeave) {
    await raiseActionRequest({
      tenantId,
      kind: "LEAVE_REQUEST",
      subjectType: "leave_request",
      subjectId: l.id,
      aboutMembershipId: l.member.id,
      title: `${l.member.name} — leave request`,
      body: l.dates,
      href: `/admin/leave?request=${l.id}`,
      actorUserId: l.member.userId,
    });
  }
  for (const p of pendingProofs) {
    await raiseActionRequest({
      tenantId,
      kind: "TASK_PROOF",
      subjectType: "task_proof",
      subjectId: p.id,
      aboutMembershipId: p.member.id,
      title: `${p.member.name} — proof to review`,
      body: p.title,
      href: `/admin/tasks/${p.id}`,
      actorUserId: p.member.userId,
    });
  }
  const tiles = pendingExceptions.length + pendingLeave.length + pendingProofs.length;

  // The bell is the record that something happened; the tile is the request
  // for a decision. Both, never one standing in for the other.
  await db.notification.createMany({
    data: [
      ...pendingExceptions.slice(0, 3).map((e) => ({
        tenantId, userId: owner.userId,
        title: "Attendance needs your review",
        body: `${e.member.name} checked in outside the permitted area.`,
        href: "/admin/attendance",
      })),
      ...pendingLeave.slice(0, 3).map((l) => ({
        tenantId, userId: owner.userId,
        title: "Leave request waiting",
        body: `${l.member.name} — ${l.dates}`,
        href: "/admin/leave",
      })),
      ...pendingProofs.slice(0, 3).map((p) => ({
        tenantId, userId: owner.userId,
        title: "Proof submitted for review",
        body: p.title,
        href: "/admin/tasks",
      })),
    ],
  });
  console.log(`  ${tiles} decisions waiting (action tiles raised, bell rung)`);

  // -------------------------------------------- a way in, for both sides
  // The owner's link comes from provisioning. Add one for an employee too,
  // so the mobile side can be seen the way an employee actually sees it.
  const visitor = members.find((m) => !m.isHead && m.reliability > 0.9) ?? members[5];
  const token = generateInviteToken();
  const now = new Date();
  await db.employeeInvite.create({
    data: {
      tenantId,
      membershipId: visitor.id,
      tokenHash: hashInviteToken(token),
      channel: "EMAIL",
      status: "PENDING",
      sentToEmail: visitor.email,
      expiresAt: inviteExpiryFrom(now),
      sentAt: now,
    },
  });

  console.log(`\n${NAME} is ready — ${HISTORY_DAYS} days of history.\n`);
  console.log("Open it by accepting one of these links (each works once, for 7 days):\n");
  console.log(`  Owner — ${OWNER_NAME}, sees every admin screen:`);
  console.log(`    ${provisioned.inviteLink}\n`);
  console.log(`  Employee — ${visitor.name}, sees the mobile employee app:`);
  console.log(`    ${inviteUrl(ORIGIN, token)}\n`);
  console.log("You choose the password on that page; nobody else sees it.");
  console.log(
    "Payroll figures are computed by the engine when the Payroll screen\n" +
      "is opened — salaries and attendance are its inputs, and both are set.\n",
  );
  console.log("To remove all of it:  npm run sample-data -- --clear");
}

main()
  .catch((e) => {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`FAILED: ${message.replace(/postgres(ql)?:\/\/\S*/gi, "[redacted]")}`);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));

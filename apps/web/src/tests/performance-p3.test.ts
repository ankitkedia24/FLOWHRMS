import { describe, expect, it } from "vitest";
import {
  departmentBoard,
  mostImproved,
  neighbourhoodFor,
  previousSeasonBounds,
  questForWeek,
  questProgress,
  rankSeason,
  seasonBounds,
  seasonKey,
  QUESTS,
} from "@/lib/performance/seasons";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

const entry = (id: string, points: number, dept: string | null = null) => ({
  membershipId: id,
  name: id,
  departmentName: dept,
  points,
});

describe("ranking", () => {
  it("ties share a rank, standard competition style (1,2,2,4)", () => {
    const ranked = rankSeason([
      entry("a", 100),
      entry("b", 80),
      entry("c", 80),
      entry("d", 50),
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("equal points break ties by name only for ORDER, never for rank", () => {
    const ranked = rankSeason([entry("zed", 80), entry("amy", 80)]);
    expect(ranked[0].name).toBe("amy");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(1);
  });
});

describe("neighbourhood", () => {
  const ranked = rankSeason([
    entry("a", 500),
    entry("b", 400),
    entry("c", 300),
    entry("d", 200),
    entry("e", 100),
  ]);

  it("shows the rows either side and the gap up", () => {
    const hood = neighbourhoodFor(ranked, "c");
    expect(hood?.rows.map((r) => r.membershipId)).toEqual(["b", "c", "d"]);
    expect(hood?.pointsToNext).toBe(100);
    expect(hood?.yourRank).toBe(3);
  });

  it("the leader has nobody above and no gap", () => {
    const hood = neighbourhoodFor(ranked, "a");
    expect(hood?.pointsToNext).toBeNull();
    expect(hood?.rows[0].membershipId).toBe("a");
  });

  it("with a tie, the gap is to the nearest STRICTLY higher score", () => {
    const tied = rankSeason([entry("a", 500), entry("b", 300), entry("c", 300)]);
    const hood = neighbourhoodFor(tied, "c");
    expect(hood?.pointsToNext).toBe(200); // to a's 500, not to the equal b
  });

  it("someone not on the board gets null, not a crash", () => {
    expect(neighbourhoodFor(ranked, "ghost")).toBeNull();
  });
});

describe("most improved", () => {
  it("is judged against the person's OWN previous season", () => {
    const winner = mostImproved(
      [entry("a", 500), entry("b", 300)],
      [entry("a", 450), entry("b", 100)],
    );
    expect(winner?.membershipId).toBe("b"); // +200 beats +50
    expect(winner?.climb).toBe(200);
  });

  it("debuts are excluded — a first month is not an improvement", () => {
    const winner = mostImproved(
      [entry("new", 900), entry("old", 300)],
      [entry("old", 200)],
    );
    expect(winner?.membershipId).toBe("old");
  });

  it("no positive climb, no card", () => {
    expect(mostImproved([entry("a", 100)], [entry("a", 200)])).toBeNull();
  });
});

describe("department board", () => {
  it("ranks by AVERAGE so small teams can win", () => {
    const board = departmentBoard([
      entry("a", 300, "Big"),
      entry("b", 300, "Big"),
      entry("c", 300, "Big"),
      entry("d", 400, "Small"),
    ]);
    expect(board[0].departmentName).toBe("Small");
    expect(board[0].averagePoints).toBe(400);
    expect(board[1].averagePoints).toBe(300);
  });

  it("people without a department are left off, not lumped together", () => {
    const board = departmentBoard([entry("a", 100, null), entry("b", 50, "Ops")]);
    expect(board).toHaveLength(1);
    expect(board[0].departmentName).toBe("Ops");
  });
});

describe("quests", () => {
  it("rotate deterministically by ISO week parity", () => {
    expect(questForWeek("2026-W33")).toBe(QUESTS[1]);
    expect(questForWeek("2026-W34")).toBe(QUESTS[0]);
    expect(questForWeek("2026-W35")).toBe(QUESTS[1]);
  });

  it("progress caps at the target and flips done exactly at it", () => {
    const quest = QUESTS[0]; // 5 on-time days
    expect(
      questProgress(quest, { onTimeDaysThisWeek: 4, tasksCompletedThisWeek: 99 }).done,
    ).toBe(false);
    const done = questProgress(quest, { onTimeDaysThisWeek: 7, tasksCompletedThisWeek: 0 });
    expect(done.done).toBe(true);
    expect(done.progress).toBe(5); // capped for the progress bar
  });
});

describe("season bounds", () => {
  it("cover exactly one calendar month", () => {
    const bounds = seasonBounds(d("2026-08-22"));
    expect(bounds.start.toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(bounds.end.toISOString().slice(0, 10)).toBe("2026-08-31");
    expect(seasonKey(d("2026-08-22"))).toBe("2026-08");
  });

  it("previous season handles the January boundary", () => {
    const prev = previousSeasonBounds(d("2026-01-15"));
    expect(prev.start.toISOString().slice(0, 10)).toBe("2025-12-01");
    expect(prev.end.toISOString().slice(0, 10)).toBe("2025-12-31");
  });
});

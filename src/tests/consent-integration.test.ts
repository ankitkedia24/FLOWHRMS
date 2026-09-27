/**
 * The database itself refuses to change consent evidence.
 *
 * Everything happens inside a transaction that is always rolled back, so
 * the test leaves nothing behind — which matters here more than anywhere:
 * a consent record, once written, can never be removed.
 */
import { describe, expect, it, vi } from "vitest";
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
const HAS_DB = Boolean(process.env.DATABASE_URL);

vi.mock("server-only", () => ({}));

import { getDb } from "@/lib/db";

class Rollback extends Error {}

/** Run `body` in a transaction and always roll it back. */
async function inRolledBackTx(body: (tx: Parameters<Parameters<ReturnType<typeof getDb>["$transaction"]>[0]>[0]) => Promise<void>) {
  try {
    await getDb().$transaction(async (tx) => {
      await body(tx);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

const d = describe.skipIf(!HAS_DB);

d("consent evidence is append-only (integration)", () => {
  it("refuses to update or delete a consent record, and to change a notice's text", async () => {
    const outcomes: string[] = [];
    await inRolledBackTx(async (tx) => {
      const notice = await tx.consentNotice.create({
        data: {
          key: `test_${Date.now()}`,
          version: 1,
          title: "Test notice",
          body: "{}",
          sha256: "0".repeat(64),
        },
      });
      const record = await tx.consentRecord.create({
        data: {
          noticeId: notice.id,
          noticeKey: notice.key,
          noticeVersion: 1,
          noticeHash: notice.sha256,
          email: "integration@example.com",
          subject: "ACCOUNT_HOLDER",
          action: "GRANTED",
          purposes: [],
          method: "test",
          createdAt: new Date(),
          prevHash: "0".repeat(64),
          recordHash: `test-${Date.now()}`,
        },
      });

      for (const [label, attempt] of [
        ["update record", () => tx.$executeRawUnsafe(`UPDATE consent_records SET email = 'x@example.com' WHERE id = '${record.id}'`)],
        ["delete record", () => tx.$executeRawUnsafe(`DELETE FROM consent_records WHERE id = '${record.id}'`)],
        ["change notice text", () => tx.$executeRawUnsafe(`UPDATE consent_notices SET body = '{"x":1}' WHERE id = '${notice.id}'`)],
      ] as const) {
        // Each refusal aborts the transaction, so test them with savepoints.
        await tx.$executeRawUnsafe("SAVEPOINT attempt");
        try {
          await attempt();
          outcomes.push(`${label}: allowed`);
        } catch (e) {
          outcomes.push(`${label}: ${/append-only|cannot be changed/.test(String(e)) ? "refused" : String(e)}`);
        }
        await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT attempt");
      }

      // The legal-review flag is the one thing that may change.
      await tx.consentNotice.update({ where: { id: notice.id }, data: { legalReviewed: true } });
      outcomes.push("mark reviewed: allowed");
    });

    expect(outcomes).toEqual([
      "update record: refused",
      "delete record: refused",
      "change notice text: refused",
      "mark reviewed: allowed",
    ]);
  }, 60_000);
});

import { describe, expect, it } from "vitest";
import {
  canonicalRecord,
  choicesFor,
  consentStatus,
  GENESIS_HASH,
  recordHash,
  requiredNoticeKeys,
  sha256,
  verifyChain,
  type HashedConsentFields,
} from "@/lib/consent/chain";
import { CURRENT_DOCUMENTS, canonicalBody, type DocumentKey } from "@/lib/consent/documents";
import { DATA_REQUEST_DAYS, dataRequestDueDate, daysUntilDue } from "@/lib/consent/requests";

function fields(overrides: Partial<HashedConsentFields> = {}): HashedConsentFields {
  return {
    noticeKey: "account_holder",
    noticeVersion: 1,
    noticeHash: sha256("notice"),
    userId: "u1",
    email: "owner@example.com",
    tenantId: "t1",
    tenantName: "Amit Book Depot",
    subject: "ACCOUNT_HOLDER",
    action: "GRANTED",
    purposes: [{ key: "account_service", label: "Run my account", required: true, granted: true }],
    documents: null,
    method: "checkbox+submit:/start",
    language: "en",
    ipAddress: "203.0.113.7",
    userAgent: "Mozilla/5.0",
    createdAt: "2026-09-27T10:00:00.000Z",
    ...overrides,
  };
}

/** Build a valid chain the way appendConsents does. */
function chainOf(list: HashedConsentFields[]) {
  let prev = GENESIS_HASH;
  return list.map((f, i) => {
    const hash = recordHash(prev, f);
    const row = { ...f, seq: i + 1, prevHash: prev, recordHash: hash };
    prev = hash;
    return row;
  });
}

describe("consent record hashing", () => {
  it("is deterministic and covers every field of evidence", () => {
    const a = fields();
    expect(recordHash(GENESIS_HASH, a)).toBe(recordHash(GENESIS_HASH, fields()));
    for (const change of [
      { email: "someone@else.com" },
      { ipAddress: "198.51.100.1" },
      { createdAt: "2026-09-27T10:00:01.000Z" },
      { action: "WITHDRAWN" as const },
      { noticeHash: sha256("other notice") },
      { purposes: [{ key: "account_service", label: "Run my account", required: true, granted: false }] },
    ]) {
      expect(recordHash(GENESIS_HASH, fields(change))).not.toBe(recordHash(GENESIS_HASH, a));
    }
  });

  it("orders linked documents so key order cannot change the hash", () => {
    const x = fields({ documents: { terms: { version: 1, sha256: "a" }, privacy: { version: 1, sha256: "b" } } });
    const y = fields({ documents: { privacy: { version: 1, sha256: "b" }, terms: { version: 1, sha256: "a" } } });
    expect(canonicalRecord(x)).toBe(canonicalRecord(y));
  });
});

describe("chain verification", () => {
  const rows = chainOf([
    fields(),
    fields({ email: "b@example.com", createdAt: "2026-09-27T10:01:00.000Z" }),
    fields({ email: "c@example.com", createdAt: "2026-09-27T10:02:00.000Z" }),
  ]);

  it("accepts an untouched chain", () => {
    expect(verifyChain(rows)).toEqual({ ok: true, checked: 3 });
  });

  it("names the record whose contents were changed", () => {
    const tampered = rows.map((r) => (r.seq === 2 ? { ...r, ipAddress: "10.0.0.1" } : r));
    const result = verifyChain(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.brokenAtSeq).toBe(2);
      expect(result.reason).toMatch(/changed after it was written/);
    }
  });

  it("notices a record removed from the middle", () => {
    const result = verifyChain([rows[0], rows[2]]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.brokenAtSeq).toBe(3);
      expect(result.reason).toMatch(/removed or changed/);
    }
  });
});

describe("what counts as consent", () => {
  const account = CURRENT_DOCUMENTS.account_holder;

  it("refuses when a required box is not ticked", () => {
    const result = choicesFor(account, ["account_service"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.missing.map((p) => p.key)).toEqual(["security_legal"]);
  });

  it("records optional purposes as not granted unless ticked", () => {
    const result = choicesFor(account, ["account_service", "security_legal"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.choices.find((c) => c.key === "product_updates")?.granted).toBe(false);
    }
  });

  it("asks owners for their account notice and company terms, staff for the employee notice", () => {
    expect(requiredNoticeKeys({ isOwner: true })).toEqual(["account_holder", "customer_terms"]);
    expect(requiredNoticeKeys({ isOwner: false })).toEqual(["employee"]);
  });
});

describe("consent status", () => {
  const at = (s: string) => new Date(`2026-09-${s}T10:00:00.000Z`);
  const granted = { noticeVersion: 1, action: "GRANTED" as const, createdAt: at("01"), seq: 1, purposes: [] };

  it("is missing with no records", () => {
    expect(consentStatus([], 1)).toEqual({ state: "missing" });
  });

  it("is current after consent to the current version", () => {
    expect(consentStatus([granted], 1).state).toBe("current");
  });

  it("is outdated when a new version is published", () => {
    expect(consentStatus([granted], 2)).toEqual({ state: "outdated", version: 1 });
  });

  it("is withdrawn after a withdrawal, and current again after re-consent", () => {
    const withdrawn = { ...granted, action: "WITHDRAWN" as const, seq: 2, createdAt: at("02") };
    expect(consentStatus([granted, withdrawn], 1).state).toBe("withdrawn");
    const again = { ...granted, seq: 3, createdAt: at("03") };
    expect(consentStatus([withdrawn, again, granted], 1).state).toBe("current");
  });
});

describe("the notices themselves (DPDP Rule 3)", () => {
  const notices: DocumentKey[] = ["account_holder", "customer_terms", "employee"];

  it("each consent notice itemises data or states responsibilities, and has a required purpose", () => {
    for (const key of notices) {
      const doc = CURRENT_DOCUMENTS[key];
      expect(doc.summary.length).toBeGreaterThan(40);
      expect(doc.purposes.some((p) => p.required)).toBe(true);
      expect(new Set(doc.purposes.map((p) => p.key)).size).toBe(doc.purposes.length);
    }
    expect(CURRENT_DOCUMENTS.account_holder.sections.some((s) => s.rows && s.rows.length >= 5)).toBe(true);
    expect(CURRENT_DOCUMENTS.employee.sections.some((s) => s.rows?.some(([what]) => /location/i.test(what)))).toBe(true);
  });

  it("tells people how to withdraw, use their rights and complain to the Board", () => {
    for (const key of notices) {
      const text = canonicalBody(CURRENT_DOCUMENTS[key]);
      expect(text).toMatch(/Data Protection Board/);
      if (key !== "customer_terms") {
        expect(text).toMatch(/withdraw/i);
      }
    }
  });

  it("asks for the location consent separately, and the age confirmation", () => {
    expect(CURRENT_DOCUMENTS.employee.purposes.map((p) => p.key)).toContain("checkin_location");
    expect(CURRENT_DOCUMENTS.customer_terms.purposes.map((p) => p.key)).toContain("age_18");
  });

  it("keeps product updates optional", () => {
    const updates = CURRENT_DOCUMENTS.account_holder.purposes.find((p) => p.key === "product_updates");
    expect(updates?.required).toBe(false);
  });

  it("serialises the same way every time, so the published hash is stable", () => {
    for (const doc of Object.values(CURRENT_DOCUMENTS)) {
      expect(sha256(canonicalBody(doc))).toBe(sha256(canonicalBody(structuredClone(doc))));
    }
  });
});

describe("rights requests", () => {
  it("are due 90 days after they are made", () => {
    const from = new Date("2026-09-27T00:00:00.000Z");
    expect(DATA_REQUEST_DAYS).toBe(90);
    expect(dataRequestDueDate(from).toISOString()).toBe("2026-12-26T00:00:00.000Z");
    expect(daysUntilDue(dataRequestDueDate(from), from)).toBe(90);
  });
});

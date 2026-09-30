import { describe, expect, it } from "vitest";
import {
  documentPath,
  documentPathOk,
  proofPath,
  proofPathOk,
  receiptPath,
  receiptPathOk,
  safeFileName,
} from "@/lib/storage/paths";

/**
 * Which stored paths may be recorded and signed. Signing uses the
 * service-role key, which can read every company's files, so these rules
 * are what keep "open my file" from becoming "open anyone's".
 */
const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT = "22222222-2222-4222-8222-222222222222";
const PERSON = "33333333-3333-4333-8333-333333333333";
const OTHER_PERSON = "44444444-4444-4444-8444-444444444444";
const TASK = "55555555-5555-4555-8555-555555555555";
const OTHER_TASK = "66666666-6666-4666-8666-666666666666";
const DRAFT = "77777777-7777-4777-8777-777777777777";
const NOW = 1_759_200_000_000;

describe("safeFileName", () => {
  it("keeps plain names and replaces anything else with _", () => {
    expect(safeFileName("aadhaar card.jpg")).toBe("aadhaar_card.jpg");
    expect(safeFileName("पैन कार्ड.pdf")).toBe("_.pdf");
    expect(safeFileName("a/b\\c.png")).toBe("a_b_c.png");
  });

  it("never leaves a .. or a leading dot, and never comes back empty", () => {
    expect(safeFileName("../../etc/passwd")).toBe("_._etc_passwd");
    expect(safeFileName("bill..final.pdf")).toBe("bill.final.pdf");
    expect(safeFileName("..")).toBe("file");
    expect(safeFileName("")).toBe("file");
  });

  it("trims long names from the front so the extension survives", () => {
    const name = safeFileName(`${"x".repeat(300)}.pdf`);
    expect(name).toHaveLength(100);
    expect(name.endsWith(".pdf")).toBe(true);
  });
});

describe("employee documents", () => {
  it("accepts what the uploader builds, including awkward file names", () => {
    for (const name of ["id.jpg", "My Aadhaar (front).jpeg", "../../x.pdf", "..", `${"y".repeat(500)}.png`]) {
      const path = documentPath(TENANT, PERSON, name, NOW);
      expect(path.startsWith(`${TENANT}/${PERSON}/${NOW}-`)).toBe(true);
      expect(documentPathOk(path, TENANT, PERSON)).toBe(true);
    }
  });

  it("refuses another company's or another person's folder", () => {
    expect(documentPathOk(documentPath(OTHER_TENANT, PERSON, "id.jpg", NOW), TENANT, PERSON)).toBe(false);
    expect(documentPathOk(documentPath(TENANT, OTHER_PERSON, "id.jpg", NOW), TENANT, PERSON)).toBe(false);
  });

  it("refuses the old un-prefixed layout", () => {
    expect(documentPathOk(`${PERSON}/${NOW}-id.jpg`, TENANT, PERSON)).toBe(false);
  });

  it("refuses traversal, absolute paths, backslashes and empty input", () => {
    const bad = [
      `${TENANT}/${PERSON}/../${OTHER_PERSON}/${NOW}-id.jpg`,
      `${TENANT}/${PERSON}/${NOW}-..`,
      `${TENANT}/${PERSON}/..`,
      `/${TENANT}/${PERSON}/${NOW}-id.jpg`,
      `${TENANT}\\${PERSON}\\${NOW}-id.jpg`,
      `${TENANT}/${PERSON}/${NOW}-id\\x.jpg`,
      `${TENANT}//${PERSON}/${NOW}-id.jpg`,
      `${TENANT}/${PERSON}/${NOW}-id.jpg/`,
      ` ${TENANT}/${PERSON}/${NOW}-id.jpg`,
      "",
      "   ",
    ];
    for (const path of bad) expect(documentPathOk(path, TENANT, PERSON), path).toBe(false);
  });

  it("refuses extra or missing folders, and names the uploader never writes", () => {
    expect(documentPathOk(`${TENANT}/${PERSON}/extra/${NOW}-id.jpg`, TENANT, PERSON)).toBe(false);
    expect(documentPathOk(`${TENANT}/${PERSON}`, TENANT, PERSON)).toBe(false);
    expect(documentPathOk(`${TENANT}/${PERSON}/id.jpg`, TENANT, PERSON)).toBe(false);
    expect(documentPathOk(`${TENANT}/${PERSON}/${NOW}-id jpg`, TENANT, PERSON)).toBe(false);
    expect(documentPathOk(`${TENANT}/${PERSON}/${NOW}-id%2F.jpg`, TENANT, PERSON)).toBe(false);
  });

  it("refuses anything that is not a string, and empty owners", () => {
    for (const path of [null, undefined, 42, {}, ["a"]]) {
      expect(documentPathOk(path, TENANT, PERSON)).toBe(false);
    }
    expect(documentPathOk(`/${NOW}-id.jpg`, "", "")).toBe(false);
    expect(documentPathOk(`${NOW}-id.jpg`, "", PERSON)).toBe(false);
  });
});

describe("expense receipts", () => {
  it("accepts what the uploader builds", () => {
    const path = receiptPath(TENANT, PERSON, DRAFT, "fuel bill.jpg", NOW);
    expect(path).toBe(`${TENANT}/${PERSON}/${DRAFT}/${NOW}-fuel_bill.jpg`);
    expect(receiptPathOk(path, TENANT, PERSON)).toBe(true);
  });

  it("refuses another company's or another claimant's folder", () => {
    expect(receiptPathOk(receiptPath(OTHER_TENANT, PERSON, DRAFT, "a.jpg", NOW), TENANT, PERSON)).toBe(false);
    expect(receiptPathOk(receiptPath(TENANT, OTHER_PERSON, DRAFT, "a.jpg", NOW), TENANT, PERSON)).toBe(false);
  });

  it("refuses the old tenant-only layout and a draft folder that is not a UUID", () => {
    expect(receiptPathOk(`${TENANT}/${DRAFT}/${NOW}-a.jpg`, TENANT, PERSON)).toBe(false);
    expect(receiptPathOk(`${TENANT}/test/fuel.jpg`, TENANT, PERSON)).toBe(false);
    expect(receiptPathOk(`${TENANT}/${PERSON}/not-a-uuid/${NOW}-a.jpg`, TENANT, PERSON)).toBe(false);
  });

  it("refuses traversal, absolute paths, backslashes and empty input", () => {
    const bad = [
      `${TENANT}/${PERSON}/${DRAFT}/../../${OTHER_PERSON}/${DRAFT}/${NOW}-a.jpg`,
      `${TENANT}/${PERSON}/${DRAFT}/..`,
      `/${TENANT}/${PERSON}/${DRAFT}/${NOW}-a.jpg`,
      `${TENANT}\\${PERSON}\\${DRAFT}\\${NOW}-a.jpg`,
      "",
    ];
    for (const path of bad) expect(receiptPathOk(path, TENANT, PERSON), path).toBe(false);
  });
});

describe("task proof", () => {
  it("accepts what the uploader builds", () => {
    const path = proofPath(TENANT, TASK, "site photo.jpg", NOW);
    expect(path).toBe(`${TENANT}/${TASK}/${NOW}-site_photo.jpg`);
    expect(proofPathOk(path, TENANT, TASK)).toBe(true);
  });

  it("refuses another company's folder or another task's", () => {
    expect(proofPathOk(proofPath(OTHER_TENANT, TASK, "a.jpg", NOW), TENANT, TASK)).toBe(false);
    expect(proofPathOk(proofPath(TENANT, OTHER_TASK, "a.jpg", NOW), TENANT, TASK)).toBe(false);
  });

  it("refuses the old un-prefixed layout", () => {
    expect(proofPathOk(`${TASK}/${NOW}-a.jpg`, TENANT, TASK)).toBe(false);
  });

  it("refuses traversal, absolute paths, backslashes and empty input", () => {
    const bad = [
      `${TENANT}/${TASK}/../${OTHER_TASK}/${NOW}-a.jpg`,
      `${TENANT}/${TASK}/..`,
      `/${TENANT}/${TASK}/${NOW}-a.jpg`,
      `${TENANT}\\${TASK}\\${NOW}-a.jpg`,
      "",
    ];
    for (const path of bad) expect(proofPathOk(path, TENANT, TASK), path).toBe(false);
  });

  it("keeps each bucket's rule to its own layout", () => {
    // A receipt path, with its extra draft folder, is never taken as
    // proof or as a document.
    expect(proofPathOk(receiptPath(TENANT, TASK, DRAFT, "a.jpg", NOW), TENANT, TASK)).toBe(false);
    expect(documentPathOk(receiptPath(TENANT, PERSON, DRAFT, "a.jpg", NOW), TENANT, PERSON)).toBe(false);
  });
});

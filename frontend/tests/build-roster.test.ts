import { describe, expect, test } from "bun:test";
import {
  buildRoster,
  isOmitted,
  missingKey,
  normalizeCreatePayload,
} from "../lib/build-roster";
import { ROLES } from "../lib/roles";
import type { CreateLlmResponse } from "../lib/types";

const sampleWorkers: CreateLlmResponse["workers"] = ROLES.map((role, index) => ({
  name: `Worker ${String.fromCharCode(65 + index)}.`,
  slug: `worker-${String.fromCharCode(97 + index)}`,
  roleId: role.id,
}));

describe("normalizeCreatePayload", () => {
  test("turns a missing or partial LLM payload into empty arrays", () => {
    expect(normalizeCreatePayload(null)).toEqual({
      workers: [],
      missing: [],
      certs: [],
      emails: [],
      drugTests: [],
    });
    expect(normalizeCreatePayload({ workers: sampleWorkers.slice(0, 1) }).certs).toEqual(
      [],
    );
  });
});

describe("buildRoster", () => {
  test("always returns one worker per catalog role", () => {
    const { roster } = buildRoster({
      workers: sampleWorkers,
      missing: [],
      certs: [],
      emails: [],
      drugTests: [],
    });
    expect(roster.workers).toHaveLength(10);
    expect(roster.workers.map((worker) => worker.roleId)).toEqual(
      ROLES.map((role) => role.id),
    );
    expect(roster.workers.every((worker) => worker.requirements.length === 3)).toBe(
      true,
    );
  });

  test("fills missing roles with placeholder names instead of dropping them", () => {
    const { roster } = buildRoster({
      workers: [sampleWorkers[0]],
      missing: [],
      certs: [],
      emails: [],
      drugTests: [],
    });
    expect(roster.workers).toHaveLength(10);
    expect(roster.workers[0].name).toBe(sampleWorkers[0].name);
    expect(roster.workers[1].name).toBe("Riley F.");
    expect(roster.workers[1].roleId).toBe(ROLES[1].id);
  });

  test("ignores unknown role ids from the model", () => {
    const { roster } = buildRoster({
      workers: [
        { name: "Fake Z.", slug: "fake-z", roleId: "not-a-role" },
        ...sampleWorkers,
      ],
      missing: [],
      certs: [],
      emails: [],
      drugTests: [],
    });
    expect(roster.workers.some((worker) => worker.roleId === "not-a-role")).toBe(
      false,
    );
    expect(roster.workers).toHaveLength(10);
  });

  test("sets expected paths for certs, emails, and the shared drug-test CSV", () => {
    const { roster } = buildRoster({
      workers: sampleWorkers,
      missing: [],
      certs: [],
      emails: [],
      drugTests: [],
    });
    const forklift = roster.workers.find(
      (worker) => worker.roleId === "forklift-operator",
    );
    expect(forklift?.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "forklift-cert",
          expectedPath: `certs/forklift/${forklift?.slug}.md`,
        }),
        expect.objectContaining({
          id: "drug-test",
          expectedPath: "tests/test.csv",
        }),
        expect.objectContaining({
          id: "i9",
          expectedPath: `emails/${forklift?.slug}-i9.txt`,
        }),
      ]),
    );
  });

  test("keeps only missing keys that match a real worker and requirement", () => {
    const { missing } = buildRoster({
      workers: sampleWorkers,
      missing: [
        { slug: sampleWorkers[0].slug, requirementId: "drug-test" },
        { slug: "nobody", requirementId: "drug-test" },
        { slug: sampleWorkers[0].slug, requirementId: "not-a-req" },
      ],
      certs: [],
      emails: [],
      drugTests: [],
    });
    expect(missing.has(missingKey(sampleWorkers[0].slug, "drug-test"))).toBe(true);
    expect(missing.has(missingKey("nobody", "drug-test"))).toBe(false);
    expect(missing.has(missingKey(sampleWorkers[0].slug, "not-a-req"))).toBe(false);
  });
});

describe("isOmitted", () => {
  test("looks up slug and requirement id in the missing set", () => {
    const missing = new Set([missingKey("amy-z", "hep-b")]);
    expect(isOmitted(missing, "amy-z", "hep-b")).toBe(true);
    expect(isOmitted(missing, "amy-z", "drug-test")).toBe(false);
  });
});

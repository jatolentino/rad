import { describe, expect, test } from "bun:test";
import {
  isInfectionScreen,
  requirementClears,
  resultTone,
  statusLabel,
} from "../lib/clearance";
import type { SimRequirement } from "../lib/types";

function requirement(
  name: string,
  status: string | null,
  type: SimRequirement["type"] = "email",
): SimRequirement {
  return { name, type, path: "data/example", status };
}

describe("isInfectionScreen", () => {
  test("matches Hep B and TB names used on the desk", () => {
    expect(isInfectionScreen("Hep B titer")).toBe(true);
    expect(isInfectionScreen("Hepatitis B")).toBe(true);
    expect(isInfectionScreen("TB test")).toBe(true);
    expect(isInfectionScreen("tuberculosis")).toBe(true);
  });

  test("does not treat certificates or drug tests as infection screens", () => {
    expect(isInfectionScreen("Forklift cert")).toBe(false);
    expect(isInfectionScreen("I-9")).toBe(false);
    expect(isInfectionScreen("Drug test")).toBe(false);
    expect(isInfectionScreen("Background check")).toBe(false);
  });
});

describe("statusLabel", () => {
  test("returns the stored word, or null when Simulate has not filled it", () => {
    expect(statusLabel(requirement("I-9", "approved"))).toBe("approved");
    expect(statusLabel(requirement("I-9", null))).toBeNull();
    expect(statusLabel(undefined)).toBeNull();
  });
});

describe("requirementClears", () => {
  test("infection screens clear only on negative", () => {
    expect(requirementClears(requirement("Hep B titer", "negative"))).toBe(true);
    expect(requirementClears(requirement("TB test", "positive"))).toBe(false);
    expect(requirementClears(requirement("Hep B titer", "approved"))).toBe(false);
    expect(requirementClears(requirement("Hep B titer", "missing"))).toBe(false);
  });

  test("certs, I-9, background, and drug tests clear only on approved", () => {
    expect(requirementClears(requirement("Forklift cert", "approved", "certificate"))).toBe(
      true,
    );
    expect(requirementClears(requirement("I-9", "denied"))).toBe(false);
    expect(requirementClears(requirement("Drug test", "negative", "test"))).toBe(false);
    expect(requirementClears(requirement("Background check", "missing"))).toBe(false);
  });

  test("blank or missing Simulate cells do not clear", () => {
    expect(requirementClears(requirement("I-9", null))).toBe(false);
    expect(requirementClears(undefined)).toBe(false);
  });

  test("a worker is Compliant only when all three requirements clear", () => {
    const reqs = [
      requirement("Phlebotomy cert", "approved", "certificate"),
      requirement("Hep B titer", "negative"),
      requirement("Drug test", "approved", "test"),
    ];
    const parsed = reqs.every((item) => typeof item.status === "string");
    const compliant = parsed && reqs.every((item) => requirementClears(item));
    expect(compliant).toBe(true);

    const blocked = [...reqs];
    blocked[1] = requirement("Hep B titer", "positive");
    expect(blocked.every((item) => requirementClears(item))).toBe(false);
  });
});

describe("resultTone", () => {
  test("passing words are emerald, failing words are red, empty is muted", () => {
    expect(resultTone("approved")).toBe("text-emerald-700");
    expect(resultTone("negative")).toBe("text-emerald-700");
    expect(resultTone("positive")).toBe("text-red-700");
    expect(resultTone("denied")).toBe("text-red-700");
    expect(resultTone("missing")).toBe("text-red-700");
    expect(resultTone(null)).toBe("text-slate-400");
    expect(resultTone("unknown")).toBe("text-slate-600");
  });
});

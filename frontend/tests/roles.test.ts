import { describe, expect, test } from "bun:test";
import { certPath, emailPath, getRole, ROLES } from "../lib/roles";

describe("ROLES catalog", () => {
  test("has ten roles with three requirements each", () => {
    expect(ROLES).toHaveLength(10);
    for (const role of ROLES) {
      expect(role.requirements).toHaveLength(3);
      expect(role.id.length).toBeGreaterThan(0);
      expect(role.title.length).toBeGreaterThan(0);
    }
  });

  test("looks up a role by id", () => {
    expect(getRole("phlebotomist")?.title).toBe("Phlebotomist");
    expect(getRole("missing-role")).toBeUndefined();
  });

  test("builds cert and email paths the ingest layer expects", () => {
    expect(certPath("forklift", "jon-c")).toBe("certs/forklift/jon-c.md");
    expect(emailPath("amy-z", "hep-b")).toBe("emails/amy-z-hep-b.txt");
  });

  test("phlebotomist and CNA include infection-screen emails", () => {
    const hepB = getRole("phlebotomist")?.requirements.find((item) => item.id === "hep-b");
    const tb = getRole("cna")?.requirements.find((item) => item.id === "tb-test");
    expect(hepB).toEqual(
      expect.objectContaining({ kind: "email", emailSuffix: "hep-b" }),
    );
    expect(tb).toEqual(
      expect.objectContaining({ kind: "email", emailSuffix: "tb" }),
    );
  });
});

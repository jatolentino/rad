import { describe, expect, test } from "bun:test";
import { rosterKey } from "../lib/types";

describe("rosterKey", () => {
  test("matches the backend worker_key so Simulate rows join the table", () => {
    expect(rosterKey("Amy Z.")).toBe("Amy_Z");
    expect(rosterKey("Jon C.")).toBe("Jon_C");
    expect(rosterKey("Home Health")).toBe("Home_Health");
  });
});

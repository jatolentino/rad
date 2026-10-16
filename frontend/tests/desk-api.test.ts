import { describe, expect, test } from "bun:test";
import { simulateComplete } from "../lib/api/desk";
import type { SimPayload, SimWorker } from "../lib/types";

function worker(status: string | null): SimWorker {
  return {
    id: "1",
    worker: "Amy_Z",
    role: "Phlebotomist",
    requirements: {
      req1: {
        name: "Phlebotomy cert",
        type: "certificate",
        path: "data/certs/phlebotomy/amy-z.md",
        status,
      },
      req2: {
        name: "Hep B titer",
        type: "email",
        path: "data/emails/amy-z-hep-b.txt",
        status,
      },
      req3: {
        name: "Drug test",
        type: "test",
        path: "data/tests/test.csv",
        status,
      },
    },
  };
}

describe("simulateComplete", () => {
  test("is true when Process 2 sets complete", () => {
    const payload: SimPayload = {
      workers: [worker("approved")],
      complete: true,
    };
    expect(simulateComplete(payload)).toBe(true);
  });

  test("is true when every requirement already has a status word", () => {
    expect(simulateComplete({ workers: [worker("missing")] })).toBe(true);
  });

  test("is false while cells are still null or the payload has an error", () => {
    expect(simulateComplete({ workers: [worker(null)] })).toBe(false);
    expect(simulateComplete({ workers: [], complete: true })).toBe(false);
    expect(
      simulateComplete({
        workers: [worker("approved")],
        complete: true,
        error: "OPENAI_API_KEY is missing",
      }),
    ).toBe(false);
  });
});

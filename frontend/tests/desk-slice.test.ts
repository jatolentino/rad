import { describe, expect, test } from "bun:test";
import deskReducer, {
  clearError,
  createDesk,
  loadDesk,
  resetDesk,
  setQuery,
  simWorkersReceived,
  simulateDesk,
} from "../lib/store/deskSlice";
import type { RosterWorker, SimWorker } from "../lib/types";

const worker: RosterWorker = {
  name: "Amy Z.",
  slug: "amy-z",
  roleId: "phlebotomist",
  roleTitle: "Phlebotomist",
  requirements: [],
};

const simWorker: SimWorker = {
  id: "1",
  worker: "Amy_Z",
  role: "Phlebotomist",
  requirements: {},
};

describe("desk slice", () => {
  test("starts empty and loading until the roster fetch returns", () => {
    const initial = deskReducer(undefined, { type: "@@init" });
    expect(initial.workers).toEqual([]);
    expect(initial.simWorkers).toEqual([]);
    expect(initial.loading).toBe(true);
    expect(initial.query).toBe("");
  });

  test("setQuery and clearError update the presenter fields", () => {
    let next = deskReducer(undefined, setQuery("nurse"));
    expect(next.query).toBe("nurse");
    next = deskReducer({ ...next, error: "Create failed" }, clearError());
    expect(next.error).toBeNull();
  });

  test("loadDesk fills workers and any existing Simulate snapshot", () => {
    const pending = deskReducer(undefined, { type: loadDesk.pending.type });
    expect(pending.loading).toBe(true);
    const loaded = deskReducer(pending, {
      type: loadDesk.fulfilled.type,
      payload: { workers: [worker], simWorkers: [simWorker] },
    });
    expect(loaded.loading).toBe(false);
    expect(loaded.workers).toEqual([worker]);
    expect(loaded.simWorkers).toEqual([simWorker]);
  });

  test("createDesk replaces the roster and clears Simulate cells", () => {
    const started = deskReducer(
      {
        ...deskReducer(undefined, { type: "@@init" }),
        simWorkers: [simWorker],
        query: "amy",
      },
      { type: createDesk.pending.type },
    );
    expect(started.creating).toBe(true);
    const created = deskReducer(started, {
      type: createDesk.fulfilled.type,
      payload: [worker],
    });
    expect(created.creating).toBe(false);
    expect(created.workers).toEqual([worker]);
    expect(created.simWorkers).toEqual([]);
    expect(created.query).toBe("");
  });

  test("resetDesk returns the empty desk", () => {
    const filled = deskReducer(undefined, {
      type: loadDesk.fulfilled.type,
      payload: { workers: [worker], simWorkers: [simWorker] },
    });
    const reset = deskReducer(filled, { type: resetDesk.fulfilled.type });
    expect(reset.workers).toEqual([]);
    expect(reset.simWorkers).toEqual([]);
    expect(reset.resetting).toBe(false);
  });

  test("simulateDesk stores parsed workers and surfaces a timeout message", () => {
    const running = deskReducer(undefined, { type: simulateDesk.pending.type });
    expect(running.simulating).toBe(true);
    const done = deskReducer(running, {
      type: simulateDesk.fulfilled.type,
      payload: [simWorker],
    });
    expect(done.simulating).toBe(false);
    expect(done.simWorkers).toEqual([simWorker]);

    const failed = deskReducer(running, {
      type: simulateDesk.rejected.type,
      payload: "Timed out waiting for parsed statuses.",
    });
    expect(failed.simulating).toBe(false);
    expect(failed.error).toBe("Timed out waiting for parsed statuses.");
  });

  test("simWorkersReceived updates rows while polling", () => {
    const next = deskReducer(undefined, simWorkersReceived([simWorker]));
    expect(next.simWorkers).toEqual([simWorker]);
  });
});

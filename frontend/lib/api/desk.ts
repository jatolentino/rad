import type { Roster, SimPayload, SimWorker } from "@/lib/types";

function readError(body: { error?: string; detail?: string }, fallback: string) {
  return body.error ?? body.detail ?? fallback;
}

export function simulateComplete(payload: SimPayload): boolean {
  if (payload.error) {
    return false;
  }
  if (payload.complete && (payload.workers?.length ?? 0) > 0) {
    return true;
  }
  return (
    (payload.workers?.length ?? 0) > 0 &&
    payload.workers.every((worker) =>
      Object.values(worker.requirements).every(
        (requirement) => typeof requirement.status === "string",
      ),
    )
  );
}

export async function fetchRoster(): Promise<Roster> {
  const response = await fetch("/api/roster");
  const roster = (await response.json()) as Roster & { error?: string };
  if (!response.ok) {
    throw new Error(readError(roster, "Could not load the roster."));
  }
  return roster;
}

export async function fetchProcessed(): Promise<SimPayload | null> {
  const response = await fetch("/backend/api/v1/data-processed");
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as SimPayload;
}

export async function fetchPreProcessed(): Promise<SimPayload | null> {
  const response = await fetch("/backend/api/v1/pre-processed-data");
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as SimPayload;
}

export async function createRoster(): Promise<Roster> {
  const response = await fetch("/api/create", { method: "POST" });
  const body = (await response.json()) as Roster & { error?: string };
  if (!response.ok) {
    throw new Error(readError(body, "Create failed"));
  }
  return body;
}

export async function resetRoster(): Promise<void> {
  const response = await fetch("/api/reset", { method: "POST" });
  const body = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(readError(body, "Reset failed"));
  }
}

export async function startSimulate(): Promise<SimPayload> {
  const started = await fetch("/backend/api/v1/simulate", { method: "POST" });
  const startedBody = (await started.json()) as SimPayload & { detail?: string };
  if (!started.ok) {
    throw new Error(startedBody.detail ?? "Simulate failed");
  }
  return startedBody;
}

export async function loadDeskData(): Promise<{
  workers: Roster["workers"];
  simWorkers: SimWorker[];
}> {
  const roster = await fetchRoster();
  let simWorkers: SimWorker[] = [];
  const processed = await fetchProcessed();
  if (processed?.workers?.length) {
    simWorkers = processed.workers;
  }
  if (!simWorkers.length) {
    const pre = await fetchPreProcessed();
    simWorkers = pre?.workers ?? [];
  }
  return { workers: roster.workers ?? [], simWorkers };
}

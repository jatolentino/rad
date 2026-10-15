"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Roster, RosterWorker } from "@/lib/types";

const AVATAR_TONES = [
  "bg-[#ddd6fe] text-[#5b21b6]",
  "bg-[#c7d2fe] text-[#3730a3]",
  "bg-[#bae6fd] text-[#075985]",
  "bg-[#a7f3d0] text-[#065f46]",
  "bg-[#fde68a] text-[#92400e]",
  "bg-[#fecaca] text-[#9f1239]",
  "bg-[#fbcfe8] text-[#9d174d]",
  "bg-[#e7e5e4] text-[#44403c]",
];

function initials(name: string): string {
  const parts = name.replace(/\./g, "").trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function Avatar({ name, index }: { name: string; index: number }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${AVATAR_TONES[index % AVATAR_TONES.length]}`}
    >
      {initials(name)}
    </span>
  );
}

export function Desk() {
  const [workers, setWorkers] = useState<RosterWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    const response = await fetch("/api/roster");
    const body = (await response.json()) as
      | Roster
      | { workers: RosterWorker[]; error?: string };
    setWorkers(body.workers ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadRoster();
      } catch {
        if (!cancelled) {
          setError("Could not load the roster.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRoster]);

  async function onCreate() {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/create", { method: "POST" });
      const body = (await response.json()) as Roster & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Create failed");
      }
      setWorkers(body.workers);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function onReset() {
    setResetting(true);
    setError(null);
    try {
      const response = await fetch("/api/reset", { method: "POST" });
      const body = (await response.json()) as {
        workers?: RosterWorker[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Reset failed");
      }
      setWorkers([]);
      setQuery("");
      setConfirmReset(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  const hasWorkers = workers.length > 0;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return workers;
    }
    return workers.filter(
      (worker) =>
        worker.name.toLowerCase().includes(q) ||
        worker.roleTitle.toLowerCase().includes(q),
    );
  }, [query, workers]);

  return (
    <div className="min-h-full bg-[#f6f3fb] text-slate-900">
      <header className="border-b border-violet-100/80 bg-gradient-to-b from-[#efe7fb] to-[#f6f3fb]">
        <div className="flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-900 shadow-sm">
                d.
              </span>
              <span className="text-sm font-medium text-slate-700">Clearance</span>
            </div>
            <nav className="hidden items-center gap-1 text-sm text-slate-600 md:flex">
              <span className="rounded-full bg-white px-3 py-1.5 font-medium text-slate-900 shadow-sm">
                People
              </span>
              <span className="px-3 py-1.5">Documents</span>
              <span className="px-3 py-1.5">Immigration</span>
            </nav>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-200 text-xs font-semibold text-violet-900">
            AS
          </div>
        </div>
        <div className="hidden gap-5 px-6 pb-3 text-sm text-slate-600 md:flex">
          <span className="font-medium text-slate-900">People</span>
          <span>Org chart</span>
          <span>Time off</span>
          <span>Background checks</span>
        </div>
      </header>

      <main className="px-6 py-8 md:px-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              People
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Who is cleared to work on an assignment today.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasWorkers ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                disabled={creating || resetting}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Reset
              </button>
            ) : null}
            <button
              type="button"
              disabled
              title="Simulate will parse documents in the next step"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400"
            >
              Simulate
            </button>
            <button
              type="button"
              onClick={onCreate}
              disabled={creating || resetting}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-70"
            >
              {creating ? "Creating…" : "+ Create"}
            </button>
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {hasWorkers ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
              <span className="text-slate-400" aria-hidden>
                ⌕
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or role"
                className="w-full bg-transparent outline-none placeholder:text-slate-400"
              />
            </label>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              Worker status
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              Role
            </span>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-500">Loading people…</p>
        ) : !hasWorkers ? (
          <div className="rounded-2xl border border-dashed border-violet-200 bg-white/70 px-8 py-16 text-center">
            <p className="text-base font-medium text-slate-800">No people yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Create a simulation to generate 10 workers and their documents.
            </p>
          </div>
        ) : (
          <section className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
            <p className="border-b border-slate-100 px-5 py-3 text-sm text-slate-500">
              Total {visible.length} {visible.length === 1 ? "person" : "people"}
            </p>
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="text-[13px] font-medium text-slate-500">
                  <th className="px-5 py-3">Person</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Req1</th>
                  <th className="px-5 py-3">Req2</th>
                  <th className="px-5 py-3">Req3</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((worker, index) => (
                  <tr
                    key={worker.slug}
                    className="border-t border-slate-100 hover:bg-violet-50/40"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={worker.name} index={index} />
                        <div>
                          <p className="font-medium text-[#5b4dc9]">
                            {worker.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {worker.roleTitle}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{worker.roleTitle}</td>
                    <td className="px-5 py-3 text-slate-300">—</td>
                    <td className="px-5 py-3 text-slate-300">—</td>
                    <td className="px-5 py-3 text-slate-300">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>

      {confirmReset ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h2 id="reset-title" className="text-lg font-semibold text-slate-900">
                Permanently delete
              </h2>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              This is a permanent action and cannot be undone. Every generated
              worker, certificate, test row, and email in /data will be deleted.
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                disabled={resetting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onReset}
                disabled={resetting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-70"
              >
                {resetting ? "Deleting…" : "Permanently delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

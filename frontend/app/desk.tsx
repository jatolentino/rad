"use client";

import { useEffect, useMemo, useState } from "react";
import { Providers } from "./providers";
import {
  createDesk,
  loadDesk,
  resetDesk,
  setQuery,
  simulateDesk,
} from "@/lib/store/deskSlice";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import type { RootState } from "@/lib/store";
import type { SimRequirement, SimWorker } from "@/lib/types";
import { rosterKey } from "@/lib/types";

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

function statusLabel(requirement?: SimRequirement): string | null {
  const value = requirement?.status;
  if (typeof value !== "string" || !value) {
    return null;
  }
  return value;
}

function isInfectionScreen(name: string): boolean {
  return /\b(hep(?:atitis)?(?:\s*b)?|tb|tuberculosis)\b/i.test(name);
}

function requirementClears(requirement?: SimRequirement): boolean {
  const value = statusLabel(requirement)?.toLowerCase();
  if (!value || !requirement) {
    return false;
  }
  if (isInfectionScreen(requirement.name)) {
    return value === "negative";
  }
  return value === "approved";
}

function resultTone(status?: string | null): string {
  if (!status) {
    return "text-slate-400";
  }
  const value = status.toLowerCase();
  if (value === "approved" || value === "negative") {
    return "text-emerald-700";
  }
  if (
    value === "positive" ||
    value === "denied" ||
    value === "not approved" ||
    value === "missing"
  ) {
    return "text-red-700";
  }
  return "text-slate-600";
}

function ReqCell({ requirement }: { requirement?: SimRequirement }) {
  if (!requirement) {
    return <span className="text-slate-300">—</span>;
  }
  const status = statusLabel(requirement);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{requirement.name}</span>
      {status ? (
        <span className={`font-medium ${resultTone(status)}`}>{status}</span>
      ) : null}
    </span>
  );
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
  return (
    <Providers>
      <DeskApp />
    </Providers>
  );
}

function DeskApp() {
  const dispatch = useAppDispatch();
  const workers = useAppSelector((state: RootState) => state.desk.workers);
  const simWorkers = useAppSelector((state: RootState) => state.desk.simWorkers);
  const loading = useAppSelector((state: RootState) => state.desk.loading);
  const creating = useAppSelector((state: RootState) => state.desk.creating);
  const resetting = useAppSelector((state: RootState) => state.desk.resetting);
  const simulating = useAppSelector((state: RootState) => state.desk.simulating);
  const query = useAppSelector((state: RootState) => state.desk.query);
  const error = useAppSelector((state: RootState) => state.desk.error);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    void dispatch(loadDesk());
  }, [dispatch]);

  async function onReset() {
    const result = await dispatch(resetDesk());
    if (resetDesk.fulfilled.match(result)) {
      setConfirmReset(false);
    }
  }

  const hasWorkers = workers.length > 0;
  const simByKey = useMemo(() => {
    const map = new Map<string, SimWorker>();
    for (const item of simWorkers) {
      map.set(item.worker, item);
    }
    return map;
  }, [simWorkers]);
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
            <button
              type="button"
              onClick={() => void dispatch(createDesk())}
              disabled={creating || resetting || simulating}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-70"
            >
              {creating ? "Creating…" : "+ Create"}
            </button>
            <button
              type="button"
              onClick={() => void dispatch(simulateDesk())}
              disabled={!hasWorkers || creating || resetting || simulating}
              title={
                hasWorkers
                  ? "Parse documents and mark each requirement"
                  : "Create workers first"
              }
              className={`rounded-full border border-transparent px-4 py-2 text-sm shadow-sm transition-colors ${
                hasWorkers
                  ? "bg-blue-400 font-medium text-white hover:bg-blue-700 active:bg-blue-950 disabled:bg-blue-400 disabled:hover:bg-blue-400"
                  : "bg-blue-200 font-light text-gray-400"
              }`}
            >
              {simulating ? "Simulating…" : "Simulate"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              disabled={!hasWorkers || creating || resetting || simulating}
              title={hasWorkers ? "Delete generated workers and documents" : "Create workers first"}
              className={`rounded-full border border-transparent px-4 py-2 text-sm shadow-sm transition-colors ${
                hasWorkers
                  ? "bg-red-400 font-medium text-white hover:bg-red-700 active:bg-red-950 disabled:bg-red-400 disabled:hover:bg-red-400"
                  : "bg-red-200 font-light text-gray-400"
              }`}
            >
              Reset
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
                onChange={(event) => dispatch(setQuery(event.target.value))}
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
              Total {visible.length} {visible.length === 1 ? "worker" : "workers"}
            </p>
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="text-[13px] font-medium text-slate-500">
                  <th className="px-5 py-3">Worker</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Req1</th>
                  <th className="px-5 py-3">Req2</th>
                  <th className="px-5 py-3">Req3</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((worker, index) => {
                  const sim = simByKey.get(rosterKey(worker.name));
                  const reqs = [
                    sim?.requirements.req1,
                    sim?.requirements.req2,
                    sim?.requirements.req3,
                  ];
                  const parsed = reqs.every((item) => typeof item?.status === "string");
                  const compliant = parsed && reqs.every((item) => requirementClears(item));
                  return (
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
                    {reqs.map((requirement, reqIndex) => (
                      <td key={reqIndex} className="px-5 py-3 text-slate-700">
                        <ReqCell requirement={requirement} />
                      </td>
                    ))}
                    <td className="px-5 py-3">
                      {parsed ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            compliant
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {compliant ? "Compliant" : "Non-compliant"}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
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

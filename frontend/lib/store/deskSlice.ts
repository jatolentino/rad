"use client";

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { Roster, RosterWorker, SimPayload, SimWorker } from "@/lib/types";

type DeskState = {
  workers: RosterWorker[];
  simWorkers: SimWorker[];
  loading: boolean;
  creating: boolean;
  resetting: boolean;
  simulating: boolean;
  query: string;
  error: string | null;
};

const initialState: DeskState = {
  workers: [],
  simWorkers: [],
  loading: true,
  creating: false,
  resetting: false,
  simulating: false,
  query: "",
  error: null,
};

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

export const loadDesk = createAsyncThunk("desk/load", async () => {
  const response = await fetch("/api/roster");
  const roster = (await response.json()) as Roster & { error?: string };
  if (!response.ok) {
    throw new Error(readError(roster, "Could not load the roster."));
  }
  let simWorkers: SimWorker[] = [];
  const processed = await fetch("/backend/api/v1/data-processed");
  if (processed.ok) {
    const body = (await processed.json()) as SimPayload;
    if (body.workers?.length) {
      simWorkers = body.workers;
    }
  }
  if (!simWorkers.length) {
    const pre = await fetch("/backend/api/v1/pre-processed-data");
    if (pre.ok) {
      const body = (await pre.json()) as SimPayload;
      simWorkers = body.workers ?? [];
    }
  }
  return { workers: roster.workers ?? [], simWorkers };
});

export const createDesk = createAsyncThunk("desk/create", async () => {
  const response = await fetch("/api/create", { method: "POST" });
  const body = (await response.json()) as Roster & { error?: string };
  if (!response.ok) {
    throw new Error(readError(body, "Create failed"));
  }
  return body.workers ?? [];
});

export const resetDesk = createAsyncThunk("desk/reset", async () => {
  const response = await fetch("/api/reset", { method: "POST" });
  const body = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(readError(body, "Reset failed"));
  }
});

export const simulateDesk = createAsyncThunk(
  "desk/simulate",
  async (_, { dispatch, rejectWithValue }) => {
    const started = await fetch("/backend/api/v1/simulate", { method: "POST" });
    const startedBody = (await started.json()) as SimPayload & { detail?: string };
    if (!started.ok) {
      return rejectWithValue(startedBody.detail ?? "Simulate failed");
    }
    if (startedBody.workers?.length) {
      dispatch(simWorkersReceived(startedBody.workers));
    }
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const response = await fetch("/backend/api/v1/data-processed");
      if (!response.ok) {
        continue;
      }
      const body = (await response.json()) as SimPayload;
      if (body.error) {
        return rejectWithValue(body.error);
      }
      if (body.workers?.length) {
        dispatch(simWorkersReceived(body.workers));
      }
      if (simulateComplete(body)) {
        return body.workers;
      }
    }
    return rejectWithValue("Timed out waiting for parsed statuses.");
  },
);

const deskSlice = createSlice({
  name: "desk",
  initialState,
  reducers: {
    setQuery(state, action: PayloadAction<string>) {
      state.query = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
    simWorkersReceived(state, action: PayloadAction<SimWorker[]>) {
      state.simWorkers = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadDesk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadDesk.fulfilled, (state, action) => {
        state.loading = false;
        state.workers = action.payload.workers;
        state.simWorkers = action.payload.simWorkers;
      })
      .addCase(loadDesk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? "Could not load the roster.";
      })
      .addCase(createDesk.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createDesk.fulfilled, (state, action) => {
        state.creating = false;
        state.workers = action.payload;
        state.simWorkers = [];
        state.query = "";
      })
      .addCase(createDesk.rejected, (state, action) => {
        state.creating = false;
        state.error = action.error.message ?? "Create failed";
      })
      .addCase(resetDesk.pending, (state) => {
        state.resetting = true;
        state.error = null;
      })
      .addCase(resetDesk.fulfilled, (state) => {
        state.resetting = false;
        state.workers = [];
        state.simWorkers = [];
        state.query = "";
      })
      .addCase(resetDesk.rejected, (state, action) => {
        state.resetting = false;
        state.error = action.error.message ?? "Reset failed";
      })
      .addCase(simulateDesk.pending, (state) => {
        state.simulating = true;
        state.error = null;
      })
      .addCase(simulateDesk.fulfilled, (state, action) => {
        state.simulating = false;
        if (action.payload?.length) {
          state.simWorkers = action.payload;
        }
      })
      .addCase(simulateDesk.rejected, (state, action) => {
        state.simulating = false;
        state.error =
          (typeof action.payload === "string" && action.payload) ||
          action.error.message ||
          "Simulate failed. Is the FastAPI server running on port 4000?";
      });
  },
});

export const { setQuery, clearError, simWorkersReceived } = deskSlice.actions;
export default deskSlice.reducer;

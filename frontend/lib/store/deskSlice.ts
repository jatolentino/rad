"use client";

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import {
  createRoster,
  fetchProcessed,
  loadDeskData,
  resetRoster,
  simulateComplete,
  startSimulate,
} from "@/lib/api/desk";
import type { RosterWorker, SimPayload, SimWorker } from "@/lib/types";

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

export { simulateComplete };

export const loadDesk = createAsyncThunk("desk/load", async () => {
  return loadDeskData();
});

export const createDesk = createAsyncThunk("desk/create", async () => {
  const body = await createRoster();
  return body.workers ?? [];
});

export const resetDesk = createAsyncThunk("desk/reset", async () => {
  await resetRoster();
});

export const simulateDesk = createAsyncThunk(
  "desk/simulate",
  async (_, { dispatch, rejectWithValue }) => {
    let startedBody: SimPayload;
    try {
      startedBody = await startSimulate();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Simulate failed",
      );
    }
    if (startedBody.workers?.length) {
      dispatch(simWorkersReceived(startedBody.workers));
    }
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const body = await fetchProcessed();
      if (!body) {
        continue;
      }
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

"use client";

import { configureStore } from "@reduxjs/toolkit";
import deskReducer from "./deskSlice";

export function makeStore() {
  return configureStore({
    reducer: {
      desk: deskReducer,
    },
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

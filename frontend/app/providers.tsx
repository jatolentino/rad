"use client";

import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<AppStore | null>(null);

  useEffect(() => {
    setStore(makeStore());
  }, []);

  if (!store) {
    return (
      <div className="min-h-full bg-[#f6f3fb] text-slate-500">
        <p className="px-6 py-8 text-sm">Loading people…</p>
      </div>
    );
  }

  return <Provider store={store}>{children}</Provider>;
}

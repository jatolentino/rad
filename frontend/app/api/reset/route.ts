import { clearDataDir } from "@/lib/data-dir";

export async function POST() {
  try {
    await fetch("http://127.0.0.1:8000/api/v1/reset", { method: "POST" });
  } catch {
    // FastAPI may be stopped; still wipe local files.
  }
  await clearDataDir();
  return Response.json({ workers: [] });
}

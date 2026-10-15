import { clearDataDir } from "@/lib/data-dir";

export async function POST() {
  await clearDataDir();
  return Response.json({ workers: [] });
}

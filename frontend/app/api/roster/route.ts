import { readRoster } from "@/lib/data-dir";

export async function GET() {
  const roster = await readRoster();
  if (!roster) {
    return Response.json({ workers: [] });
  }
  return Response.json(roster);
}

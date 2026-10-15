import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Roster } from "./types";

export function getDataDir(): string {
  return path.resolve(process.cwd(), "..", "data");
}

export function getRosterPath(): string {
  return path.join(getDataDir(), "roster.json");
}

async function wipeGeneratedData(): Promise<void> {
  const dir = getDataDir();
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map((entry) => {
      if (entry.name === ".gitkeep") {
        return Promise.resolve();
      }
      return rm(path.join(dir, entry.name), { recursive: true, force: true });
    }),
  );
}

export async function clearDataDir(): Promise<void> {
  await wipeGeneratedData();
}

export async function resetDataDir(): Promise<void> {
  await wipeGeneratedData();
  const dir = getDataDir();
  await mkdir(path.join(dir, "certs"), { recursive: true });
  await mkdir(path.join(dir, "tests"), { recursive: true });
  await mkdir(path.join(dir, "emails"), { recursive: true });
}

export async function writeDataFile(
  relativePath: string,
  contents: string,
): Promise<void> {
  const fullPath = path.join(getDataDir(), relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, contents, "utf8");
}

export async function readRoster(): Promise<Roster | null> {
  try {
    const raw = await readFile(getRosterPath(), "utf8");
    return JSON.parse(raw) as Roster;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

import type { RequirementKind } from "./roles";

export type RosterRequirement = {
  id: string;
  label: string;
  kind: RequirementKind;
  expectedPath?: string;
};

export type RosterWorker = {
  name: string;
  slug: string;
  roleId: string;
  roleTitle: string;
  requirements: RosterRequirement[];
};

export type Roster = {
  generatedAt: string;
  workers: RosterWorker[];
};

export type SimRequirement = {
  name: string;
  type: "certificate" | "email" | "test";
  path: string;
  status: string | null;
};

export type SimWorker = {
  id: string;
  worker: string;
  role: string;
  requirements: Record<string, SimRequirement>;
};

export type SimPayload = {
  workers: SimWorker[];
  complete?: boolean;
  error?: string | null;
};

export function rosterKey(name: string): string {
  return name.replace(/\./g, "").replace(/\s+/g, "_");
}

export type CreateLlmResponse = {
  workers: Array<{
    name: string;
    slug: string;
    roleId: string;
  }>;
  missing: Array<{
    slug: string;
    requirementId: string;
  }>;
  certs: Array<{
    category: string;
    slug: string;
    markdown: string;
  }>;
  emails: Array<{
    filename: string;
    content: string;
  }>;
  drugTests: Array<{
    worker: string;
    panel: string;
    collected_on: string;
    result: string;
  }>;
};

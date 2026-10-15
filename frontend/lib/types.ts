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

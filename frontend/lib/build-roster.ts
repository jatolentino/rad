import { certPath, emailPath, ROLES, type Requirement } from "./roles";
import type { CreateLlmResponse, Roster, RosterWorker } from "./types";

function expectedPath(slug: string, requirement: Requirement): string | undefined {
  if (requirement.kind === "cert" && requirement.certCategory) {
    return certPath(requirement.certCategory, slug);
  }
  if (requirement.kind === "email" && requirement.emailSuffix) {
    return emailPath(slug, requirement.emailSuffix);
  }
  if (requirement.kind === "drug_test") {
    return "tests/test.csv";
  }
  return undefined;
}

function missingKey(slug: string, requirementId: string): string {
  return `${slug}::${requirementId}`;
}

const PLACEHOLDER_NAMES = [
  "Riley F.",
  "Morgan H.",
  "Quinn W.",
  "Avery C.",
  "Jamie N.",
  "Drew E.",
  "Cameron S.",
  "Parker G.",
  "Taylor P.",
  "Reese V.",
];

function slugFromName(name: string): string {
  return name.toLowerCase().replace(/\./g, "").trim().replace(/\s+/g, "-");
}

export function normalizeCreatePayload(
  raw: Partial<CreateLlmResponse> | null | undefined,
): CreateLlmResponse {
  return {
    workers: Array.isArray(raw?.workers) ? raw.workers : [],
    missing: Array.isArray(raw?.missing) ? raw.missing : [],
    certs: Array.isArray(raw?.certs) ? raw.certs : [],
    emails: Array.isArray(raw?.emails) ? raw.emails : [],
    drugTests: Array.isArray(raw?.drugTests) ? raw.drugTests : [],
  };
}

function oneWorkerPerRole(
  generated: CreateLlmResponse["workers"],
): CreateLlmResponse["workers"] {
  const byRole = new Map<string, CreateLlmResponse["workers"][number]>();
  for (const worker of generated) {
    if (!ROLES.some((role) => role.id === worker.roleId)) {
      continue;
    }
    if (!byRole.has(worker.roleId)) {
      byRole.set(worker.roleId, worker);
    }
  }

  const usedSlugs = new Set(
    [...byRole.values()].map((worker) => worker.slug).filter(Boolean),
  );
  let placeholder = 0;

  return ROLES.map((role) => {
    const existing = byRole.get(role.id);
    if (existing?.name && existing.slug) {
      return existing;
    }
    let name = PLACEHOLDER_NAMES[placeholder] ?? `Worker ${placeholder + 1}`;
    placeholder += 1;
    let slug = slugFromName(name);
    if (usedSlugs.has(slug)) {
      slug = `${slug}-${role.id}`;
    }
    usedSlugs.add(slug);
    return { name, slug, roleId: role.id };
  });
}

export function buildRoster(payload: CreateLlmResponse): {
  roster: Roster;
  missing: Set<string>;
} {
  const normalized = normalizeCreatePayload(payload);
  const generated = oneWorkerPerRole(normalized.workers);
  const missing = new Set(
    normalized.missing.map((item) => missingKey(item.slug, item.requirementId)),
  );

  const slugs = new Set<string>();
  const workers: RosterWorker[] = ROLES.map((role, index) => {
    const item = generated[index];
    if (slugs.has(item.slug)) {
      throw new Error(`Duplicate slug ${item.slug}`);
    }
    slugs.add(item.slug);

    return {
      name: item.name,
      slug: item.slug,
      roleId: role.id,
      roleTitle: role.title,
      requirements: role.requirements.map((requirement) => ({
        id: requirement.id,
        label: requirement.label,
        kind: requirement.kind,
        expectedPath: expectedPath(item.slug, requirement),
      })),
    };
  });

  for (const key of [...missing]) {
    const [slug, requirementId] = key.split("::");
    const worker = workers.find((item) => item.slug === slug);
    if (!worker || !worker.requirements.some((req) => req.id === requirementId)) {
      missing.delete(key);
    }
  }

  return {
    roster: {
      generatedAt: new Date().toISOString(),
      workers,
    },
    missing,
  };
}

export function isOmitted(
  missing: Set<string>,
  slug: string,
  requirementId: string,
): boolean {
  return missing.has(missingKey(slug, requirementId));
}

export { missingKey };

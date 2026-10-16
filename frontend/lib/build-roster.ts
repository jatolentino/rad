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

export function buildRoster(payload: CreateLlmResponse): {
  roster: Roster;
  missing: Set<string>;
} {
  const byRole = new Map(payload.workers.map((worker) => [worker.roleId, worker]));
  const missing = new Set(
    payload.missing.map((item) => missingKey(item.slug, item.requirementId)),
  );

  if (payload.workers.length !== ROLES.length) {
    throw new Error(`Expected ${ROLES.length} workers, got ${payload.workers.length}`);
  }

  const slugs = new Set<string>();
  const workers: RosterWorker[] = ROLES.map((role) => {
    const generated = byRole.get(role.id);
    if (!generated) {
      throw new Error(`Missing worker for role ${role.id}`);
    }
    if (slugs.has(generated.slug)) {
      throw new Error(`Duplicate slug ${generated.slug}`);
    }
    slugs.add(generated.slug);

    return {
      name: generated.name,
      slug: generated.slug,
      roleId: role.id,
      roleTitle: role.title,
      requirements: role.requirements.map((requirement) => ({
        id: requirement.id,
        label: requirement.label,
        kind: requirement.kind,
        expectedPath: expectedPath(generated.slug, requirement),
      })),
    };
  });

  for (const key of missing) {
    const [slug, requirementId] = key.split("::");
    const worker = workers.find((item) => item.slug === slug);
    if (!worker || !worker.requirements.some((req) => req.id === requirementId)) {
      throw new Error(`Missing document does not match a roster requirement: ${key}`);
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

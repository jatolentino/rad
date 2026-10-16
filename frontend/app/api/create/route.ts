import { randomInt } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import {
  buildRoster,
  isOmitted,
  missingKey,
  normalizeCreatePayload,
} from "@/lib/build-roster";
import { getDataDir, resetDataDir, writeDataFile } from "@/lib/data-dir";
import { emailPath, getRole, ROLES } from "@/lib/roles";
import type { CreateLlmResponse, RosterWorker } from "@/lib/types";

export const maxDuration = 120;

const catalog = ROLES.map((role) => ({
  id: role.id,
  title: role.title,
  requirements: role.requirements.map((requirement) => ({
    id: requirement.id,
    label: requirement.label,
    kind: requirement.kind,
    certCategory: requirement.certCategory,
    emailSuffix: requirement.emailSuffix,
  })),
}));

function pickCompliantRoleIds(count: number): string[] {
  const ids = ROLES.map((role) => role.id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    const current = ids[index];
    ids[index] = ids[swap];
    ids[swap] = current;
  }
  return ids.slice(0, count);
}

function passingCertMarkdown(workerName: string, label: string): string {
  return [
    `# ${label}`,
    "",
    `- Worker: ${workerName}`,
    `- Credential: ${label}`,
    `- Issued: 2025-03-01`,
    `- Expires: 2028-03-01`,
    `- Status: valid`,
    "",
  ].join("\n");
}

function passingEmail(workerName: string, suffix: string): string {
  if (suffix === "hep-b") {
    return [
      `From: lab@example.com`,
      `To: hr@company.com`,
      `Subject: Hepatitis B titer — ${workerName}`,
      `Your titer results have been processed.`,
      `Hepatitis B result: negative`,
      `The worker does not have Hepatitis B.`,
      "",
    ].join("\n");
  }
  if (suffix === "tb") {
    return [
      `From: lab@example.com`,
      `To: hr@company.com`,
      `Subject: TB test — ${workerName}`,
      `TB result: negative`,
      `The worker does not have tuberculosis.`,
      "",
    ].join("\n");
  }
  if (suffix === "i9") {
    return [
      `From: i9desk@verify.example`,
      `To: hr@company.com`,
      `Subject: I-9 complete — ${workerName}`,
      `Section 1 completed. Section 2 verified List A passport. Eligible to work.`,
      "",
    ].join("\n");
  }
  return [
    `From: screening@verify.example`,
    `To: hr@company.com`,
    `Subject: Background check — ${workerName}`,
    `Background check: clear.`,
    "",
  ].join("\n");
}

function markCompliantComplete(
  workers: RosterWorker[],
  missing: Set<string>,
  compliantRoleIds: string[],
) {
  const compliant = new Set(compliantRoleIds);
  for (const worker of workers) {
    if (!compliant.has(worker.roleId)) {
      continue;
    }
    for (const requirement of worker.requirements) {
      missing.delete(missingKey(worker.slug, requirement.id));
    }
  }
  const nonCompliant = workers.filter((worker) => !compliant.has(worker.roleId));
  for (const worker of nonCompliant) {
    if (missing.size >= 3) {
      break;
    }
    for (const requirement of worker.requirements) {
      if (missing.size >= 3) {
        break;
      }
      missing.add(missingKey(worker.slug, requirement.id));
    }
  }
}

function systemPrompt(compliantRoleIds: string[]): string {
  return [
    "You generate synthetic HR staffing clearance documents for a simulation.",
    "Invent realistic US worker names (first name + last initial, e.g. Jon C.).",
    "slugs are lowercase kebab-case of the name (jon-c).",
    `Return EXACTLY ${ROLES.length} workers: one for every roleId in the catalog. Never skip a role. Do not invent roles.`,
    `These roleIds MUST fully comply: ${JSON.stringify(compliantRoleIds)}.`,
    "For each fully compliant worker: include all three required documents. Do not list them in missing.",
    "Fully compliant documents MUST pass clearance: unexpired certs (expiry 2027 or later), completed I-9 Section 1 and Section 2, clear background check, Hepatitis B result: negative, TB result: negative, drug test result exactly negative.",
    "The remaining workers (not in that list) MUST fail at least one requirement: omit a document or write a failing result (expired cert, incomplete I-9, not clear background, Hepatitis B result: positive, TB result: positive, or drug test result: positive).",
    "Omit documents only for non-compliant workers. List omitted items in missing. Do not include omitted certs, emails, or drug-test rows in those arrays.",
    "Cert markdown is a short certificate with issued and expiry dates.",
    "Emails are vendor plain text (From/To/Subject/Date/body).",
    "Every medical or lab email MUST state the actual result in one clear sentence. Never say only that results were processed.",
    "All content is fictional. No real SSNs.",
  ].join(" ");
}

function userPrompt(compliantRoleIds: string[]): string {
  return [
    "Role catalog (JSON):",
    JSON.stringify(catalog),
    "",
    `Include every roleId exactly once (${ROLES.length} workers):`,
    JSON.stringify(ROLES.map((role) => role.id)),
    "",
    "Fully compliant roleIds (all 3 requirements present and passing):",
    JSON.stringify(compliantRoleIds),
    "",
    "Respond with JSON matching:",
    JSON.stringify({
      workers: [{ name: "Jon C.", slug: "jon-c", roleId: "forklift-operator" }],
      missing: [{ slug: "jon-c", requirementId: "drug-test" }],
      certs: [
        {
          category: "forklift",
          slug: "jon-c",
          markdown: "# Forklift operator certificate\n...",
        },
      ],
      emails: [
        {
          filename: "amy-z-hep-b.txt",
          content:
            "From: lab@example.com\nTo: amy.z@company.com\nSubject: Hepatitis B titer\nYour titer results have been processed.\nHepatitis B result: negative\nThe worker does not have Hepatitis B.\n",
        },
      ],
      drugTests: [
        {
          worker: "Jon C.",
          panel: "5-panel",
          collected_on: "2026-09-02",
          result: "negative",
        },
      ],
    }),
  ].join("\n");
}

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is missing. Add it to frontend/.env.local." },
      { status: 500 },
    );
  }

  const openai = new OpenAI({ apiKey });
  const compliantRoleIds = pickCompliantRoleIds(6);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.8,
      messages: [
        { role: "system", content: systemPrompt(compliantRoleIds) },
        { role: "user", content: userPrompt(compliantRoleIds) },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return Response.json(
        { error: "OpenAI returned an empty response." },
        { status: 502 },
      );
    }

    const payload = normalizeCreatePayload(
      JSON.parse(text) as CreateLlmResponse,
    );
    const { roster, missing } = buildRoster(payload);
    const compliantRoles = new Set(compliantRoleIds);
    markCompliantComplete(roster.workers, missing, compliantRoleIds);

    await resetDataDir();
    await writeDataFile("roster.json", `${JSON.stringify(roster, null, 2)}\n`);

    for (const cert of payload.certs) {
      const roleWorker = roster.workers.find((worker) => worker.slug === cert.slug);
      if (!roleWorker || compliantRoles.has(roleWorker.roleId)) {
        continue;
      }
      const requirement = roleWorker.requirements.find(
        (item) => item.kind === "cert" && item.expectedPath?.includes(`/${cert.category}/`),
      );
      if (!requirement || isOmitted(missing, cert.slug, requirement.id)) {
        continue;
      }
      await writeDataFile(
        `certs/${cert.category}/${cert.slug}.md`,
        cert.markdown.trim().concat("\n"),
      );
    }

    for (const email of payload.emails) {
      const filename = email.filename.replace(/^.*[/\\]/, "");
      const worker = roster.workers.find((item) => filename.startsWith(`${item.slug}-`));
      if (!worker || compliantRoles.has(worker.roleId)) {
        continue;
      }
      const suffix = filename.replace(`${worker.slug}-`, "").replace(/\.txt$/, "");
      const requirement = getRole(worker.roleId)?.requirements.find(
        (item) => item.kind === "email" && item.emailSuffix === suffix,
      );
      if (
        !requirement ||
        isOmitted(missing, worker.slug, requirement.id) ||
        emailPath(worker.slug, suffix) !== `emails/${filename}`
      ) {
        continue;
      }
      await writeDataFile(`emails/${filename}`, email.content.trim().concat("\n"));
    }

    for (const worker of roster.workers) {
      if (!compliantRoles.has(worker.roleId)) {
        continue;
      }
      const role = getRole(worker.roleId);
      if (!role) {
        continue;
      }
      for (const requirement of role.requirements) {
        if (requirement.kind === "cert" && requirement.certCategory) {
          await writeDataFile(
            `certs/${requirement.certCategory}/${worker.slug}.md`,
            passingCertMarkdown(worker.name, requirement.label),
          );
        }
        if (requirement.kind === "email" && requirement.emailSuffix) {
          await writeDataFile(
            `emails/${worker.slug}-${requirement.emailSuffix}.txt`,
            passingEmail(worker.name, requirement.emailSuffix),
          );
        }
      }
    }

    const csvRows = ["worker,panel,collected_on,result"];
    for (const worker of roster.workers) {
      if (!worker.requirements.some((item) => item.kind === "drug_test")) {
        continue;
      }
      if (isOmitted(missing, worker.slug, "drug-test")) {
        continue;
      }
      const generated = payload.drugTests.find((row) => row.worker === worker.name);
      const result = compliantRoles.has(worker.roleId)
        ? "negative"
        : (generated?.result ?? "positive");
      csvRows.push(
        [
          worker.name,
          generated?.panel ?? "5-panel",
          generated?.collected_on ?? "2026-09-02",
          result,
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    await mkdir(path.join(getDataDir(), "tests"), { recursive: true });
    await writeDataFile("tests/test.csv", `${csvRows.join("\n")}\n`);

    return Response.json(roster);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

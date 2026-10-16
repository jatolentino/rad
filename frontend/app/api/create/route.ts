import { mkdir } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { buildRoster, isOmitted } from "@/lib/build-roster";
import { getDataDir, resetDataDir, writeDataFile } from "@/lib/data-dir";
import { emailPath, getRole, ROLES } from "@/lib/roles";
import type { CreateLlmResponse } from "@/lib/types";

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

function systemPrompt(): string {
  return [
    "You generate synthetic HR staffing clearance documents for a simulation.",
    "Invent realistic US worker names (first name + last initial, e.g. Jon C.).",
    "slugs are lowercase kebab-case of the name (jon-c).",
    "Return one worker per role in the catalog. Do not invent roles.",
    "Omit at least three required documents by listing them in missing.",
    "Do not include omitted certs, emails, or drug-test rows in those arrays.",
    "Cert markdown is a short certificate with issued and expiry dates.",
    "Emails are vendor plain text (From/To/Subject/Date/body).",
    "Every medical or lab email MUST state the actual result in one clear sentence. Never say only that results were processed.",
    "Hep B titer emails MUST say either 'Hepatitis B result: positive' (worker currently has Hepatitis B) or 'Hepatitis B result: negative' (worker does not have Hepatitis B). Include at least one positive Hep B email among generated workers.",
    "TB test emails MUST say 'TB result: positive' or 'TB result: negative'.",
    "I-9 emails MUST say whether Section 1 and Section 2 are complete.",
    "Background-check emails MUST say clear or not clear.",
    "Drug tests: worker, panel, collected_on (ISO date), result exactly 'negative' or 'positive'. Include at least one positive drug test.",
    "All content is fictional. No real SSNs.",
  ].join(" ");
}

function userPrompt(): string {
  return [
    "Role catalog (JSON):",
    JSON.stringify(catalog),
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
            "From: lab@example.com\nTo: amy.z@company.com\nSubject: Hepatitis B titer\nYour titer results have been processed.\nHepatitis B result: positive\nThe worker currently has Hepatitis B.\n",
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

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.8,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: userPrompt() },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return Response.json(
        { error: "OpenAI returned an empty response." },
        { status: 502 },
      );
    }

    const payload = JSON.parse(text) as CreateLlmResponse;
    const { roster, missing } = buildRoster(payload);

    await resetDataDir();
    await writeDataFile("roster.json", `${JSON.stringify(roster, null, 2)}\n`);

    for (const cert of payload.certs) {
      const roleWorker = roster.workers.find((worker) => worker.slug === cert.slug);
      if (!roleWorker) {
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
      if (!worker) {
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

    const csvRows = ["worker,panel,collected_on,result"];
    for (const row of payload.drugTests) {
      const worker = roster.workers.find((item) => item.name === row.worker);
      if (!worker) {
        continue;
      }
      if (isOmitted(missing, worker.slug, "drug-test")) {
        continue;
      }
      if (!worker.requirements.some((item) => item.kind === "drug_test")) {
        continue;
      }
      csvRows.push(
        [row.worker, row.panel, row.collected_on, row.result]
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

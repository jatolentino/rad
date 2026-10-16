import type { SimRequirement } from "@/lib/types";

export function isInfectionScreen(name: string): boolean {
  return /\b(hep(?:atitis)?(?:\s*b)?|tb|tuberculosis)\b/i.test(name);
}

export function statusLabel(requirement?: SimRequirement): string | null {
  const value = requirement?.status;
  if (typeof value !== "string" || !value) {
    return null;
  }
  return value;
}

export function requirementClears(requirement?: SimRequirement): boolean {
  const value = statusLabel(requirement)?.toLowerCase();
  if (!value || !requirement) {
    return false;
  }
  if (isInfectionScreen(requirement.name)) {
    return value === "negative";
  }
  return value === "approved";
}

export function resultTone(status?: string | null): string {
  if (!status) {
    return "text-slate-400";
  }
  const value = status.toLowerCase();
  if (value === "approved" || value === "negative") {
    return "text-emerald-700";
  }
  if (
    value === "positive" ||
    value === "denied" ||
    value === "not approved" ||
    value === "missing"
  ) {
    return "text-red-700";
  }
  return "text-slate-600";
}

export type RequirementKind = "cert" | "drug_test" | "email";

export type Requirement = {
  id: string;
  label: string;
  kind: RequirementKind;
  /** Folder under data/certs/<category>/ */
  certCategory?: string;
  /** Email filename uses `${slug}-${emailSuffix}.txt` */
  emailSuffix?: string;
};

export type Role = {
  id: string;
  title: string;
  requirements: Requirement[];
};

export const ROLES: Role[] = [
  {
    id: "forklift-operator",
    title: "Forklift operator",
    requirements: [
      {
        id: "forklift-cert",
        label: "Forklift cert",
        kind: "cert",
        certCategory: "forklift",
      },
      { id: "drug-test", label: "Drug test", kind: "drug_test" },
      { id: "i9", label: "I-9", kind: "email", emailSuffix: "i9" },
    ],
  },
  {
    id: "registered-nurse",
    title: "Registered nurse",
    requirements: [
      {
        id: "nursing-license",
        label: "Nursing license",
        kind: "cert",
        certCategory: "nursing-license",
      },
      { id: "cpr", label: "CPR cert", kind: "cert", certCategory: "cpr" },
      { id: "drug-test", label: "Drug test", kind: "drug_test" },
    ],
  },
  {
    id: "warehouse-associate",
    title: "Warehouse associate",
    requirements: [
      {
        id: "osha-10",
        label: "OSHA 10",
        kind: "cert",
        certCategory: "osha-10",
      },
      { id: "drug-test", label: "Drug test", kind: "drug_test" },
      { id: "i9", label: "I-9", kind: "email", emailSuffix: "i9" },
    ],
  },
  {
    id: "cdl-truck-driver",
    title: "CDL truck driver",
    requirements: [
      { id: "cdl", label: "CDL", kind: "cert", certCategory: "cdl" },
      {
        id: "dot-physical",
        label: "DOT physical",
        kind: "cert",
        certCategory: "dot-physical",
      },
      { id: "drug-test", label: "Drug test", kind: "drug_test" },
    ],
  },
  {
    id: "cna",
    title: "Certified nursing assistant",
    requirements: [
      { id: "cna-cert", label: "CNA cert", kind: "cert", certCategory: "cna" },
      { id: "cpr", label: "CPR cert", kind: "cert", certCategory: "cpr" },
      { id: "tb-test", label: "TB test", kind: "email", emailSuffix: "tb" },
    ],
  },
  {
    id: "electrician",
    title: "Electrician",
    requirements: [
      {
        id: "electrical-license",
        label: "Electrical license",
        kind: "cert",
        certCategory: "electrical-license",
      },
      {
        id: "osha-10",
        label: "OSHA 10",
        kind: "cert",
        certCategory: "osha-10",
      },
      { id: "i9", label: "I-9", kind: "email", emailSuffix: "i9" },
    ],
  },
  {
    id: "security-officer",
    title: "Security officer",
    requirements: [
      {
        id: "guard-license",
        label: "Guard license",
        kind: "cert",
        certCategory: "guard-license",
      },
      {
        id: "background-check",
        label: "Background check",
        kind: "email",
        emailSuffix: "background",
      },
      { id: "i9", label: "I-9", kind: "email", emailSuffix: "i9" },
    ],
  },
  {
    id: "phlebotomist",
    title: "Phlebotomist",
    requirements: [
      {
        id: "phlebotomy-cert",
        label: "Phlebotomy cert",
        kind: "cert",
        certCategory: "phlebotomy",
      },
      {
        id: "hep-b",
        label: "Hep B titer",
        kind: "email",
        emailSuffix: "hep-b",
      },
      { id: "drug-test", label: "Drug test", kind: "drug_test" },
    ],
  },
  {
    id: "hvac-technician",
    title: "HVAC technician",
    requirements: [
      {
        id: "epa-608",
        label: "EPA 608",
        kind: "cert",
        certCategory: "epa-608",
      },
      {
        id: "background-check",
        label: "Background check",
        kind: "email",
        emailSuffix: "background",
      },
      { id: "i9", label: "I-9", kind: "email", emailSuffix: "i9" },
    ],
  },
  {
    id: "home-health-aide",
    title: "Home health aide",
    requirements: [
      { id: "hha-cert", label: "HHA cert", kind: "cert", certCategory: "hha" },
      { id: "cpr", label: "CPR cert", kind: "cert", certCategory: "cpr" },
      {
        id: "background-check",
        label: "Background check",
        kind: "email",
        emailSuffix: "background",
      },
    ],
  },
];

export function getRole(id: string): Role | undefined {
  return ROLES.find((role) => role.id === id);
}

export function certPath(category: string, slug: string): string {
  return `certs/${category}/${slug}.md`;
}

export function emailPath(slug: string, suffix: string): string {
  return `emails/${slug}-${suffix}.txt`;
}

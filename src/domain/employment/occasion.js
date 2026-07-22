const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function slugifyEmploymentValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createEmploymentOccasionId({
  employerId,
  employer,
  roleId,
  role,
  startDate,
}) {
  return [
    employerId || slugifyEmploymentValue(employer) || "unassigned-employer",
    roleId || slugifyEmploymentValue(role) || "unassigned-role",
    slugifyEmploymentValue(startDate) || "legacy",
  ].join("-");
}

export function normalizeEmploymentGroup(input = {}) {
  const employerId =
    input.employerId ||
    input.companyId ||
    slugifyEmploymentValue(input.employer || input.company) ||
    "unassigned-employer";
  const roleId =
    input.roleId || slugifyEmploymentValue(input.role) || "unassigned-role";
  const startDate = input.startDate || "";

  return {
    employerId,
    employer: input.employer || input.company || "Unassigned employer",
    roleId,
    role: input.role || "Unassigned role",
    occasionId:
      input.occasionId ||
      createEmploymentOccasionId({ employerId, roleId, startDate }),
    startDate,
    endDate: input.endDate || "",
  };
}

function formatPeriodValue(value) {
  if (!value) return "";
  if (String(value).toLowerCase() === "present") return "Present";
  const [year, month] = String(value).split("-");
  if (!month) return year;
  const monthName = MONTHS[Number(month) - 1];
  return monthName ? `${monthName} ${year}` : String(value);
}

export function formatEmploymentPeriod(startDate, endDate) {
  const start = formatPeriodValue(startDate);
  const end = formatPeriodValue(endDate);
  if (!start && !end) return "Period not set";
  return [start || "Unknown", end || "Present"].join(" – ");
}

export function createEmploymentContext(input = {}, additionalMetadata = {}) {
  const employment = normalizeEmploymentGroup(input);
  const { endDate, ...employmentMetadata } = employment;
  const ongoing = !endDate || endDate.toLowerCase() === "present";
  return {
    type: "employment",
    key: employment.occasionId,
    label: `${employment.employer} · ${employment.role} · ${formatEmploymentPeriod(employment.startDate, employment.endDate)}`,
    metadata: {
      ...additionalMetadata,
      company: employment.employer,
      companyId: employment.employerId,
      ...employmentMetadata,
      ...(ongoing ? {} : { endDate }),
    },
  };
}

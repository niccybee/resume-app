export const JSON_RESUME_ADAPTER = "json-resume";
export const JSON_RESUME_ADAPTER_VERSION = "1";
export const JSON_RESUME_SCHEMA_URL = "https://raw.githubusercontent.com/jsonresume/jsonresume.org/master/packages/schema/schema.json";

export class CompositionAdapterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CompositionAdapterError";
    this.code = code;
  }
}

const KIND_BY_SECTION = {
  experience: "experience",
  skills: "skill",
  certifications: "certification",
  education: "education",
  interests: "interest",
};

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) =>
    item !== undefined && item !== null && item !== ""));
}

function pick(source, keys) {
  return compactObject(Object.fromEntries(keys.map((key) => [key, source?.[key]])));
}

function cleanBasics(revision) {
  const source = revision.profile?.basics || {};
  const basics = pick(source, ["name", "label", "image", "email", "phone", "url"]);
  const summary = revision.summary === undefined || revision.summary === null
    ? source.summary
    : revision.summary;
  if (summary) basics.summary = summary;
  if (source.location && typeof source.location === "object") {
    const location = pick(source.location, ["address", "postalCode", "city", "countryCode", "region"]);
    if (Object.keys(location).length) basics.location = location;
  }
  if (Array.isArray(source.profiles)) {
    basics.profiles = source.profiles.map((profile) => pick(profile, ["network", "username", "url"]));
  }
  return basics;
}

function validCalendarDate(value) {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match) return false;
  if (!match[2]) return true;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return false;
  if (!match[3]) return true;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(Number(match[1]), month - 1, day));
  return day >= 1
    && date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function exportDate(value, path, { ongoing = false } = {}) {
  const normalized = String(value || "").trim();
  if (!normalized || (ongoing && normalized.toLowerCase() === "present")) return undefined;
  if (!validCalendarDate(normalized)) {
    throw new CompositionAdapterError(
      "validation-failed",
      `${path} must use YYYY, YYYY-MM, or YYYY-MM-DD precision.`,
    );
  }
  return normalized;
}

function orderedSelections(revision, kind) {
  return (revision.selections || [])
    .filter((selection) => (selection.block?.kind || KIND_BY_SECTION[selection.section]) === kind)
    .sort((left, right) => left.order - right.order);
}

function workEntries(revision) {
  const occasions = new Map();
  for (const selection of orderedSelections(revision, "experience")) {
    const context = selection.block?.contexts?.find((item) => item.type === "employment");
    const employment = {
      ...(context?.metadata || {}),
      ...(selection.group || {}),
    };
    const content = selection.content || {};
    const name = employment.employer || employment.company || content.name;
    const position = employment.role || content.position;
    const startDate = employment.startDate || content.startDate;
    const occasionId = employment.occasionId || context?.key
      || [name, position, startDate].map((value) => String(value || "")).join("|");
    if (!occasions.has(occasionId)) {
      occasions.set(occasionId, compactObject({
        name,
        location: employment.location,
        description: employment.description,
        position,
        url: employment.url || content.url,
        startDate: exportDate(startDate, `work[${occasions.size}].startDate`),
        endDate: exportDate(employment.endDate || content.endDate, `work[${occasions.size}].endDate`, { ongoing: true }),
        summary: employment.summary || content.summary,
        highlights: [],
      }));
    }
    const highlight = String(content.text || "").trim();
    if (!highlight) {
      throw new CompositionAdapterError("validation-failed", "Every selected Experience Block requires a text highlight.");
    }
    occasions.get(occasionId).highlights.push(highlight);
  }
  return [...occasions.values()];
}

function sidebarEntries(revision, kind, fields, dateFields = []) {
  return orderedSelections(revision, kind).map((selection, index) => {
    const entry = pick(selection.content || {}, fields);
    for (const field of dateFields) {
      const value = exportDate(entry[field], `${kind}[${index}].${field}`);
      if (value === undefined) delete entry[field];
      else entry[field] = value;
    }
    return entry;
  });
}

function exportJsonResumeV1(revision) {
  if (!revision || typeof revision !== "object") {
    throw new CompositionAdapterError("validation-failed", "An immutable CV Revision is required for export.");
  }
  return {
    $schema: JSON_RESUME_SCHEMA_URL,
    basics: cleanBasics(revision),
    work: workEntries(revision),
    skills: sidebarEntries(revision, "skill", ["name", "level", "keywords"]),
    certificates: sidebarEntries(revision, "certification", ["name", "date", "url", "issuer"], ["date"]),
    education: sidebarEntries(
      revision,
      "education",
      ["institution", "url", "area", "studyType", "startDate", "endDate", "score", "courses"],
      ["startDate", "endDate"],
    ),
    interests: sidebarEntries(revision, "interest", ["name", "keywords"]),
  };
}

const ADAPTERS = {
  [JSON_RESUME_ADAPTER]: {
    [JSON_RESUME_ADAPTER_VERSION]: exportJsonResumeV1,
  },
};

export function exportCvRevision({
  revision,
  adapter = JSON_RESUME_ADAPTER,
  adapterVersion = JSON_RESUME_ADAPTER_VERSION,
} = {}) {
  const versions = ADAPTERS[adapter];
  if (!versions) throw new CompositionAdapterError("unsupported-adapter", `Unsupported CV Composition adapter: ${adapter}`);
  const exportRevision = versions[adapterVersion];
  if (!exportRevision) {
    throw new CompositionAdapterError(
      "unsupported-schema-version",
      `Unsupported ${adapter} adapter version: ${adapterVersion}`,
    );
  }
  return {
    adapter,
    adapterVersion,
    payload: exportRevision(revision),
  };
}

export const BLOCK_SCHEMA_VERSION = "1";

const BLOCK_DATE_PATTERN = /^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/;

export function isSupportedBlockDate(value) {
  if (typeof value !== "string" || !BLOCK_DATE_PATTERN.test(value)) return false;
  const [yearText, monthText, dayText] = value.split("-");
  if (!dayText) return true;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

export const BLOCK_SCHEMA_REGISTRY = {
  "1": {
    experience: {
      required: { text: "string" },
      optional: {},
    },
    skill: {
      required: { name: "string" },
      optional: { level: "string", keywords: "string[]" },
    },
    certification: {
      required: { name: "string" },
      optional: { issuer: "string", date: "string", url: "string" },
    },
    education: {
      required: { institution: "string" },
      optional: { url: "string", area: "string", studyType: "string", startDate: "string", endDate: "string", score: "string", courses: "string[]" },
    },
    interest: {
      required: { name: "string" },
      optional: { keywords: "string[]" },
    },
  },
};

class BlockSchemaError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BlockSchemaError";
    this.code = code;
  }
}

function matchesType(value, type) {
  if (type === "string") return typeof value === "string";
  if (type === "string[]") return Array.isArray(value) && value.every((item) => typeof item === "string");
  return false;
}

export function validateBlockContent({ kind, schemaVersion = BLOCK_SCHEMA_VERSION, content }) {
  const version = BLOCK_SCHEMA_REGISTRY[schemaVersion];
  if (!version) {
    throw new BlockSchemaError(
      "unsupported-schema-version",
      `Unsupported CV Block schema version: ${schemaVersion}`,
    );
  }
  const schema = version[kind];
  if (!schema) throw new BlockSchemaError("invalid-kind", `Unsupported block kind: ${kind}`);
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new BlockSchemaError("invalid-content", "Block content must be a structured object.");
  }
  const supportedFields = new Set([
    ...Object.keys(schema.required),
    ...Object.keys(schema.optional),
  ]);
  const unsupportedField = Object.keys(content).find((field) => !supportedFields.has(field));
  if (unsupportedField) {
    throw new BlockSchemaError(
      "invalid-content",
      `${kind} content field ${unsupportedField} is not supported by schema version ${schemaVersion}.`,
    );
  }
  for (const [field, type] of Object.entries(schema.required)) {
    if (!matchesType(content[field], type) || (type === "string" && !content[field].trim())) {
      throw new BlockSchemaError("invalid-content", `${kind} content requires a non-empty ${field}.`);
    }
  }
  for (const [field, type] of Object.entries(schema.optional)) {
    if (content[field] !== undefined && !matchesType(content[field], type)) {
      throw new BlockSchemaError("invalid-content", `${kind} content field ${field} must be ${type}.`);
    }
  }
  const dateFields = kind === "certification"
    ? ["date"]
    : kind === "education"
      ? ["startDate", "endDate"]
      : [];
  for (const field of dateFields) {
    if (content[field] !== undefined && !isSupportedBlockDate(content[field])) {
      throw new BlockSchemaError(
        "invalid-content",
        `${kind} content field ${field} must use YYYY, YYYY-MM, or YYYY-MM-DD format.`,
      );
    }
  }
  return content;
}

export function blockSchema(kind, schemaVersion = BLOCK_SCHEMA_VERSION) {
  const version = BLOCK_SCHEMA_REGISTRY[schemaVersion];
  if (!version) throw new BlockSchemaError("unsupported-schema-version", `Unsupported CV Block schema version: ${schemaVersion}`);
  if (!version[kind]) throw new BlockSchemaError("invalid-kind", `Unsupported block kind: ${kind}`);
  return { kind, schemaVersion, ...version[kind] };
}

export const BLOCK_SCHEMA_VERSION = "1";

export const BLOCK_SCHEMA_REGISTRY = {
  "1": {
    experience: {
    required: { text: "string" },
    optional: { name: "string", position: "string", url: "string", startDate: "string", endDate: "string", summary: "string", highlights: "string[]" },
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
  return content;
}

export function blockSchema(kind, schemaVersion = BLOCK_SCHEMA_VERSION) {
  const version = BLOCK_SCHEMA_REGISTRY[schemaVersion];
  if (!version) throw new BlockSchemaError("unsupported-schema-version", `Unsupported CV Block schema version: ${schemaVersion}`);
  if (!version[kind]) throw new BlockSchemaError("invalid-kind", `Unsupported block kind: ${kind}`);
  return { kind, schemaVersion, ...version[kind] };
}

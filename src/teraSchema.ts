export type TeraStructuredBlockTag = "meta" | "route" | "ai";

export type FieldValueKind =
  | "string"
  | "boolean"
  | "enum"
  | "string-or-list"
  | "enum-or-string"
  | "boolean-or-auto"
  | "string-list-or-auto"
  | "object"
  | "any";

export interface FieldDefinition {
  key: string;
  aliases?: readonly string[];
  description: string;
  detail?: string;
  kind: FieldValueKind;
  values?: readonly string[];
  children?: readonly FieldDefinition[];
  useListSnippet?: boolean;
}

export interface BlockDefinition {
  tag: TeraStructuredBlockTag;
  description: string;
  fields: readonly FieldDefinition[];
  allowUnknownTopLevel?: boolean;
}

const HYDRATION_MODES = ["eager", "visible", "idle", "interaction", "none", "ai"] as const;
const PRIORITY_VALUES = ["low", "normal", "high"] as const;

const META_FIELDS: readonly FieldDefinition[] = [
  {
    key: "title",
    description: "Page title metadata.",
    detail: "Rendered as the document title and used by route metadata merging.",
    kind: "string"
  },
  {
    key: "description",
    description: "Page description metadata.",
    detail: "Used for the standard description meta tag.",
    kind: "string"
  },
  {
    key: "keywords",
    description: "Keywords metadata.",
    detail: "Accepts a string or an indented list.",
    kind: "string-or-list",
    useListSnippet: true
  },
  {
    key: "aiSummary",
    aliases: ["ai-summary"],
    description: "AI summary override for generated metadata.",
    detail: "Use `auto` to let Terajs derive the summary, or provide a literal string.",
    kind: "enum-or-string",
    values: ["auto"]
  },
  {
    key: "aiKeywords",
    aliases: ["ai-keywords"],
    description: "AI keyword override metadata.",
    detail: "Use `auto` or provide an indented list of keywords.",
    kind: "string-list-or-auto",
    values: ["auto"],
    useListSnippet: true
  },
  {
    key: "aiAltText",
    aliases: ["ai-alt-text"],
    description: "Controls AI-assisted image alt text generation.",
    detail: "Accepts `auto`, `true`, or `false`.",
    kind: "boolean-or-auto",
    values: ["auto", "true", "false"]
  },
  {
    key: "schema",
    description: "Structured metadata payload.",
    detail: "Free-form structured metadata. Nested custom keys are allowed.",
    kind: "any"
  },
  {
    key: "analytics",
    description: "Analytics metadata group.",
    detail: "Controls tracking flags and analytics event names.",
    kind: "object",
    children: [
      {
        key: "track",
        description: "Enables or disables analytics tracking.",
        kind: "boolean",
        values: ["true", "false"]
      },
      {
        key: "events",
        description: "Analytics event names.",
        detail: "Use a string or an indented list.",
        kind: "string-or-list",
        useListSnippet: true
      }
    ]
  },
  {
    key: "performance",
    description: "Performance metadata group.",
    detail: "Hints used by Terajs rendering and hydration layers.",
    kind: "object",
    children: [
      {
        key: "priority",
        description: "Rendering priority hint.",
        kind: "enum",
        values: PRIORITY_VALUES
      },
      {
        key: "hydrate",
        description: "Hydration strategy override.",
        kind: "enum",
        values: HYDRATION_MODES
      },
      {
        key: "cache",
        description: "Cache policy hint.",
        kind: "string"
      },
      {
        key: "edge",
        description: "Marks the route as edge-friendly.",
        kind: "boolean",
        values: ["true", "false"]
      }
    ]
  },
  {
    key: "a11y",
    description: "Accessibility automation settings.",
    kind: "object",
    children: [
      {
        key: "autoAlt",
        aliases: ["auto-alt"],
        description: "Auto-generate image alt text where possible.",
        kind: "boolean",
        values: ["true", "false"]
      },
      {
        key: "autoLabel",
        aliases: ["auto-label"],
        description: "Auto-generate labels for common controls.",
        kind: "boolean",
        values: ["true", "false"]
      },
      {
        key: "autoLandmarks",
        aliases: ["auto-landmarks"],
        description: "Auto-generate landmark roles where possible.",
        kind: "boolean",
        values: ["true", "false"]
      }
    ]
  },
  {
    key: "i18n",
    description: "Internationalization metadata group.",
    kind: "object",
    children: [
      {
        key: "languages",
        description: "Supported languages.",
        detail: "Use a string or an indented list.",
        kind: "string-or-list",
        useListSnippet: true
      },
      {
        key: "autoTranslate",
        aliases: ["auto-translate"],
        description: "Allow automatic translation workflows.",
        kind: "boolean",
        values: ["true", "false"]
      }
    ]
  }
];

const ROUTE_FIELDS: readonly FieldDefinition[] = [
  {
    key: "path",
    description: "Explicit route path override.",
    detail: "If omitted, Terajs derives the route path from the file path.",
    kind: "string"
  },
  {
    key: "layout",
    description: "Route layout id.",
    kind: "string"
  },
  {
    key: "mountTarget",
    aliases: ["mount-target"],
    description: "DOM mount target id for the route.",
    kind: "string"
  },
  {
    key: "middleware",
    description: "Middleware ids to apply to the route.",
    detail: "Use a single string or an indented list.",
    kind: "string-or-list",
    useListSnippet: true
  },
  {
    key: "prerender",
    description: "Enables or disables prerendering.",
    kind: "boolean",
    values: ["true", "false"]
  },
  {
    key: "hydrate",
    description: "Hydration strategy for the route.",
    kind: "enum",
    values: HYDRATION_MODES
  },
  {
    key: "edge",
    description: "Marks the route as edge-compatible.",
    kind: "boolean",
    values: ["true", "false"]
  }
];

const AI_FIELDS: readonly FieldDefinition[] = [
  {
    key: "summary",
    description: "Short AI-facing summary of the component or route.",
    kind: "string"
  },
  {
    key: "intent",
    description: "Primary user or product intent for the surface.",
    kind: "string"
  },
  {
    key: "audience",
    description: "Target audience descriptor.",
    kind: "string"
  },
  {
    key: "tags",
    description: "AI tags for classification and retrieval.",
    kind: "string-or-list",
    useListSnippet: true
  },
  {
    key: "keywords",
    description: "AI keywords for indexing or prompt shaping.",
    kind: "string-or-list",
    useListSnippet: true
  }
];

const BLOCKS: Record<TeraStructuredBlockTag, BlockDefinition> = {
  meta: {
    tag: "meta",
    description: "Route and page metadata block.",
    fields: META_FIELDS,
    allowUnknownTopLevel: true
  },
  route: {
    tag: "route",
    description: "Route override block.",
    fields: ROUTE_FIELDS,
    allowUnknownTopLevel: false
  },
  ai: {
    tag: "ai",
    description: "Instructional AI metadata block.",
    fields: AI_FIELDS,
    allowUnknownTopLevel: false
  }
};

export function getBlockDefinition(tag: TeraStructuredBlockTag): BlockDefinition {
  return BLOCKS[tag];
}

export function findFieldDefinition(
  fields: readonly FieldDefinition[],
  key: string
): FieldDefinition | undefined {
  return fields.find((field) => {
    return field.key === key || field.aliases?.includes(key);
  });
}

export function describeFieldType(field: FieldDefinition): string {
  switch (field.kind) {
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "enum":
      return `one of ${field.values?.join(", ") ?? "the documented values"}`;
    case "string-or-list":
      return "string or indented list";
    case "enum-or-string":
      return `string${field.values?.length ? ` or ${field.values.join("/")}` : ""}`;
    case "boolean-or-auto":
      return "true, false, or auto";
    case "string-list-or-auto":
      return "auto, string, or indented list";
    case "object":
      return "nested object";
    case "any":
      return "custom structured value";
  }
}
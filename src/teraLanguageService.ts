import * as vscode from "vscode";
import {
  describeFieldType,
  findFieldDefinition,
  getBlockDefinition,
  type BlockDefinition,
  type FieldDefinition,
  type TeraStructuredBlockTag
} from "./teraSchema";

type TeraBlockTag = TeraStructuredBlockTag | "template" | "script" | "style";

interface TeraBlock {
  tag: TeraBlockTag;
  attrs: string;
  openStart: number;
  openEnd: number;
  contentStart: number;
  contentEnd: number;
  closeStart: number;
  closeEnd: number;
  fullStart: number;
  fullEnd: number;
  content: string;
}

interface RawTeraDiagnostic {
  message: string;
  start: number;
  end: number;
  severity: vscode.DiagnosticSeverity;
}

interface ContextFrame {
  indent: number;
  path: string[];
  field: FieldDefinition | null;
  block: BlockDefinition;
  allowsPairs: boolean;
  allowsList: boolean;
  allowUnknownKeys: boolean;
}

interface ParsedStructuredLine {
  absoluteStart: number;
  absoluteEnd: number;
  text: string;
  indent: number;
  trimmed: string;
  kind: "blank" | "comment" | "pair" | "list" | "invalid";
  path: string[];
  field: FieldDefinition | null;
  parentField: FieldDefinition | null;
  key?: string;
  keyStart?: number;
  keyEnd?: number;
  value?: string;
  valueStart?: number;
  valueEnd?: number;
  opensContainer: boolean;
  allowsPairs: boolean;
  allowsList: boolean;
  allowUnknownKeys: boolean;
}

interface StructuredBlockAnalysis {
  lines: ParsedStructuredLine[];
  diagnostics: RawTeraDiagnostic[];
}

interface TeraDocumentAnalysis {
  blocks: TeraBlock[];
  diagnostics: RawTeraDiagnostic[];
  structuredBlocks: Map<number, StructuredBlockAnalysis>;
}

const BLOCK_PATTERN = /<(template|script|style|meta|route|ai)\b([^>]*)>/gi;
const SUPPORTED_TAGS: readonly TeraBlockTag[] = ["template", "script", "style", "meta", "route", "ai"];
const STRUCTURED_TAGS = new Set<TeraStructuredBlockTag>(["meta", "route", "ai"]);
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
const ANALYSIS_CACHE = new Map<string, { version: number; analysis: TeraDocumentAnalysis }>();

export function registerTeraLanguageFeatures(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = [{ language: "tera" }];
  const diagnostics = vscode.languages.createDiagnosticCollection("tera");

  const refreshDiagnostics = (document: vscode.TextDocument) => {
    if (!isTeraDocument(document)) {
      return;
    }

    const analysis = getAnalysis(document);
    diagnostics.set(document.uri, analysis.diagnostics.map((entry) => {
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(document.positionAt(entry.start), document.positionAt(entry.end)),
        entry.message,
        entry.severity
      );
      diagnostic.source = "Terajs .tera Tools";
      return diagnostic;
    }));
  };

  for (const document of vscode.workspace.textDocuments) {
    refreshDiagnostics(document);
  }

  context.subscriptions.push(
    diagnostics,
    vscode.workspace.onDidOpenTextDocument(refreshDiagnostics),
    vscode.workspace.onDidChangeTextDocument((event) => {
      ANALYSIS_CACHE.delete(event.document.uri.toString());
      refreshDiagnostics(event.document);
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      ANALYSIS_CACHE.delete(document.uri.toString());
      diagnostics.delete(document.uri);
    })
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, {
      provideHover(document, position) {
        const analysis = getAnalysis(document);
        const offset = document.offsetAt(position);
        const block = findBlockAtOffset(analysis.blocks, offset);
        if (!block || !STRUCTURED_TAGS.has(block.tag as TeraStructuredBlockTag)) {
          return undefined;
        }

        const structured = analysis.structuredBlocks.get(block.fullStart);
        if (!structured) {
          return undefined;
        }

        const line = findLineAtOffset(structured.lines, offset);
        if (!line) {
          return undefined;
        }

        const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][\w:-]*/);
        const word = wordRange ? document.getText(wordRange) : "";

        if (line.kind === "pair" && line.keyStart !== undefined && line.keyEnd !== undefined) {
          if (offset >= line.keyStart && offset <= line.keyEnd) {
            return buildFieldHover(block.tag as TeraStructuredBlockTag, line.field, line.key);
          }

          if (line.valueStart !== undefined && line.valueEnd !== undefined && offset >= line.valueStart && offset <= line.valueEnd) {
            return buildFieldHover(block.tag as TeraStructuredBlockTag, line.field, line.key, word);
          }
        }

        if (block.tag === "meta" && (word.startsWith("og:") || word.startsWith("twitter:"))) {
          const markdown = new vscode.MarkdownString();
          markdown.appendMarkdown(`**${word}**\n\nCustom social metadata key inside the \`<meta>\` block.`);
          markdown.appendMarkdown("\n\nTerajs forwards unknown top-level meta keys so Open Graph and Twitter-style tags can live beside typed metadata.");
          return new vscode.Hover(markdown, wordRange ?? undefined);
        }

        return undefined;
      }
    }),
    vscode.languages.registerCompletionItemProvider(selector, {
      provideCompletionItems(document, position) {
        const analysis = getAnalysis(document);
        const offset = document.offsetAt(position);
        const block = findBlockAtOffset(analysis.blocks, offset);
        if (!block || !STRUCTURED_TAGS.has(block.tag as TeraStructuredBlockTag)) {
          return undefined;
        }

        const structured = analysis.structuredBlocks.get(block.fullStart);
        if (!structured) {
          return undefined;
        }

        const definition = getBlockDefinition(block.tag as TeraStructuredBlockTag);
        const line = findLineAtOffset(structured.lines, offset);
        if (!line) {
          return undefined;
        }

        const beforeCursor = line.text.slice(0, Math.max(0, offset - line.absoluteStart));
        const indent = measureIndent(line.text.match(/^[ \t]*/)?.[0] ?? "");
        const parent = resolveContextBeforeLine(definition, structured.lines, line, indent);
        const colonIndex = beforeCursor.indexOf(":");
        const isListContext = beforeCursor.trimStart().startsWith("- ");
        const isValueContext = colonIndex !== -1 && offset > line.absoluteStart + colonIndex + 1;

        if (!isValueContext && !isListContext) {
          const fields = parent.field?.children ?? (parent.path.length === 0 ? definition.fields : []);
          if (fields.length === 0) {
            return undefined;
          }

          const replaceStart = line.absoluteStart + (line.text.match(/^[ \t]*/)?.[0].length ?? 0);
          const replaceEnd = line.kind === "pair" && line.keyEnd !== undefined && offset <= (line.keyEnd + 1)
            ? line.keyEnd
            : offset;
          const range = new vscode.Range(document.positionAt(replaceStart), document.positionAt(replaceEnd));
          return fields.map((field) => buildKeyCompletionItem(field, range, line.text.match(/^[ \t]*/)?.[0] ?? ""));
        }

        if (!isValueContext) {
          return undefined;
        }

        const keyText = beforeCursor.slice(0, colonIndex).trim();
        const field = resolveFieldForContext(parent, keyText);
        if (!field) {
          return undefined;
        }

        const valueStart = line.absoluteStart + colonIndex + 1 + (line.text.slice(colonIndex + 1).match(/^[ \t]*/)?.[0].length ?? 0);
        const valueRange = new vscode.Range(document.positionAt(valueStart), position);
        return buildValueCompletionItems(field, valueRange);
      }
    }, ":")
  );
}

function isTeraDocument(document: vscode.TextDocument): boolean {
  return document.languageId === "tera" || document.fileName.endsWith(".tera");
}

function getAnalysis(document: vscode.TextDocument): TeraDocumentAnalysis {
  const cacheKey = document.uri.toString();
  const cached = ANALYSIS_CACHE.get(cacheKey);
  if (cached && cached.version === document.version) {
    return cached.analysis;
  }

  const analysis = analyzeTeraSource(document.getText());
  ANALYSIS_CACHE.set(cacheKey, {
    version: document.version,
    analysis
  });
  return analysis;
}

function analyzeTeraSource(source: string): TeraDocumentAnalysis {
  const blocks = findBlocks(source);
  const diagnostics: RawTeraDiagnostic[] = [];
  const structuredBlocks = new Map<number, StructuredBlockAnalysis>();

  pushDuplicateBlockDiagnostics(blocks, diagnostics);
  pushUnclosedBlockDiagnostics(source, blocks, diagnostics);

  for (const block of blocks) {
    if (block.tag === "template") {
      diagnostics.push(...validateTemplateBlock(block));
      continue;
    }

    if (STRUCTURED_TAGS.has(block.tag as TeraStructuredBlockTag)) {
      const structured = analyzeStructuredBlock(block);
      structuredBlocks.set(block.fullStart, structured);
      diagnostics.push(...structured.diagnostics);
    }
  }

  return {
    blocks,
    diagnostics,
    structuredBlocks
  };
}

function findBlocks(source: string): TeraBlock[] {
  const blocks: TeraBlock[] = [];
  // Match only the opening tag to begin with
  const openPattern = /<(template|script|style|meta|route|ai)\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = openPattern.exec(source)) !== null) {
    const tag = match[1] as TeraBlockTag;
    const attrs = match[2] ?? "";
    const openStart = match.index;
    const openEnd = openStart + match[0].length;
    
    // Search for the next closing tag for this specific block name
    const closeTagStr = `</${tag}>`;
    let closeStart = source.indexOf(closeTagStr, openEnd);
    
    // If no closing tag is found (user is currently typing),
    // treat the rest of the file as content so features don't break.
    const isUnclosed = closeStart === -1;
    if (isUnclosed) {
      closeStart = source.length;
    }

    blocks.push({
      tag,
      attrs,
      openStart,
      openEnd,
      contentStart: openEnd,
      contentEnd: closeStart,
      closeStart,
      closeEnd: isUnclosed ? source.length : closeStart + closeTagStr.length,
      fullStart: openStart,
      fullEnd: isUnclosed ? source.length : closeStart + closeTagStr.length,
      content: source.slice(openEnd, closeStart)
    });
  }
  return blocks.sort((left, right) => left.fullStart - right.fullStart);
}

function pushDuplicateBlockDiagnostics(blocks: readonly TeraBlock[], diagnostics: RawTeraDiagnostic[]): void {
  for (const tag of SUPPORTED_TAGS) {
    const taggedBlocks = blocks.filter((block) => block.tag === tag);
    if (taggedBlocks.length <= 1) {
      continue;
    }

    for (const duplicate of taggedBlocks.slice(1)) {
      diagnostics.push({
        message: `Only one <${tag}> block is supported per .tera file.`,
        start: duplicate.openStart,
        end: duplicate.openEnd,
        severity: vscode.DiagnosticSeverity.Error
      });
    }
  }
}

function pushUnclosedBlockDiagnostics(source: string, blocks: readonly TeraBlock[], diagnostics: RawTeraDiagnostic[]): void {
  for (const tag of SUPPORTED_TAGS) {
    const completeBlockStarts = new Set(blocks.filter((block) => block.tag === tag).map((block) => block.openStart));
    const pattern = new RegExp(`<${tag}\\b[^>]*>`, "gi");
    let match = pattern.exec(source);
    while (match) {
      const start = match.index;
      if (!completeBlockStarts.has(start)) {
        diagnostics.push({
          message: `Opening <${tag}> tag does not have a matching closing tag.`,
          start,
          end: start + match[0].length,
          severity: vscode.DiagnosticSeverity.Error
        });
      }
      match = pattern.exec(source);
    }
  }
}

function validateTemplateBlock(block: TeraBlock): RawTeraDiagnostic[] {
  const diagnostics: RawTeraDiagnostic[] = [];
  const template = block.content;
  if (!template.trim()) {
    return diagnostics;
  }

  const emptyExpression = template.match(/\{\{\s*\}\}/);
  if (emptyExpression?.index !== undefined) {
    const start = block.contentStart + emptyExpression.index;
    diagnostics.push({
      message: "Empty reactive expression '{{ }}' found.",
      start,
      end: start + emptyExpression[0].length,
      severity: vscode.DiagnosticSeverity.Error
    });
  }

  const stack: Array<{ tag: string; absoluteIndex: number }> = [];
  const tagPattern = /<\s*(\/?)\s*([a-zA-Z0-9-]+)([^>]*?)>/g;
  let match = tagPattern.exec(template);

  while (match) {
    const isClosing = match[1] === "/";
    const tagName = match[2] ?? "";
    const attrs = match[3] ?? "";
    const absoluteIndex = block.contentStart + (match.index ?? 0);
    const normalizedTag = tagName.toLowerCase();
    const selfClosing = /\/\s*$/.test(attrs) || VOID_ELEMENTS.has(normalizedTag);

    if (isClosing) {
      const opening = stack.pop();
      if (!opening || opening.tag !== tagName) {
        diagnostics.push({
          message: `Mismatched closing tag </${tagName}> in <template>.`,
          start: absoluteIndex,
          end: absoluteIndex + match[0].length,
          severity: vscode.DiagnosticSeverity.Error
        });
      }
      match = tagPattern.exec(template);
      continue;
    }

    if (!selfClosing) {
      stack.push({
        tag: tagName,
        absoluteIndex
      });
    }

    match = tagPattern.exec(template);
  }

  for (const opening of stack) {
    diagnostics.push({
      message: `Unclosed tag <${opening.tag}> in <template>.`,
      start: opening.absoluteIndex,
      end: opening.absoluteIndex + opening.tag.length + 2,
      severity: vscode.DiagnosticSeverity.Error
    });
  }

  return diagnostics;
}

function analyzeStructuredBlock(block: TeraBlock): StructuredBlockAnalysis {
  const definition = getBlockDefinition(block.tag as TeraStructuredBlockTag);
  const diagnostics: RawTeraDiagnostic[] = [];
  const lines: ParsedStructuredLine[] = [];
  const segments = splitLines(block.content, block.contentStart);
  const stack: ContextFrame[] = [createRootContext(definition)];

  for (const segment of segments) {
    const indentText = segment.text.match(/^[ \t]*/)?.[0] ?? "";
    const indent = measureIndent(indentText);
    const trimmed = segment.text.trim();
    const parsed: ParsedStructuredLine = {
      absoluteStart: segment.start,
      absoluteEnd: segment.end,
      text: segment.text,
      indent,
      trimmed,
      kind: "blank",
      path: [],
      field: null,
      parentField: null,
      opensContainer: false,
      allowsPairs: false,
      allowsList: false,
      allowUnknownKeys: false
    };

    if (!trimmed) {
      lines.push(parsed);
      continue;
    }

    if (indentText.includes("\t")) {
      diagnostics.push({
        message: "Use spaces instead of tabs inside metadata blocks.",
        start: segment.start,
        end: segment.start + indentText.length,
        severity: vscode.DiagnosticSeverity.Warning
      });
    }

    if (trimmed.startsWith("#")) {
      parsed.kind = "comment";
      lines.push(parsed);
      continue;
    }

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    parsed.path = parent.path.slice();
    parsed.parentField = parent.field;

    if (trimmed.startsWith("- ")) {
      parsed.kind = "list";
      if (!parent.allowsList) {
        diagnostics.push({
          message: "List items are only valid under list-style fields such as keywords, middleware, events, or languages.",
          start: segment.start + indentText.length,
          end: segment.start + indentText.length + 1,
          severity: vscode.DiagnosticSeverity.Error
        });
      } else if (trimmed.slice(2).trim().length === 0) {
        diagnostics.push({
          message: "List items cannot be empty.",
          start: segment.start + indentText.length,
          end: segment.end,
          severity: vscode.DiagnosticSeverity.Error
        });
      }
      lines.push(parsed);
      continue;
    }

    const colonIndex = segment.text.indexOf(":", indentText.length);
    if (colonIndex === -1) {
      parsed.kind = "invalid";
      diagnostics.push({
        message: "Expected `key: value` syntax.",
        start: segment.start + indentText.length,
        end: segment.end,
        severity: vscode.DiagnosticSeverity.Error
      });
      lines.push(parsed);
      continue;
    }

    const rawKeyText = segment.text.slice(indentText.length, colonIndex);
    const key = rawKeyText.trim();
    const keyStart = segment.start + indentText.length + rawKeyText.indexOf(key);
    const keyEnd = keyStart + key.length;
    const valueText = segment.text.slice(colonIndex + 1).trim();
    const valueOffset = segment.text.slice(colonIndex + 1).match(/^[ \t]*/)?.[0].length ?? 0;
    const valueStart = valueText.length > 0
      ? segment.start + colonIndex + 1 + valueOffset
      : undefined;

    parsed.kind = "pair";
    parsed.key = key;
    parsed.keyStart = keyStart;
    parsed.keyEnd = keyEnd;
    parsed.value = valueText;
    parsed.valueStart = valueStart;
    parsed.valueEnd = valueStart !== undefined ? segment.end : undefined;

    if (!key) {
      diagnostics.push({
        message: "Metadata keys cannot be empty.",
        start: segment.start + indentText.length,
        end: segment.start + colonIndex + 1,
        severity: vscode.DiagnosticSeverity.Error
      });
      lines.push(parsed);
      continue;
    }

    const field = resolveFieldForContext(parent, key);
    const resolvedField = field ?? null;
    const allowsUnknown = parent.allowUnknownKeys;

    if (!field && !allowsUnknown) {
      diagnostics.push({
        message: `Unknown ${definition.tag} field '${key}'.`,
        start: keyStart,
        end: keyEnd,
        severity: vscode.DiagnosticSeverity.Warning
      });
    }

    parsed.field = resolvedField;
    parsed.path = [...parent.path, field?.key ?? key];

    if (valueText.length > 0) {
      const valueError = validateFieldValue(resolvedField, valueText, parsed.path);
      if (valueError && valueStart !== undefined) {
        diagnostics.push({
          message: valueError,
          start: valueStart,
          end: segment.end,
          severity: vscode.DiagnosticSeverity.Error
        });
      }
      lines.push(parsed);
      continue;
    }

    const container = getContainerOptions(resolvedField, allowsUnknown);
    parsed.opensContainer = container.allowsPairs || container.allowsList;
    parsed.allowsPairs = container.allowsPairs;
    parsed.allowsList = container.allowsList;
    parsed.allowUnknownKeys = container.allowUnknownKeys;

    if (parsed.opensContainer) {
      stack.push({
        indent,
        path: parsed.path,
        field: resolvedField,
        block: definition,
        allowsPairs: parsed.allowsPairs,
        allowsList: parsed.allowsList,
        allowUnknownKeys: parsed.allowUnknownKeys
      });
    }

    lines.push(parsed);
  }

  return {
    lines,
    diagnostics
  };
}

function createRootContext(block: BlockDefinition): ContextFrame {
  return {
    indent: -1,
    path: [],
    field: null,
    block,
    allowsPairs: true,
    allowsList: false,
    allowUnknownKeys: block.allowUnknownTopLevel ?? false
  };
}

function getContainerOptions(field: FieldDefinition | null, allowUnknownKeys: boolean): {
  allowsPairs: boolean;
  allowsList: boolean;
  allowUnknownKeys: boolean;
} {
  if (!field) {
    return {
      allowsPairs: allowUnknownKeys,
      allowsList: allowUnknownKeys,
      allowUnknownKeys
    };
  }

  switch (field.kind) {
    case "object":
      return {
        allowsPairs: true,
        allowsList: false,
        allowUnknownKeys: false
      };
    case "string-or-list":
    case "string-list-or-auto":
      return {
        allowsPairs: false,
        allowsList: true,
        allowUnknownKeys: false
      };
    case "any":
      return {
        allowsPairs: true,
        allowsList: true,
        allowUnknownKeys: true
      };
    default:
      return {
        allowsPairs: false,
        allowsList: false,
        allowUnknownKeys: false
      };
  }
}

function resolveFieldForContext(context: ContextFrame, key: string): FieldDefinition | undefined {
  const availableFields = context.field?.children ?? (context.path.length === 0 ? context.block.fields : []);
  return findFieldDefinition(availableFields, key);
}

function validateFieldValue(field: FieldDefinition | null, value: string, path: readonly string[]): string | null {
  if (!field) {
    return null;
  }

  const normalizedValue = stripQuotes(value);

  switch (field.kind) {
    case "string":
      if (normalizedValue.length === 0) {
        return "Expected a string value.";
      }
      if (field.key === "path" && !normalizedValue.startsWith("/")) {
        return "Route paths should start with '/'.";
      }
      return null;
    case "boolean":
      return isBoolean(normalizedValue) ? null : "Expected `true` or `false`.";
    case "enum":
      return field.values?.includes(normalizedValue)
        ? null
        : `Expected one of: ${field.values?.join(", ") ?? "the documented values"}.`;
    case "enum-or-string":
      return normalizedValue.length === 0
        ? "Expected a value."
        : null;
    case "boolean-or-auto":
      return normalizedValue === "auto" || isBoolean(normalizedValue)
        ? null
        : "Expected `auto`, `true`, or `false`.";
    case "string-list-or-auto":
      return normalizedValue.length === 0
        ? "Expected `auto`, a string, or an indented list."
        : null;
    case "string-or-list":
      return normalizedValue.length === 0 ? "Expected a string or an indented list." : null;
    case "object":
      return `Field '${path[path.length - 1]}' expects indented nested entries.`;
    case "any":
      return null;
  }
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isBoolean(value: string): boolean {
  return value === "true" || value === "false";
}

function splitLines(text: string, absoluteStart: number): Array<{ text: string; start: number; end: number }> {
  const rawLines = text.split("\n");
  const lines: Array<{ text: string; start: number; end: number }> = [];
  let cursor = absoluteStart;

  for (const rawLine of rawLines) {
    const lineText = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    lines.push({
      text: lineText,
      start: cursor,
      end: cursor + lineText.length
    });
    cursor += rawLine.length + 1;
  }

  return lines;
}

function measureIndent(value: string): number {
  return value.replace(/\t/g, "  ").length;
}

function findBlockAtOffset(blocks: readonly TeraBlock[], offset: number): TeraBlock | undefined {
  return blocks.find((block) => offset >= block.fullStart && offset <= block.fullEnd);
}

function findLineAtOffset(lines: readonly ParsedStructuredLine[], offset: number): ParsedStructuredLine | undefined {
  return lines.find((line) => offset >= line.absoluteStart && offset <= line.absoluteEnd + 1);
}

function resolveContextBeforeLine(
  definition: BlockDefinition,
  lines: readonly ParsedStructuredLine[],
  currentLine: ParsedStructuredLine,
  currentIndent: number
): ContextFrame {
  const stack: ContextFrame[] = [createRootContext(definition)];

  for (const line of lines) {
    if (line.absoluteStart >= currentLine.absoluteStart) {
      break;
    }

    if (line.kind === "blank" || line.kind === "comment") {
      continue;
    }

    while (stack.length > 1 && line.indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    if (line.opensContainer) {
      stack.push({
        indent: line.indent,
        path: line.path,
        field: line.field,
        block: definition,
        allowsPairs: line.allowsPairs,
        allowsList: line.allowsList,
        allowUnknownKeys: line.allowUnknownKeys
      });
    }
  }

  while (stack.length > 1 && currentIndent <= stack[stack.length - 1].indent) {
    stack.pop();
  }

  return stack[stack.length - 1];
}

function buildFieldHover(
  blockTag: TeraStructuredBlockTag,
  field: FieldDefinition | null,
  fallbackKey?: string,
  hoveredValue?: string
): vscode.Hover | undefined {
  if (!field) {
    return undefined;
  }

  const markdown = new vscode.MarkdownString();
  markdown.appendMarkdown(`**${field.key}**`);
  markdown.appendMarkdown(`\n\n${field.description}`);
  markdown.appendMarkdown(`\n\nType: \`${describeFieldType(field)}\``);
  if (field.aliases?.length) {
    markdown.appendMarkdown(`\n\nAliases: ${field.aliases.map((alias) => `\`${alias}\``).join(", ")}`);
  }
  if (field.detail) {
    markdown.appendMarkdown(`\n\n${field.detail}`);
  }
  if (field.values?.length) {
    markdown.appendMarkdown(`\n\nAllowed values: ${field.values.map((value) => `\`${value}\``).join(", ")}`);
  }
  markdown.appendCodeblock(buildExample(field, fallbackKey ?? field.key), "yaml");
  if (hoveredValue && field.values?.includes(hoveredValue)) {
    markdown.appendMarkdown(`\n\nCurrent value \`${hoveredValue}\` is a valid ${blockTag} option.`);
  }

  return new vscode.Hover(markdown);
}

function buildExample(field: FieldDefinition, key: string): string {
  switch (field.kind) {
    case "object": {
      const childKey = field.children?.[0]?.key ?? "key";
      return `${key}:\n  ${childKey}: value`;
    }
    case "boolean":
      return `${key}: true`;
    case "enum":
      return `${key}: ${field.values?.[0] ?? "value"}`;
    case "enum-or-string":
      return `${key}: ${field.values?.[0] ?? "custom"}`;
    case "boolean-or-auto":
      return `${key}: auto`;
    case "string-list-or-auto":
      return `${key}:\n  - value`;
    case "string-or-list":
      return `${key}:\n  - value`;
    case "any":
      return `${key}:\n  nested: value`;
    case "string":
    default:
      return `${key}: value`;
  }
}

function buildKeyCompletionItem(
  field: FieldDefinition,
  range: vscode.Range,
  indentText: string
): vscode.CompletionItem {
  const item = new vscode.CompletionItem(field.key, vscode.CompletionItemKind.Property);
  item.detail = describeFieldType(field);
  item.documentation = new vscode.MarkdownString(`${field.description}\n\nType: \`${describeFieldType(field)}\``);
  item.range = range;
  item.insertText = new vscode.SnippetString(buildKeySnippet(field, indentText));
  item.filterText = [field.key, ...(field.aliases ?? [])].join(" ");
  return item;
}

function buildKeySnippet(field: FieldDefinition, indentText: string): string {
  if (field.kind === "object") {
    return `${field.key}:\n${indentText}  $0`;
  }
  if (field.useListSnippet) {
    return `${field.key}:\n${indentText}  - $0`;
  }
  return `${field.key}: $0`;
}

function buildValueCompletionItems(field: FieldDefinition, range: vscode.Range): vscode.CompletionItem[] {
  const values = new Set<string>();

  if (field.kind === "boolean") {
    values.add("true");
    values.add("false");
  }

  if (field.kind === "boolean-or-auto") {
    values.add("auto");
    values.add("true");
    values.add("false");
  }

  for (const value of field.values ?? []) {
    values.add(value);
  }

  return Array.from(values).map((value) => {
    const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Value);
    item.detail = `${field.key} value`;
    item.range = range;
    item.insertText = value;
    return item;
  });
}
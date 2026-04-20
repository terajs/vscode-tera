import * as path from "node:path";
import * as vscode from "vscode";
import type { AttachedSiteDiagnosticsPayload } from "./attachedSiteDiagnostics";

const MAX_EVIDENCE_FILES = 6;
const MAX_COMPONENT_FILES = 3;
const MAX_IMPORT_FILES = 2;
const EXCERPT_LINE_LIMIT = 180;
const EXCERPT_CONTEXT_RADIUS = 24;

interface PendingEvidenceEntry {
  uri: vscode.Uri;
  reason: string;
  focusLine?: number;
}

export interface AttachedSiteWorkspaceEvidenceFile {
  path: string;
  reason: string;
  excerpt: string;
}

export interface AttachedSiteWorkspaceEvidence {
  routePath: string | null;
  files: AttachedSiteWorkspaceEvidenceFile[];
}

/**
 * Collects likely route, layout, component, and referenced source snippets for the attached site snapshot.
 */
export async function collectAttachedSiteWorkspaceEvidence(
  payload: AttachedSiteDiagnosticsPayload,
  token?: vscode.CancellationToken
): Promise<AttachedSiteWorkspaceEvidence | null> {
  if (!payload.session) {
    return null;
  }

  const pendingEntries: PendingEvidenceEntry[] = [];
  const seen = new Set<string>();
  const routePath = readRoutePath(payload);
  const codeReferences = readCodeReferences(payload).slice(0, 3);

  for (const reference of codeReferences) {
    if (token?.isCancellationRequested) {
      return null;
    }

    const uri = await resolveWorkspaceUri(reference.file);
    if (uri) {
      pushPendingEntry(pendingEntries, seen, {
        uri,
        reason: `Runtime code reference: ${reference.summary}`,
        focusLine: typeof reference.line === "number" ? reference.line : undefined
      });
    }
  }

  const routeFiles: vscode.Uri[] = [];
  if (routePath) {
    for (const candidate of buildRouteFileCandidates(routePath)) {
      if (token?.isCancellationRequested) {
        return null;
      }

      const uri = await resolveWorkspaceUri(candidate);
      if (!uri) {
        continue;
      }

      routeFiles.push(uri);
      pushPendingEntry(pendingEntries, seen, {
        uri,
        reason: candidate.endsWith("/index.tera") || candidate === "src/pages/index.tera"
          ? `Active route shell for ${routePath}`
          : `Direct route file for ${routePath}`
      });
      break;
    }
  }

  const layoutUri = await resolveWorkspaceUri("src/pages/layout.tera");
  if (layoutUri) {
    pushPendingEntry(pendingEntries, seen, {
      uri: layoutUri,
      reason: "Shared page layout for the attached route"
    });
  }

  const baseUris = [...routeFiles];
  if (layoutUri) {
    baseUris.push(layoutUri);
  }

  for (const uri of baseUris) {
    if (token?.isCancellationRequested) {
      return null;
    }

    const text = await readWorkspaceFileText(uri);
    if (text === null) {
      continue;
    }

    const componentNames = extractCapitalizedComponentNames(text).slice(0, MAX_COMPONENT_FILES);
    for (const componentName of componentNames) {
      const componentUri = await resolveComponentUri(componentName);
      if (componentUri) {
        pushPendingEntry(pendingEntries, seen, {
          uri: componentUri,
          reason: `Component referenced by ${vscode.workspace.asRelativePath(uri, false)}`
        });
      }
    }

    const relativeImports = extractRelativeImports(text).slice(0, MAX_IMPORT_FILES);
    for (const importPath of relativeImports) {
      const importUri = await resolveRelativeImportUri(uri, importPath);
      if (importUri) {
        pushPendingEntry(pendingEntries, seen, {
          uri: importUri,
          reason: `Imported from ${vscode.workspace.asRelativePath(uri, false)}`
        });
      }
    }
  }

  const files: AttachedSiteWorkspaceEvidenceFile[] = [];
  for (const entry of pendingEntries.slice(0, MAX_EVIDENCE_FILES)) {
    if (token?.isCancellationRequested) {
      return null;
    }

    const text = await readWorkspaceFileText(entry.uri);
    if (text === null) {
      continue;
    }

    files.push({
      path: vscode.workspace.asRelativePath(entry.uri, false),
      reason: entry.reason,
      excerpt: buildFileExcerpt(text, entry.focusLine)
    });
  }

  return files.length > 0
    ? { routePath, files }
    : null;
}

/**
 * Formats attached workspace evidence into a prompt-friendly block.
 */
export function formatAttachedSiteWorkspaceEvidence(evidence: AttachedSiteWorkspaceEvidence): string {
  const sections = evidence.files.map((file, index) => {
    return [
      `${index + 1}. ${file.path}`,
      `Reason: ${file.reason}`,
      "```text",
      file.excerpt,
      "```"
    ].join("\n");
  });

  return [
    `Attached workspace evidence for route: ${evidence.routePath ?? "unknown"}`,
    "Use these source excerpts to name the most likely files involved, not just the symptoms.",
    ...sections
  ].join("\n\n");
}

/**
 * Builds likely route file candidates from a browser path.
 */
export function buildRouteFileCandidates(routePath: string): string[] {
  const normalized = normalizeRoutePath(routePath);
  if (normalized === "/") {
    return ["src/pages/index.tera"];
  }

  const trimmed = normalized.slice(1);
  return [
    `src/pages/${trimmed}.tera`,
    `src/pages/${trimmed}/index.tera`
  ];
}

/**
 * Extracts likely component tag names from template markup.
 */
export function extractCapitalizedComponentNames(source: string): string[] {
  const names = new Set<string>();
  for (const match of source.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)) {
    names.add(match[1]);
  }
  return [...names];
}

/**
 * Extracts local relative import specifiers from script blocks.
 */
export function extractRelativeImports(source: string): string[] {
  const imports = new Set<string>();
  for (const match of source.matchAll(/import\s+[^\n]+?from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
    imports.add(match[1]);
  }
  return [...imports];
}

function readRoutePath(payload: AttachedSiteDiagnosticsPayload): string | null {
  const documentContext = payload.session?.document as { path?: unknown } | undefined;
  const snapshotDocument = payload.session?.snapshot as { document?: { path?: unknown } } | undefined;
  const routePath = typeof documentContext?.path === "string"
    ? documentContext.path
    : typeof snapshotDocument?.document?.path === "string"
    ? snapshotDocument.document.path
    : null;

  return routePath ? normalizeRoutePath(routePath) : null;
}

function readCodeReferences(payload: AttachedSiteDiagnosticsPayload): Array<{
  file: string;
  line: number | null;
  summary: string;
}> {
  const references = payload.session?.codeReferences;
  return Array.isArray(references)
    ? references
      .filter((reference): reference is { file: string; line: number | null; summary: string } => {
        return Boolean(reference)
          && typeof (reference as { file?: unknown }).file === "string"
          && typeof (reference as { summary?: unknown }).summary === "string";
      })
    : [];
}

function normalizeRoutePath(routePath: string): string {
  const pathOnly = routePath.split(/[?#]/, 1)[0] || "/";
  if (pathOnly === "/") {
    return "/";
  }

  const trimmed = pathOnly.replace(/\/+$/, "");
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function pushPendingEntry(
  pendingEntries: PendingEvidenceEntry[],
  seen: Set<string>,
  entry: PendingEvidenceEntry
): void {
  const key = entry.uri.toString();
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  pendingEntries.push(entry);
}

async function resolveWorkspaceUri(relativeOrAbsolutePath: string): Promise<vscode.Uri | null> {
  if (path.isAbsolute(relativeOrAbsolutePath)) {
    const absoluteUri = vscode.Uri.file(relativeOrAbsolutePath);
    return await exists(absoluteUri) ? absoluteUri : null;
  }

  const normalizedPath = relativeOrAbsolutePath.replace(/\\/g, "/");
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const candidate = vscode.Uri.joinPath(folder.uri, normalizedPath);
    if (await exists(candidate)) {
      return candidate;
    }
  }

  const basename = path.posix.basename(normalizedPath);
  const matches = await vscode.workspace.findFiles(`**/${basename}`, undefined, 20);
  return matches.find((match) => vscode.workspace.asRelativePath(match, false).replace(/\\/g, "/").endsWith(normalizedPath))
    ?? matches[0]
    ?? null;
}

async function resolveComponentUri(componentName: string): Promise<vscode.Uri | null> {
  const direct = await resolveWorkspaceUri(`src/components/${componentName}.tera`);
  if (direct) {
    return direct;
  }

  const matches = await vscode.workspace.findFiles(`**/${componentName}.tera`, undefined, 5);
  return matches[0] ?? null;
}

async function resolveRelativeImportUri(baseUri: vscode.Uri, importPath: string): Promise<vscode.Uri | null> {
  const directory = path.posix.dirname(baseUri.path);
  const resolvedPath = path.posix.normalize(path.posix.join(directory, importPath));
  const candidates = [resolvedPath];

  if (!path.posix.extname(resolvedPath)) {
    candidates.push(`${resolvedPath}.tera`, `${resolvedPath}.ts`, `${resolvedPath}.js`);
  }

  for (const candidatePath of candidates) {
    const candidateUri = baseUri.with({ path: candidatePath });
    if (await exists(candidateUri)) {
      return candidateUri;
    }
  }

  return null;
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function readWorkspaceFileText(uri: vscode.Uri): Promise<string | null> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(bytes).toString("utf8");
  } catch {
    return null;
  }
}

function buildFileExcerpt(text: string, focusLine?: number): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const hasFocus = typeof focusLine === "number" && Number.isFinite(focusLine) && focusLine > 0;
  const start = hasFocus
    ? Math.max(1, Math.trunc(focusLine) - EXCERPT_CONTEXT_RADIUS)
    : 1;
  const end = hasFocus
    ? Math.min(lines.length, Math.trunc(focusLine) + EXCERPT_CONTEXT_RADIUS)
    : Math.min(lines.length, EXCERPT_LINE_LIMIT);

  return lines
    .slice(start - 1, end)
    .map((line, index) => `${String(start + index).padStart(3, " ")}: ${line}`)
    .join("\n");
}
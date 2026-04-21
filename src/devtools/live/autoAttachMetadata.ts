import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { LiveBridgeEndpoints } from "./types";

const TERAJS_CONFIG_FILE_NAMES = [
  "terajs.config.js",
  "terajs.config.cjs",
  "terajs.config.mjs",
  "terajs.config.ts"
];

const AUTO_ATTACH_METADATA_RELATIVE_PATH = path.join("node_modules", ".cache", "terajs", "devtools-bridge.json");
const GLOBAL_AUTO_ATTACH_METADATA_ENV = "TERAJS_DEVTOOLS_BRIDGE_MANIFEST_PATH";
const GLOBAL_AUTO_ATTACH_METADATA_FILE_NAME = "devtools-bridge.json";

export interface AutoAttachMetadata {
  version: 1;
  session: string;
  ai: string;
  reveal: string;
  updatedAt: number;
}

function resolveGlobalAutoAttachMetadataDirectory(): string {
  const overridePath = process.env[GLOBAL_AUTO_ATTACH_METADATA_ENV]?.trim();
  if (overridePath) {
    return path.dirname(path.resolve(overridePath));
  }

  if (process.platform === "win32") {
    const baseDir = process.env.LOCALAPPDATA?.trim() || path.join(os.homedir(), "AppData", "Local");
    return path.join(baseDir, "terajs");
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Caches", "terajs");
  }

  const xdgCacheHome = process.env.XDG_CACHE_HOME?.trim();
  return path.join(xdgCacheHome && xdgCacheHome.length > 0 ? xdgCacheHome : path.join(os.homedir(), ".cache"), "terajs");
}

function buildAutoAttachMetadata(endpoints: LiveBridgeEndpoints): AutoAttachMetadata {
  return {
    version: 1,
    session: endpoints.session,
    ai: endpoints.ai,
    reveal: endpoints.reveal,
    updatedAt: Date.now()
  };
}

function readAutoAttachMetadata(filePath: string): AutoAttachMetadata | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const rawText = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    if (
      parsed.version !== 1
      || typeof parsed.session !== "string"
      || typeof parsed.ai !== "string"
      || typeof parsed.reveal !== "string"
    ) {
      return null;
    }

    return {
      version: 1,
      session: parsed.session,
      ai: parsed.ai,
      reveal: parsed.reveal,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now()
    };
  } catch {
    return null;
  }
}

function writeAutoAttachMetadataFile(filePath: string, payload: AutoAttachMetadata): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function shouldClearAutoAttachMetadataFile(filePath: string, endpoints?: LiveBridgeEndpoints): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  if (!endpoints) {
    return true;
  }

  const existing = readAutoAttachMetadata(filePath);
  if (!existing) {
    return true;
  }

  return existing.session === endpoints.session
    && existing.ai === endpoints.ai
    && existing.reveal === endpoints.reveal;
}

export function isTerajsProjectRoot(folderPath: string): boolean {
  return TERAJS_CONFIG_FILE_NAMES.some((fileName) => fs.existsSync(path.join(folderPath, fileName)));
}

export function collectTerajsProjectRoots(folderPaths: readonly string[]): string[] {
  return folderPaths.filter((folderPath) => isTerajsProjectRoot(folderPath));
}

export function resolveAutoAttachMetadataFilePath(folderPath: string): string {
  return path.join(folderPath, AUTO_ATTACH_METADATA_RELATIVE_PATH);
}

export function resolveGlobalAutoAttachMetadataFilePath(): string {
  const overridePath = process.env[GLOBAL_AUTO_ATTACH_METADATA_ENV]?.trim();
  if (overridePath) {
    return path.resolve(overridePath);
  }

  return path.join(resolveGlobalAutoAttachMetadataDirectory(), GLOBAL_AUTO_ATTACH_METADATA_FILE_NAME);
}

export function writeAutoAttachMetadata(
  folderPaths: readonly string[],
  endpoints: LiveBridgeEndpoints
): string[] {
  const payload = buildAutoAttachMetadata(endpoints);

  const writtenPaths: string[] = [];
  for (const folderPath of collectTerajsProjectRoots(folderPaths)) {
    const filePath = resolveAutoAttachMetadataFilePath(folderPath);
    writeAutoAttachMetadataFile(filePath, payload);
    writtenPaths.push(filePath);
  }

  const globalFilePath = resolveGlobalAutoAttachMetadataFilePath();
  writeAutoAttachMetadataFile(globalFilePath, payload);
  writtenPaths.push(globalFilePath);

  return writtenPaths;
}

export function clearAutoAttachMetadata(folderPaths: readonly string[], endpoints?: LiveBridgeEndpoints): void {
  for (const folderPath of collectTerajsProjectRoots(folderPaths)) {
    const filePath = resolveAutoAttachMetadataFilePath(folderPath);
    if (!shouldClearAutoAttachMetadataFile(filePath, endpoints)) {
      continue;
    }

    fs.unlinkSync(filePath);
  }

  const globalFilePath = resolveGlobalAutoAttachMetadataFilePath();
  if (shouldClearAutoAttachMetadataFile(globalFilePath, endpoints)) {
    fs.unlinkSync(globalFilePath);
  }
}
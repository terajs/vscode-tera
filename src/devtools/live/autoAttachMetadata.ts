import fs from "node:fs";
import path from "node:path";
import type { LiveBridgeEndpoints } from "./types";

const TERAJS_CONFIG_FILE_NAMES = [
  "terajs.config.js",
  "terajs.config.cjs",
  "terajs.config.mjs",
  "terajs.config.ts"
];

const AUTO_ATTACH_METADATA_RELATIVE_PATH = path.join("node_modules", ".cache", "terajs", "devtools-bridge.json");

export interface AutoAttachMetadata {
  version: 1;
  session: string;
  ai: string;
  reveal: string;
  updatedAt: number;
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

export function writeAutoAttachMetadata(
  folderPaths: readonly string[],
  endpoints: LiveBridgeEndpoints
): string[] {
  const payload: AutoAttachMetadata = {
    version: 1,
    session: endpoints.session,
    ai: endpoints.ai,
    reveal: endpoints.reveal,
    updatedAt: Date.now()
  };

  const writtenPaths: string[] = [];
  for (const folderPath of collectTerajsProjectRoots(folderPaths)) {
    const filePath = resolveAutoAttachMetadataFilePath(folderPath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    writtenPaths.push(filePath);
  }

  return writtenPaths;
}

export function clearAutoAttachMetadata(folderPaths: readonly string[]): void {
  for (const folderPath of collectTerajsProjectRoots(folderPaths)) {
    const filePath = resolveAutoAttachMetadataFilePath(folderPath);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    fs.unlinkSync(filePath);
  }
}
import { tryParseDevtoolsSession } from "../../session";
import type { LiveSessionPayload } from "../types";

export function parseLiveSessionPayload(rawBody: string): LiveSessionPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const phase = record.phase;
  const sessionValue = record.session;
  if ((phase !== "ready" && phase !== "update" && phase !== "dispose") || sessionValue === undefined) {
    return null;
  }

  const session = tryParseDevtoolsSession(JSON.stringify(sessionValue));
  if (!session) {
    return null;
  }

  return {
    phase,
    session
  };
}
import type { LiveReceiverState } from "../live/types";

const DEFAULT_EVENT_LIMIT = 60;
const MAX_EVENT_LIMIT = 200;

export interface AttachedSiteReceiverSnapshot {
  available: boolean;
  connected: boolean;
  state: "stopped" | "waiting" | "connected";
  phase: "ready" | "update" | "dispose" | "waiting";
  connectedAt: number | null;
  lastUpdateAt: number | null;
  instanceId: string | null;
}

export interface AttachedSiteDiagnosticsToolInput {
  eventLimit?: number;
  includeEventPayloads?: boolean;
}

export interface AttachedSiteEventRecord {
  type: string;
  timestamp: number;
  level: string | null;
  file: string | null;
  line: number | null;
  column: number | null;
  payload?: Record<string, unknown>;
}

export interface AttachedSiteSessionSnapshot {
  snapshot: unknown;
  document: unknown;
  documentDiagnostics: unknown;
  codeReferences: unknown;
  recentEvents: AttachedSiteEventRecord[];
  recentEventCount: number;
  totalEventCount: number;
}

export interface AttachedSiteDiagnosticsPayload {
  source: "terajs-devtools-service-bridge";
  message: string;
  receiver: AttachedSiteReceiverSnapshot;
  session?: AttachedSiteSessionSnapshot;
}

/**
 * Builds a bounded, tool-friendly snapshot from the latest attached Terajs site session.
 */
export function buildAttachedSiteDiagnosticsPayload(
  state: LiveReceiverState | null,
  input: AttachedSiteDiagnosticsToolInput = {}
): AttachedSiteDiagnosticsPayload {
  if (!state) {
    return {
      source: "terajs-devtools-service-bridge",
      message: "The Terajs DevTools receiver is not running in this VS Code window.",
      receiver: {
        available: false,
        connected: false,
        state: "stopped",
        phase: "waiting",
        connectedAt: null,
        lastUpdateAt: null,
        instanceId: null
      }
    };
  }

  const session = state.latestSession;
  const connected = state.connectionState === "connected";
  if (!session) {
    return {
      source: "terajs-devtools-service-bridge",
      message: "The Terajs DevTools receiver is running, but no site has attached a sanitized session yet.",
      receiver: {
        available: true,
        connected,
        state: state.connectionState,
        phase: state.lastPhase,
        connectedAt: state.connectedAt,
        lastUpdateAt: state.lastUpdateAt,
        instanceId: state.lastSessionInstanceId
      }
    };
  }

  const includeEventPayloads = input.includeEventPayloads === true;
  const eventLimit = normalizeEventLimit(input.eventLimit);
  const recentEvents = session.events
    .slice(-eventLimit)
    .map((event) => summarizeEvent(event, includeEventPayloads));

  return {
    source: "terajs-devtools-service-bridge",
    message: connected
      ? "Returning the latest sanitized snapshot from the currently attached Terajs site bridge."
      : "The site is no longer attached, but the last sanitized Terajs snapshot is still available.",
    receiver: {
      available: true,
      connected,
      state: state.connectionState,
      phase: state.lastPhase,
      connectedAt: state.connectedAt,
      lastUpdateAt: state.lastUpdateAt,
      instanceId: state.lastSessionInstanceId
    },
    session: {
      snapshot: session.snapshot,
      document: session.document,
      documentDiagnostics: session.documentDiagnostics,
      codeReferences: session.codeReferences,
      recentEvents,
      recentEventCount: recentEvents.length,
      totalEventCount: Math.max(session.snapshot.eventCount, session.events.length)
    }
  };
}

function normalizeEventLimit(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_EVENT_LIMIT;
  }

  const rounded = Math.trunc(value);
  if (rounded <= 0) {
    return DEFAULT_EVENT_LIMIT;
  }

  return Math.min(rounded, MAX_EVENT_LIMIT);
}

function summarizeEvent(
  event: {
    type: string;
    timestamp: number;
    level?: string;
    file?: string;
    line?: number;
    column?: number;
    payload?: Record<string, unknown>;
  },
  includeEventPayloads: boolean
): AttachedSiteEventRecord {
  const summary: AttachedSiteEventRecord = {
    type: event.type,
    timestamp: event.timestamp,
    level: event.level ?? null,
    file: event.file ?? null,
    line: event.line ?? null,
    column: event.column ?? null
  };

  if (includeEventPayloads && event.payload) {
    summary.payload = event.payload;
  }

  return summary;
}
import type {
  DevtoolsCodeReference,
  DevtoolsSessionExport,
  SafeDocumentContext,
  SafeDocumentContextSummary,
  SafeDocumentDiagnostic,
  SessionEventRecord,
  SessionSnapshot,
} from "./types";
import { isRecord, readBoolean, readNumber, readString, readStringArray } from "./valueReaders";

function parseDocumentContext(value: unknown): SafeDocumentContext | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    title: readString(value.title) ?? "",
    lang: readString(value.lang),
    dir: value.dir === "ltr" || value.dir === "rtl" ? value.dir : null,
    path: readString(value.path) ?? "/",
    hash: readString(value.hash),
    queryKeys: readStringArray(value.queryKeys),
    metaTags: Array.isArray(value.metaTags)
      ? value.metaTags.flatMap((entry) => {
        if (!isRecord(entry)) {
          return [];
        }

        const key = readString(entry.key);
        const source = readString(entry.source);
        const metaValue = readString(entry.value);
        if (!key || !source || !metaValue) {
          return [];
        }

        return [{ key, source, value: metaValue }];
      })
      : [],
    linkTags: Array.isArray(value.linkTags)
      ? value.linkTags.flatMap((entry) => {
        if (!isRecord(entry)) {
          return [];
        }

        const rel = readString(entry.rel);
        const href = readString(entry.href);
        const sameOrigin = readBoolean(entry.sameOrigin);
        if (!rel || !href || sameOrigin === null) {
          return [];
        }

        return [{ rel, href, sameOrigin, queryKeys: readStringArray(entry.queryKeys) }];
      })
      : []
  };
}

function parseDocumentSummary(value: unknown): SafeDocumentContextSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    title: readString(value.title) ?? "",
    lang: readString(value.lang),
    dir: value.dir === "ltr" || value.dir === "rtl" ? value.dir : null,
    path: readString(value.path) ?? "/",
    hash: readString(value.hash),
    queryKeys: readStringArray(value.queryKeys),
    metaTagCount: readNumber(value.metaTagCount) ?? 0,
    linkTagCount: readNumber(value.linkTagCount) ?? 0
  };
}

function parseDocumentDiagnostics(value: unknown): SafeDocumentDiagnostic[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const id = readString(entry.id);
    const severity = entry.severity === "info" || entry.severity === "warn" ? entry.severity : null;
    const message = readString(entry.message);
    if (!id || !severity || !message) {
      return [];
    }

    return [{
      id,
      severity,
      message,
      detail: readString(entry.detail) ?? undefined
    }];
  });
}

function parseSessionEvents(value: unknown): SessionEventRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const type = readString(entry.type);
    const timestamp = readNumber(entry.timestamp);
    if (!type || timestamp === null) {
      return [];
    }

    return [{
      type,
      timestamp,
      level: readString(entry.level) ?? undefined,
      file: readString(entry.file) ?? undefined,
      line: readNumber(entry.line) ?? undefined,
      column: readNumber(entry.column) ?? undefined,
      payload: isRecord(entry.payload) ? entry.payload : undefined
    }];
  });
}

function parseCodeReferences(value: unknown): DevtoolsCodeReference[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const file = readString(entry.file);
    if (!file) {
      return [];
    }

    const level = entry.level === "warn" || entry.level === "error"
      ? entry.level
      : "warn";

    return [{
      file,
      line: readNumber(entry.line),
      column: readNumber(entry.column),
      summary: readString(entry.summary) ?? readString(entry.reason) ?? "Likely implementation surface",
      eventType: readString(entry.eventType) ?? "unknown",
      level,
      timestamp: readNumber(entry.timestamp) ?? 0
    }];
  });
}

function parseSessionSnapshot(value: unknown): SessionSnapshot | null {
  if (!isRecord(value) || !isRecord(value.ai) || !isRecord(value.layout)) {
    return null;
  }

  const instanceId = readString(value.instanceId);
  const activeTab = readString(value.activeTab);
  const theme = readString(value.theme);
  if (!instanceId || !activeTab || !theme) {
    return null;
  }

  return {
    instanceId,
    hostKind: readString(value.hostKind) ?? "unknown",
    hostId: readString(value.hostId),
    activeTab,
    theme,
    eventCount: readNumber(value.eventCount) ?? 0,
    mountedComponentCount: readNumber(value.mountedComponentCount) ?? 0,
    selectedComponentKey: readString(value.selectedComponentKey),
    selectedMetaKey: readString(value.selectedMetaKey),
    componentSearchQuery: readString(value.componentSearchQuery) ?? "",
    componentInspectorQuery: readString(value.componentInspectorQuery) ?? "",
    ai: {
      status: readString(value.ai.status) ?? "unknown",
      likelyCause: readString(value.ai.likelyCause),
      error: readString(value.ai.error),
      promptAvailable: readBoolean(value.ai.promptAvailable) ?? false,
      responseAvailable: readBoolean(value.ai.responseAvailable) ?? false,
      assistantEnabled: readBoolean(value.ai.assistantEnabled) ?? false,
      assistantEndpoint: readString(value.ai.assistantEndpoint),
      assistantModel: readString(value.ai.assistantModel) ?? "unknown",
      assistantTimeoutMs: readNumber(value.ai.assistantTimeoutMs) ?? 0
    },
    layout: {
      position: readString(value.layout.position) ?? "unknown",
      panelSize: readString(value.layout.panelSize) ?? "unknown",
      persistPreferences: readBoolean(value.layout.persistPreferences) ?? false
    },
    codeReferences: parseCodeReferences(value.codeReferences),
    document: parseDocumentSummary(value.document),
    documentDiagnostics: parseDocumentDiagnostics(value.documentDiagnostics),
    recentEvents: Array.isArray(value.recentEvents)
      ? value.recentEvents.flatMap((entry) => {
        if (!isRecord(entry)) {
          return [];
        }

        const type = readString(entry.type);
        const timestamp = readNumber(entry.timestamp);
        if (!type || timestamp === null) {
          return [];
        }

        return [{
          type,
          timestamp,
          level: readString(entry.level) ?? undefined
        }];
      })
      : []
  };
}

export function tryParseDevtoolsSession(text: string): DevtoolsSessionExport | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const snapshot = parseSessionSnapshot(parsed.snapshot);
  const events = parseSessionEvents(parsed.events);
  if (!snapshot || events.length === 0) {
    return null;
  }

  const codeReferences = parseCodeReferences(parsed.codeReferences);
  return {
    snapshot,
    codeReferences: codeReferences.length > 0 ? codeReferences : snapshot.codeReferences,
    document: parseDocumentContext(parsed.document),
    documentDiagnostics: parseDocumentDiagnostics(parsed.documentDiagnostics ?? snapshot.documentDiagnostics),
    events
  };
}
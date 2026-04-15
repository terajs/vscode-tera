export interface SafeDocumentMetaTag {
  key: string;
  source: string;
  value: string;
}

export interface SafeDocumentLinkTag {
  rel: string;
  href: string;
  sameOrigin: boolean;
  queryKeys: string[];
}

export interface SafeDocumentContext {
  title: string;
  lang: string | null;
  dir: "ltr" | "rtl" | null;
  path: string;
  hash: string | null;
  queryKeys: string[];
  metaTags: SafeDocumentMetaTag[];
  linkTags: SafeDocumentLinkTag[];
}

export interface SafeDocumentContextSummary {
  title: string;
  lang: string | null;
  dir: "ltr" | "rtl" | null;
  path: string;
  hash: string | null;
  queryKeys: string[];
  metaTagCount: number;
  linkTagCount: number;
}

export interface SafeDocumentDiagnostic {
  id: string;
  severity: "info" | "warn";
  message: string;
  detail?: string;
}

export interface DevtoolsCodeReference {
  file: string;
  line: number | null;
  column: number | null;
  summary: string;
  eventType: string;
  level: "warn" | "error";
  timestamp: number;
}

export interface SessionSnapshot {
  instanceId: string;
  hostKind: string;
  hostId: string | null;
  activeTab: string;
  theme: string;
  eventCount: number;
  mountedComponentCount: number;
  selectedComponentKey: string | null;
  selectedMetaKey: string | null;
  componentSearchQuery: string;
  componentInspectorQuery: string;
  ai: {
    status: string;
    likelyCause: string | null;
    error: string | null;
    promptAvailable: boolean;
    responseAvailable: boolean;
    assistantEnabled: boolean;
    assistantEndpoint: string | null;
    assistantModel: string;
    assistantTimeoutMs: number;
  };
  layout: {
    position: string;
    panelSize: string;
    persistPreferences: boolean;
  };
  codeReferences: DevtoolsCodeReference[];
  document: SafeDocumentContextSummary | null;
  documentDiagnostics: SafeDocumentDiagnostic[];
  recentEvents: Array<{
    type: string;
    timestamp: number;
    level?: string;
  }>;
}

export interface SessionEventRecord {
  type: string;
  timestamp: number;
  level?: string;
  file?: string;
  line?: number;
  column?: number;
  payload?: Record<string, unknown>;
}

export interface DevtoolsSessionExport {
  snapshot: SessionSnapshot;
  codeReferences: DevtoolsCodeReference[];
  document: SafeDocumentContext | null;
  documentDiagnostics: SafeDocumentDiagnostic[];
  events: SessionEventRecord[];
}

export interface ParsedSession {
  session: DevtoolsSessionExport;
  source: string;
}

export interface SessionHtmlRenderOptions {
  cspSource?: string;
  scriptNonce?: string;
  enableCodeReferenceActions?: boolean;
}
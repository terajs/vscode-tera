import * as http from "node:http";
import * as vscode from "vscode";
import type { DevtoolsSessionExport } from "../session";

export type LiveSessionPhase = "ready" | "update" | "dispose" | "waiting";

export interface LiveBridgeEndpoints {
  session: string;
  ai: string;
}

export interface LiveReceiverState {
  server: http.Server;
  token: string;
  endpoints: LiveBridgeEndpoints;
  panel: vscode.WebviewPanel | null;
  latestSession: DevtoolsSessionExport | null;
  lastUpdateAt: number | null;
  lastPhase: LiveSessionPhase;
}

export interface LiveSessionPayload {
  phase: Exclude<LiveSessionPhase, "waiting">;
  session: DevtoolsSessionExport;
}

export interface LiveRouteResponse {
  statusCode: number;
  body: string;
  contentType?: string;
}
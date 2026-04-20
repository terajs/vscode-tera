import * as http from "node:http";
import * as vscode from "vscode";
import type { DevtoolsSessionExport } from "../session";

export type LiveSessionPhase = "ready" | "update" | "dispose" | "waiting";
export type LiveReceiverConnectionState = "waiting" | "connected";

export interface LiveBridgeEndpoints {
  session: string;
  ai: string;
  reveal: string;
}

export interface LiveReceiverState {
  server: http.Server;
  token: string;
  endpoints: LiveBridgeEndpoints;
  panel: vscode.WebviewPanel | null;
  latestSession: DevtoolsSessionExport | null;
  connectionState: LiveReceiverConnectionState;
  connectedAt: number | null;
  lastSessionInstanceId: string | null;
  lastUpdateAt: number | null;
  lastPhase: LiveSessionPhase;
}

export interface LiveSessionPayload {
  phase: Exclude<LiveSessionPhase, "waiting">;
  session: DevtoolsSessionExport;
}

export interface LiveSessionAck {
  accepted: true;
  phase: Exclude<LiveSessionPhase, "waiting">;
  state: LiveReceiverConnectionState;
  connectedAt: number | null;
  instanceId: string | null;
}

export interface LiveRouteResponse {
  statusCode: number;
  body: string;
  contentType?: string;
}
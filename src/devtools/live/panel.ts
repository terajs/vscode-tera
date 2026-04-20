import * as vscode from "vscode";
import {
  createSessionHtmlRenderOptions,
  registerSessionPanelInteractions,
  renderSessionHtml,
} from "../session";
import { buildLiveAttachSnippet } from "./attachSnippet";
import type { LiveReceiverState } from "./types";
import { renderWaitingHtml } from "./waitingHtml";

export function renderLiveSessionPanel(state: LiveReceiverState): string {
  if (!state.latestSession) {
    return renderWaitingHtml(buildLiveAttachSnippet(state.endpoints));
  }

  const sourceParts = [
    `live attach | state: ${state.connectionState}`,
    `phase: ${state.lastPhase}`,
    `updated: ${state.lastUpdateAt ? new Date(state.lastUpdateAt).toLocaleTimeString() : "pending"}`
  ];

  if (state.connectedAt) {
    sourceParts.push(`connected: ${new Date(state.connectedAt).toLocaleTimeString()}`);
  }

  if (state.lastSessionInstanceId) {
    sourceParts.push(`instance: ${state.lastSessionInstanceId}`);
  }

  const source = sourceParts.join(" | ");
  return state.panel
    ? renderSessionHtml(state.latestSession, source, createSessionHtmlRenderOptions(state.panel.webview))
    : renderSessionHtml(state.latestSession, source);
}

export function updateLivePanel(state: LiveReceiverState | null): void {
  if (!state?.panel) {
    return;
  }

  state.panel.webview.html = renderLiveSessionPanel(state);
}

export function ensureLivePanel(
  state: LiveReceiverState,
  onDispose: () => void
): vscode.WebviewPanel {
  if (state.panel) {
    state.panel.reveal(vscode.ViewColumn.Beside);
    updateLivePanel(state);
    return state.panel;
  }

  const panel = vscode.window.createWebviewPanel(
    "terajsLiveDevtoolsSession",
    "Terajs Live DevTools",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  registerSessionPanelInteractions(panel);
  panel.onDidDispose(onDispose);
  state.panel = panel;
  updateLivePanel(state);
  return panel;
}
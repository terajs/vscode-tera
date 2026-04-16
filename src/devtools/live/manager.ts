import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { clearAutoAttachMetadata, collectTerajsProjectRoots, writeAutoAttachMetadata } from "./autoAttachMetadata";
import { buildLiveAttachSnippet } from "./attachSnippet";
import { ensureLivePanel, updateLivePanel } from "./panel";
import { createLiveReceiverServer } from "./server";
import type { LiveReceiverState, LiveSessionPayload } from "./types";

let liveReceiverState: LiveReceiverState | null = null;

export async function startLiveReceiver(context: vscode.ExtensionContext): Promise<void> {
  await startLiveReceiverInternal(context, {
    revealPanel: true,
    copySnippet: true,
    showStartedMessage: true,
    showAlreadyRunningPrompt: true
  });
}

export async function autoStartLiveReceiver(context: vscode.ExtensionContext): Promise<void> {
  const terajsWorkspaceRoots = getTerajsWorkspaceRoots();
  if (terajsWorkspaceRoots.length === 0) {
    return;
  }

  await startLiveReceiverInternal(context, {
    revealPanel: false,
    copySnippet: false,
    showStartedMessage: false,
    showAlreadyRunningPrompt: false
  });
}

interface StartLiveReceiverOptions {
  revealPanel: boolean;
  copySnippet: boolean;
  showStartedMessage: boolean;
  showAlreadyRunningPrompt: boolean;
}

async function startLiveReceiverInternal(
  context: vscode.ExtensionContext,
  options: StartLiveReceiverOptions
): Promise<void> {
  if (liveReceiverState) {
    if (!options.showAlreadyRunningPrompt) {
      return;
    }

    const action = await vscode.window.showInformationMessage(
      "Terajs live DevTools receiver is already running.",
      "Copy Attach Snippet",
      "Open Live Panel",
      "Stop Receiver"
    );

    if (action === "Copy Attach Snippet") {
      await vscode.env.clipboard.writeText(buildLiveAttachSnippet(liveReceiverState.endpoints));
      void vscode.window.showInformationMessage("Copied the live DevTools attach snippet to the clipboard.");
    } else if (action === "Open Live Panel") {
      ensureLivePanel(liveReceiverState, handlePanelDisposed);
    } else if (action === "Stop Receiver") {
      await stopLiveReceiver();
    }
    return;
  }

  const token = randomUUID();
  const server = createLiveReceiverServer(context, token, applyLiveSessionPayload, revealLivePanel);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Unable to resolve the Terajs live DevTools receiver address.");
  }

  liveReceiverState = {
    server,
    token,
    endpoints: {
      session: `http://127.0.0.1:${address.port}/live/${token}`,
      ai: `http://127.0.0.1:${address.port}/ai/${token}`,
      reveal: `http://127.0.0.1:${address.port}/reveal/${token}`
    },
    panel: null,
    latestSession: null,
    lastUpdateAt: null,
    lastPhase: "waiting"
  };

  publishAutoAttachMetadata(liveReceiverState.endpoints);

  if (options.revealPanel) {
    ensureLivePanel(liveReceiverState, handlePanelDisposed);
  }

  const snippet = buildLiveAttachSnippet(liveReceiverState.endpoints);
  if (options.copySnippet) {
    await vscode.env.clipboard.writeText(snippet);
  }

  if (options.showStartedMessage) {
    void vscode.window.showInformationMessage(
      options.copySnippet
        ? "Started the Terajs live DevTools receiver and copied the attach snippet to the clipboard. Paste it into the browser console on the page you want to inspect."
        : "Started the Terajs live DevTools receiver."
    );
  }
}

export async function stopLiveReceiver(showMessage = true): Promise<void> {
  const state = liveReceiverState;
  if (!state) {
    return;
  }

  liveReceiverState = null;
  state.panel?.dispose();
  clearPublishedAutoAttachMetadata();

  await new Promise<void>((resolve) => {
    state.server.close(() => resolve());
  });

  if (showMessage) {
    void vscode.window.showInformationMessage("Stopped the Terajs live DevTools receiver.");
  }
}

export async function copyLiveAttachSnippet(context: vscode.ExtensionContext): Promise<void> {
  if (!liveReceiverState) {
    await startLiveReceiver(context);
    return;
  }

  await vscode.env.clipboard.writeText(buildLiveAttachSnippet(liveReceiverState.endpoints));
  void vscode.window.showInformationMessage("Copied the live DevTools attach snippet to the clipboard.");
}

function applyLiveSessionPayload(payload: LiveSessionPayload): void {
  if (!liveReceiverState) {
    return;
  }

  liveReceiverState.latestSession = payload.session;
  liveReceiverState.lastPhase = payload.phase;
  liveReceiverState.lastUpdateAt = Date.now();
  updateLivePanel(liveReceiverState);
}

function handlePanelDisposed(): void {
  if (liveReceiverState) {
    liveReceiverState.panel = null;
  }
}

function revealLivePanel(): void {
  if (!liveReceiverState) {
    return;
  }

  ensureLivePanel(liveReceiverState, handlePanelDisposed);
}

function getWorkspaceFolderPaths(): string[] {
  return (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
}

function getTerajsWorkspaceRoots(): string[] {
  return collectTerajsProjectRoots(getWorkspaceFolderPaths());
}

function publishAutoAttachMetadata(endpoints: LiveReceiverState["endpoints"]): void {
  writeAutoAttachMetadata(getWorkspaceFolderPaths(), endpoints);
}

function clearPublishedAutoAttachMetadata(): void {
  clearAutoAttachMetadata(getWorkspaceFolderPaths());
}
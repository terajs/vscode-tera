import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { buildLiveAttachSnippet } from "./attachSnippet";
import { ensureLivePanel, updateLivePanel } from "./panel";
import { createLiveReceiverServer } from "./server";
import type { LiveReceiverState, LiveSessionPayload } from "./types";

let liveReceiverState: LiveReceiverState | null = null;

export async function startLiveReceiver(context: vscode.ExtensionContext): Promise<void> {
  if (liveReceiverState) {
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
  const server = createLiveReceiverServer(context, token, applyLiveSessionPayload);

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
      ai: `http://127.0.0.1:${address.port}/ai/${token}`
    },
    panel: null,
    latestSession: null,
    lastUpdateAt: null,
    lastPhase: "waiting"
  };

  ensureLivePanel(liveReceiverState, handlePanelDisposed);
  const snippet = buildLiveAttachSnippet(liveReceiverState.endpoints);
  await vscode.env.clipboard.writeText(snippet);
  void vscode.window.showInformationMessage(
    "Started the Terajs live DevTools receiver and copied the attach snippet to the clipboard. Paste it into the browser console on the page you want to inspect."
  );
}

export async function stopLiveReceiver(showMessage = true): Promise<void> {
  const state = liveReceiverState;
  if (!state) {
    return;
  }

  liveReceiverState = null;
  state.panel?.dispose();

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
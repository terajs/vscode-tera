import * as vscode from "vscode";
import { buildAttachedSiteChatQuery } from "./chatPrompts";
import { getLiveReceiverState, onDidChangeLiveReceiverState } from "../live/manager";
import type { LiveReceiverState } from "../live/types";

export const INSPECT_ATTACHED_SITE_COMMAND = "terajs.inspectAttachedSite";

const STATUS_BAR_ITEM_ID = "terajs.attachedSiteStatus";

/**
 * Registers the attached-site chat entrypoint and status surfaces for the extension.
 */
export function registerAttachedSiteChatEntryPoint(context: vscode.ExtensionContext): void {
  const statusBarItem = vscode.window.createStatusBarItem(STATUS_BAR_ITEM_ID, vscode.StatusBarAlignment.Left, 120);
  statusBarItem.name = "Terajs Attached Site";
  context.subscriptions.push(statusBarItem);

  let lastAnnouncedConnectionAt: number | null = null;

  const inspectAttachedSite = async (): Promise<void> => {
    await vscode.commands.executeCommand("workbench.action.chat.newChat");
    await vscode.commands.executeCommand("workbench.action.chat.open", {
      mode: "agent",
      query: buildAttachedSiteChatQuery("inspect"),
      isPartialQuery: false
    });
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(INSPECT_ATTACHED_SITE_COMMAND, inspectAttachedSite),
    onDidChangeLiveReceiverState((state) => {
      updateStatusBarItem(statusBarItem, state);
      void maybeAnnounceAttachedSite(state, lastAnnouncedConnectionAt, inspectAttachedSite).then((connectedAt) => {
        lastAnnouncedConnectionAt = connectedAt;
      });
    })
  );

  updateStatusBarItem(statusBarItem, getLiveReceiverState());
}

function updateStatusBarItem(
  statusBarItem: vscode.StatusBarItem,
  state: LiveReceiverState | null
): void {
  if (!state) {
    statusBarItem.text = "$(debug-disconnect) Terajs: receiver stopped";
    statusBarItem.tooltip = "The Terajs live receiver is stopped. Start the receiver to accept attached-site snapshots.";
    statusBarItem.command = "terajs.startLiveDevtoolsSession";
    statusBarItem.show();
    return;
  }

  if (state.connectionState === "connected" && state.latestSession) {
    statusBarItem.text = "$(plug) Terajs: site attached";
    statusBarItem.tooltip = "Inspect the currently attached Terajs site in chat.";
    statusBarItem.command = INSPECT_ATTACHED_SITE_COMMAND;
    statusBarItem.show();
    return;
  }

  statusBarItem.text = "$(radio-tower) Terajs: waiting for site";
  statusBarItem.tooltip = "The Terajs live receiver is running and waiting for a site to attach.";
  statusBarItem.command = INSPECT_ATTACHED_SITE_COMMAND;
  statusBarItem.show();
}

async function maybeAnnounceAttachedSite(
  state: LiveReceiverState | null,
  lastAnnouncedConnectionAt: number | null,
  inspectAttachedSite: () => Promise<void>
): Promise<number | null> {
  if (!state || state.connectionState !== "connected" || !state.latestSession || state.connectedAt === null) {
    return lastAnnouncedConnectionAt;
  }

  if (state.connectedAt === lastAnnouncedConnectionAt) {
    return lastAnnouncedConnectionAt;
  }

  const action = await vscode.window.showInformationMessage(
    "Terajs site attached. Inspect the current sanitized snapshot in chat.",
    "Inspect Attached Site"
  );

  if (action === "Inspect Attached Site") {
    await inspectAttachedSite();
  }

  return state.connectedAt;
}
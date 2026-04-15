import * as vscode from "vscode";
import { copyLiveAttachSnippet, startLiveReceiver, stopLiveReceiver } from "./manager";

const START_LIVE_SESSION_COMMAND = "terajs.startLiveDevtoolsSession";
const STOP_LIVE_SESSION_COMMAND = "terajs.stopLiveDevtoolsSession";
const COPY_LIVE_ATTACH_SNIPPET_COMMAND = "terajs.copyLiveDevtoolsAttachSnippet";

export function registerLiveDevtoolsSession(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(START_LIVE_SESSION_COMMAND, () => startLiveReceiver(context)),
    vscode.commands.registerCommand(STOP_LIVE_SESSION_COMMAND, () => stopLiveReceiver()),
    vscode.commands.registerCommand(COPY_LIVE_ATTACH_SNIPPET_COMMAND, () => copyLiveAttachSnippet(context)),
    new vscode.Disposable(() => {
      void stopLiveReceiver(false);
    })
  );
}
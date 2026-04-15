import * as vscode from "vscode";
import { registerSessionPanelInteractions } from "./codeReferences";
import { createSessionHtmlRenderOptions, renderSessionHtml } from "./html";
import { DEVTOOLS_EXPORT_SNIPPET } from "./snippets";
import { resolveSessionFromSources } from "./sources";

const INSPECT_SESSION_COMMAND = "terajs.inspectDevtoolsSession";
const COPY_EXPORT_SNIPPET_COMMAND = "terajs.copyDevtoolsExportSnippet";

async function inspectDevtoolsSession(): Promise<void> {
  const resolved = await resolveSessionFromSources();
  if (!resolved) {
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "terajsDevtoolsSession",
    "Terajs DevTools Session",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  registerSessionPanelInteractions(panel);
  panel.webview.html = renderSessionHtml(resolved.session, resolved.source, createSessionHtmlRenderOptions(panel.webview));
}

async function copyDevtoolsExportSnippet(): Promise<void> {
  await vscode.env.clipboard.writeText(DEVTOOLS_EXPORT_SNIPPET);
  void vscode.window.showInformationMessage("Copied the Terajs DevTools export snippet to the clipboard.");
}

export function registerDevtoolsSessionInspector(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(INSPECT_SESSION_COMMAND, inspectDevtoolsSession),
    vscode.commands.registerCommand(COPY_EXPORT_SNIPPET_COMMAND, copyDevtoolsExportSnippet)
  );
}
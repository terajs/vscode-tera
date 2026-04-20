import * as vscode from "vscode";
import { buildAttachedSiteDiagnosticsPayload, type AttachedSiteDiagnosticsToolInput } from "./attachedSiteDiagnostics";
import { getLiveReceiverState } from "../live/manager";

export const ATTACHED_SITE_DIAGNOSTICS_TOOL_NAME = "getAttachedTerajsSiteDiagnostics";

/**
 * Registers the language-model tool that exposes the current attached-site snapshot.
 */
export function registerDevtoolsLanguageModelTools(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.lm.registerTool<AttachedSiteDiagnosticsToolInput>(
      ATTACHED_SITE_DIAGNOSTICS_TOOL_NAME,
      new AttachedSiteDiagnosticsTool()
    )
  );
}

class AttachedSiteDiagnosticsTool implements vscode.LanguageModelTool<AttachedSiteDiagnosticsToolInput> {
  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<AttachedSiteDiagnosticsToolInput>
  ): Promise<vscode.PreparedToolInvocation> {
    const eventLimit = typeof options.input.eventLimit === "number"
      ? Math.max(1, Math.trunc(options.input.eventLimit))
      : 60;

    return {
      invocationMessage: `Reading attached Terajs site diagnostics (${eventLimit} recent events max)`
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AttachedSiteDiagnosticsToolInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    if (token.isCancellationRequested) {
      throw new Error("Operation cancelled.");
    }

    const payload = buildAttachedSiteDiagnosticsPayload(getLiveReceiverState(), options.input);

    if (token.isCancellationRequested) {
      throw new Error("Operation cancelled.");
    }

    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(JSON.stringify(payload, null, 2))
    ]);
  }
}
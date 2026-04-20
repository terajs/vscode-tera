import * as vscode from "vscode";
import { buildAttachedSiteDiagnosticsPayload } from "./attachedSiteDiagnostics";
import { buildAttachedSiteChatMessages } from "./chatPrompts";
import { collectAttachedSiteWorkspaceEvidence, formatAttachedSiteWorkspaceEvidence } from "./workspaceEvidence";
import { getLiveReceiverState } from "../live/manager";

export const TERAJS_CHAT_PARTICIPANT_ID = "terajs.attached-site";

const REQUEST_JUSTIFICATION = "Inspect the sanitized Terajs attached-site diagnostics snapshot that the developer explicitly requested from the Terajs chat participant.";

/**
 * Registers the Terajs chat participant that answers questions from the attached site snapshot.
 */
export function registerDevtoolsChatParticipant(context: vscode.ExtensionContext): void {
  const participant = vscode.chat.createChatParticipant(
    TERAJS_CHAT_PARTICIPANT_ID,
    async (request, _chatContext, stream, token) => {
      const payload = buildAttachedSiteDiagnosticsPayload(getLiveReceiverState(), {
        eventLimit: request.command === "events" ? 120 : 80,
        includeEventPayloads: true
      });

      stream.progress("Reading attached Terajs site diagnostics...");

      if (!payload.session) {
        stream.markdown(buildUnavailableBridgeMessage(payload));
        return;
      }

      try {
        stream.progress("Inspecting likely route and component files...");
        const workspaceEvidence = await collectAttachedSiteWorkspaceEvidence(payload, token);
        const response = await request.model.sendRequest(
          buildAttachedSiteChatMessages(
            payload,
            request.prompt,
            request.command,
            workspaceEvidence ? formatAttachedSiteWorkspaceEvidence(workspaceEvidence) : undefined
          ),
          { justification: REQUEST_JUSTIFICATION },
          token
        );

        for await (const fragment of response.text) {
          stream.markdown(fragment);
        }
      } catch (error) {
        stream.markdown(renderLanguageModelError(error));
      }
    }
  );

  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, "terajs-logo-extension.png");
  context.subscriptions.push(participant);
}

function buildUnavailableBridgeMessage(payload: ReturnType<typeof buildAttachedSiteDiagnosticsPayload>): string {
  if (!payload.receiver.available) {
    return [
      "Terajs attached-site inspection is unavailable in this VS Code window.",
      "",
      "Start the live receiver first, then reconnect the page so the extension can read the sanitized site snapshot."
    ].join("\n");
  }

  return [
    "The Terajs live receiver is running, but no site has attached a sanitized snapshot yet.",
    "",
    "Reconnect the page or trigger the DevTools bridge attach flow, then run this request again."
  ].join("\n");
}

function renderLanguageModelError(error: unknown): string {
  if (error instanceof vscode.LanguageModelError) {
    if (error.code === vscode.LanguageModelError.NoPermissions.name) {
      return "VS Code AI permission was denied for the Terajs participant. Approve language model access and run the request again.";
    }

    if (error.code === vscode.LanguageModelError.Blocked.name) {
      return "VS Code AI is temporarily blocked or out of quota. Wait a moment, then retry the attached-site inspection.";
    }

    if (error.code === vscode.LanguageModelError.NotFound.name) {
      return "The selected VS Code AI model is no longer available. Reopen chat and retry the attached-site inspection.";
    }
  }

  return error instanceof Error
    ? `Terajs attached-site inspection failed: ${error.message}`
    : "Terajs attached-site inspection failed.";
}
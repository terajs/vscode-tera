import * as vscode from "vscode";
import type { AttachedSiteDiagnosticsPayload } from "./attachedSiteDiagnostics";

export const TERAJS_CHAT_PARTICIPANT_NAME = "terajs";

type AttachedSiteChatCommand = "inspect" | "events" | "metadata";

const INSPECT_PROMPT = "Inspect the currently attached Terajs site. Summarize the most important issues, current route state, AI diagnostics, and the best next checks.";
const EVENTS_PROMPT = "Summarize the most relevant recent runtime events from the attached Terajs site, explain what they imply, and call out the first concrete debugging move.";
const METADATA_PROMPT = "Review the attached Terajs site's current route, document metadata, and AI diagnostics. Summarize missing or suspicious metadata and any route-level concerns.";

/**
 * Builds the default chat query used to route developers into the Terajs participant.
 */
export function buildAttachedSiteChatQuery(command: AttachedSiteChatCommand = "inspect"): string {
  return `@${TERAJS_CHAT_PARTICIPANT_NAME} /${command}`;
}

/**
 * Creates the model messages used by the Terajs chat participant for attached-site inspection.
 */
export function buildAttachedSiteChatMessages(
  payload: AttachedSiteDiagnosticsPayload,
  prompt: string,
  command: string | undefined,
  workspaceEvidence?: string
): vscode.LanguageModelChatMessage[] {
  const effectivePrompt = resolveDeveloperPrompt(prompt, command);
  const messages = [
    vscode.LanguageModelChatMessage.User(
      "You are Terajs attached-site inspector inside VS Code. Use the sanitized attached-site snapshot as the source of truth. Be concise, concrete, and debugging-oriented. When workspace evidence is provided, name 1-3 most likely files first and explain why they are suspicious. Do not stop at symptom summary when you have route, layout, component, or code-reference excerpts. Rank suspects when certainty is incomplete. When runtime codeReferences are empty or the snapshot evidence is indirect, label file suspects as hypotheses rather than confirmed causes. Do not call an effect leak confirmed unless the snapshot includes teardown, remount, or other lifecycle evidence beyond startup-only create spikes. If the current issues are limited to document head or metadata diagnostics, keep the suspect list tight: prefer the active route file that owns the head metadata, and only mention a shared layout when it is a plausible shared metadata owner. Do not pad metadata-only diagnoses with unrelated components."
    ),
    vscode.LanguageModelChatMessage.User(`Attached Terajs site snapshot:\n${JSON.stringify(payload, null, 2)}`)
  ];

  if (workspaceEvidence) {
    messages.push(vscode.LanguageModelChatMessage.User(workspaceEvidence));
  }

  messages.push(vscode.LanguageModelChatMessage.User(`Developer request: ${effectivePrompt}`));
  return messages;
}

function resolveDeveloperPrompt(prompt: string, command: string | undefined): string {
  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length > 0) {
    return trimmedPrompt;
  }

  switch (command) {
    case "events":
      return EVENTS_PROMPT;
    case "metadata":
      return METADATA_PROMPT;
    default:
      return INSPECT_PROMPT;
  }
}
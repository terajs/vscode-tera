import * as vscode from "vscode";
import { DEVTOOLS_EXPORT_SNIPPET } from "./snippets";
import { tryParseDevtoolsSession } from "./parsing";
import type { ParsedSession } from "./types";

export async function resolveSessionFromSources(): Promise<ParsedSession | null> {
  const editor = vscode.window.activeTextEditor;
  const candidates: Array<{ text: string; source: string }> = [];

  const selectionText = editor && !editor.selection.isEmpty
    ? editor.document.getText(editor.selection).trim()
    : "";
  if (selectionText) {
    candidates.push({ text: selectionText, source: "editor selection" });
  }

  const documentText = editor?.document.getText().trim() ?? "";
  if (documentText && documentText !== selectionText) {
    candidates.push({ text: documentText, source: "active document" });
  }

  const clipboardText = (await vscode.env.clipboard.readText()).trim();
  if (clipboardText && clipboardText !== selectionText && clipboardText !== documentText) {
    candidates.push({ text: clipboardText, source: "clipboard" });
  }

  for (const candidate of candidates) {
    const session = tryParseDevtoolsSession(candidate.text);
    if (session) {
      return {
        session,
        source: candidate.source
      };
    }
  }

  const action = await vscode.window.showErrorMessage(
    "No valid Terajs DevTools session export was found in the selection, active document, or clipboard.",
    "Copy Export Snippet"
  );

  if (action === "Copy Export Snippet") {
    await vscode.env.clipboard.writeText(DEVTOOLS_EXPORT_SNIPPET);
    void vscode.window.showInformationMessage("Copied the Terajs DevTools export snippet to the clipboard.");
  }

  return null;
}
import * as vscode from "vscode";
import { registerLiveDevtoolsSession } from "./devtoolsLiveSession";
import { registerDevtoolsSessionInspector } from "./devtoolsSessionInspector";
import { registerAttachedSiteChatEntryPoint } from "./devtools/ai/chatEntryPoint";
import { registerDevtoolsChatParticipant } from "./devtools/ai/chatParticipant";
import { registerDevtoolsLanguageModelTools } from "./devtools/ai/tools";
import { registerTeraLanguageFeatures } from "./teraLanguageService";

export function activate(context: vscode.ExtensionContext): void {
  registerTeraLanguageFeatures(context);
  registerDevtoolsSessionInspector(context);
  registerLiveDevtoolsSession(context);
  registerDevtoolsLanguageModelTools(context);
  registerDevtoolsChatParticipant(context);
  registerAttachedSiteChatEntryPoint(context);
}

export function deactivate(): void {}
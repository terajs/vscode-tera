import * as vscode from "vscode";
import { registerLiveDevtoolsSession } from "./devtoolsLiveSession";
import { registerDevtoolsSessionInspector } from "./devtoolsSessionInspector";
import { registerTeraLanguageFeatures } from "./teraLanguageService";

export function activate(context: vscode.ExtensionContext): void {
  registerTeraLanguageFeatures(context);
  registerDevtoolsSessionInspector(context);
  registerLiveDevtoolsSession(context);
}

export function deactivate(): void {}
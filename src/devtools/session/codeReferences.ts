import * as vscode from "vscode";
import { isRecord, readNumber, readString } from "./valueReaders";

export function registerSessionPanelInteractions(panel: vscode.WebviewPanel): void {
  panel.webview.onDidReceiveMessage((message) => {
    void handleSessionPanelMessage(message);
  });
}

async function handleSessionPanelMessage(message: unknown): Promise<void> {
  if (!isRecord(message) || message.type !== "openCodeReference" || !isRecord(message.reference)) {
    return;
  }

  const file = readString(message.reference.file);
  if (!file) {
    return;
  }

  const line = readNumber(message.reference.line);
  const column = readNumber(message.reference.column);
  const summary = readString(message.reference.summary) ?? "Selected code reference";
  const targetUri = await resolveCodeReferenceUri(file);
  if (!targetUri) {
    const action = await vscode.window.showErrorMessage(
      `Unable to resolve ${file} in the current workspace.`,
      "Copy File Path"
    );

    if (action === "Copy File Path") {
      await vscode.env.clipboard.writeText(file);
      void vscode.window.showInformationMessage("Copied the unresolved code reference path to the clipboard.");
    }
    return;
  }

  const lineIndex = Math.max(0, (line ?? 1) - 1);
  const columnIndex = Math.max(0, (column ?? 1) - 1);
  const selection = new vscode.Range(lineIndex, columnIndex, lineIndex, columnIndex);
  const document = await vscode.workspace.openTextDocument(targetUri);
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: false,
    selection
  });

  editor.revealRange(selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  void vscode.window.setStatusBarMessage(`Terajs: opened ${summary}`, 2500);
}

async function resolveCodeReferenceUri(file: string): Promise<vscode.Uri | null> {
  if (file.startsWith("file://")) {
    const fileUri = vscode.Uri.parse(file);
    return await uriExists(fileUri) ? fileUri : null;
  }

  const normalized = file.replace(/\\/g, "/").replace(/^\.\//, "");
  if (/^[a-zA-Z]:\//.test(normalized) || normalized.startsWith("/")) {
    const absoluteUri = vscode.Uri.file(normalized);
    return await uriExists(absoluteUri) ? absoluteUri : null;
  }

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const candidate = normalized
      .split("/")
      .filter((segment) => segment.length > 0)
      .reduce((currentUri, segment) => vscode.Uri.joinPath(currentUri, segment), folder.uri);
    if (await uriExists(candidate)) {
      return candidate;
    }
  }

  const exclude = "**/{node_modules,.git,dist,out,build}/**";
  let matches = await vscode.workspace.findFiles(`**/${normalized}`, exclude, 20);
  const exactSuffixMatches = matches.filter((uri) => {
    const uriPath = uri.path.replace(/\\/g, "/");
    return uriPath.endsWith(`/${normalized}`) || uriPath.endsWith(normalized);
  });
  if (exactSuffixMatches.length > 0) {
    matches = exactSuffixMatches;
  }

  if (matches.length === 0) {
    const basename = normalized.split("/").filter((segment) => segment.length > 0).pop();
    if (!basename) {
      return null;
    }

    matches = await vscode.workspace.findFiles(`**/${basename}`, exclude, 20);
  }

  if (matches.length === 0) {
    return null;
  }

  if (matches.length === 1) {
    return matches[0];
  }

  const pick = await vscode.window.showQuickPick(
    matches.map((uri) => ({
      label: vscode.workspace.asRelativePath(uri, false),
      description: uri.fsPath,
      uri
    })),
    {
      placeHolder: `Select a file for ${normalized}`
    }
  );

  return pick?.uri ?? null;
}

async function uriExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
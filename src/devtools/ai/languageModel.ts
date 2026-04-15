import * as vscode from "vscode";
import type { DevtoolsAIResponseEnvelope } from "./protocol";

const REQUEST_JUSTIFICATION = "Analyze the sanitized Terajs DevTools session that the user explicitly sent to VS Code AI from the DevTools panel.";

export class DevtoolsAIBackendError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "DevtoolsAIBackendError";
  }
}

export function isDevtoolsAIBackendError(error: unknown): error is DevtoolsAIBackendError {
  return error instanceof DevtoolsAIBackendError;
}

export async function runDevtoolsLanguageModelRequest(
  context: vscode.ExtensionContext,
  prompt: string
): Promise<DevtoolsAIResponseEnvelope> {
  const model = await selectPreferredChatModel(context);
  ensureLanguageModelAccess(context, model);

  try {
    const response = await model.sendRequest(
      [vscode.LanguageModelChatMessage.User(prompt)],
      { justification: REQUEST_JUSTIFICATION }
    );
    const text = await readLanguageModelText(response);
    return {
      response: text,
      telemetry: {
        model: formatLanguageModelLabel(model),
        endpoint: null
      }
    };
  } catch (error) {
    throw normalizeLanguageModelError(error);
  }
}

async function selectPreferredChatModel(
  context: vscode.ExtensionContext
): Promise<vscode.LanguageModelChat> {
  const selectors: Array<vscode.LanguageModelChatSelector | undefined> = [
    { vendor: "copilot" },
    undefined
  ];

  for (const selector of selectors) {
    const models = selector
      ? await vscode.lm.selectChatModels(selector)
      : await vscode.lm.selectChatModels();
    if (models.length === 0) {
      continue;
    }

    const accessibleModel = models.find((candidate) => context.languageModelAccessInformation.canSendRequest(candidate) !== false);
    return accessibleModel ?? models[0];
  }

  throw new DevtoolsAIBackendError(
    503,
    "No VS Code chat model is available. Install and sign in to GitHub Copilot or another compatible chat model, then try again."
  );
}

function ensureLanguageModelAccess(
  context: vscode.ExtensionContext,
  model: vscode.LanguageModelChat
): void {
  const access = context.languageModelAccessInformation.canSendRequest(model);
  if (access === false) {
    throw new DevtoolsAIBackendError(
      403,
      "VS Code AI access is currently unavailable for this extension. Check Copilot permissions and try again."
    );
  }
}

async function readLanguageModelText(
  response: vscode.LanguageModelChatResponse
): Promise<string> {
  let text = "";
  for await (const chunk of response.text) {
    text += chunk;
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new DevtoolsAIBackendError(502, "VS Code AI returned an empty response.");
  }

  return trimmed;
}

function formatLanguageModelLabel(model: vscode.LanguageModelChat): string {
  const familyParts = [model.vendor, model.family, model.version].filter((value) => value.length > 0);
  return familyParts.length > 0 ? familyParts.join("/") : model.name || model.id;
}

function normalizeLanguageModelError(error: unknown): Error {
  if (error instanceof DevtoolsAIBackendError) {
    return error;
  }

  if (error instanceof vscode.LanguageModelError) {
    if (error.code === vscode.LanguageModelError.NoPermissions.name) {
      return new DevtoolsAIBackendError(
        403,
        "VS Code AI permission was denied. Approve language model access in VS Code and try again."
      );
    }

    if (error.code === vscode.LanguageModelError.Blocked.name) {
      return new DevtoolsAIBackendError(
        429,
        "VS Code AI is temporarily blocked or out of quota. Wait a moment, then retry."
      );
    }

    if (error.code === vscode.LanguageModelError.NotFound.name) {
      return new DevtoolsAIBackendError(
        503,
        "The selected VS Code AI model is no longer available. Reopen the command and try again."
      );
    }
  }

  return error instanceof Error
    ? new DevtoolsAIBackendError(500, error.message)
    : new DevtoolsAIBackendError(500, "VS Code AI request failed.");
}
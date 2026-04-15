import type * as vscode from "vscode";
import {
  parseDevtoolsAIRequest,
  serializeDevtoolsAIError,
  serializeDevtoolsAIResponse,
} from "../../ai/protocol";
import {
  isDevtoolsAIBackendError,
  runDevtoolsLanguageModelRequest,
} from "../../ai/languageModel";
import type { LiveRouteResponse } from "../types";

const JSON_CONTENT_TYPE = "application/json;charset=UTF-8";

export async function handleAIRouteRequest(
  context: vscode.ExtensionContext,
  rawBody: string
): Promise<LiveRouteResponse> {
  const request = parseDevtoolsAIRequest(rawBody);
  if (!request) {
    return {
      statusCode: 400,
      body: serializeDevtoolsAIError("Invalid AI request payload."),
      contentType: JSON_CONTENT_TYPE
    };
  }

  try {
    const response = await runDevtoolsLanguageModelRequest(context, request.prompt);
    return {
      statusCode: 200,
      body: serializeDevtoolsAIResponse(response),
      contentType: JSON_CONTENT_TYPE
    };
  } catch (error) {
    const statusCode = isDevtoolsAIBackendError(error) ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : "VS Code AI request failed.";
    return {
      statusCode,
      body: serializeDevtoolsAIError(message),
      contentType: JSON_CONTENT_TYPE
    };
  }
}
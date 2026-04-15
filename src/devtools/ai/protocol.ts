export interface DevtoolsAIRequest {
  prompt: string;
}

export interface DevtoolsAIResponseEnvelope {
  response: string;
  telemetry: {
    model: string;
    endpoint: null;
  };
}

export function parseDevtoolsAIRequest(rawBody: string): DevtoolsAIRequest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const promptValue = (parsed as Record<string, unknown>).prompt;
  const prompt = typeof promptValue === "string"
    ? promptValue.trim()
    : "";

  return prompt.length > 0 ? { prompt } : null;
}

export function serializeDevtoolsAIResponse(payload: DevtoolsAIResponseEnvelope): string {
  return JSON.stringify(payload);
}

export function serializeDevtoolsAIError(message: string): string {
  return JSON.stringify({ error: message });
}
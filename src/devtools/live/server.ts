import * as http from "node:http";
import type * as vscode from "vscode";
import { handleAIRouteRequest } from "./routes/aiRoute";
import { parseLiveSessionPayload } from "./routes/sessionRoute";
import type { LiveRouteResponse, LiveSessionAck, LiveSessionPayload } from "./types";

// Real Terajs live sessions can exceed the previous 1.5 MB ceiling once route,
// component, and event snapshots are populated in a full app runtime.
const MAX_REQUEST_BYTES = 5_000_000;

export function createLiveReceiverServer(
  context: vscode.ExtensionContext,
  token: string,
  onSessionPayload: (payload: LiveSessionPayload) => LiveSessionAck,
  onRevealRequested: () => void
): http.Server {
  return http.createServer((request, response) => {
    applyCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method !== "POST") {
      writeRouteResponse(response, { statusCode: 404, body: "not found" });
      return;
    }

    const livePath = `/live/${token}`;
    const aiPath = `/ai/${token}`;
    const revealPath = `/reveal/${token}`;
    if (request.url !== livePath && request.url !== aiPath && request.url !== revealPath) {
      writeRouteResponse(response, { statusCode: 404, body: "not found" });
      return;
    }

    void readRequestBody(request).then(async (rawBody) => {
      if (request.url === livePath) {
        const payload = parseLiveSessionPayload(rawBody);
        if (!payload) {
          writeRouteResponse(response, { statusCode: 400, body: "invalid session payload" });
          return;
        }

        const ack = onSessionPayload(payload);
        writeRouteResponse(response, {
          statusCode: 202,
          body: JSON.stringify(ack),
          contentType: "application/json;charset=UTF-8"
        });
        return;
      }

      if (request.url === revealPath) {
        onRevealRequested();
        writeRouteResponse(response, { statusCode: 202, body: "accepted" });
        return;
      }

      writeRouteResponse(response, await handleAIRouteRequest(context, rawBody));
    }).catch((error) => {
      const statusCode = error instanceof Error && error.message === "payload too large" ? 413 : 400;
      writeRouteResponse(response, {
        statusCode,
        body: statusCode === 413 ? "payload too large" : "request error"
      });
    });
  });
}

function applyCorsHeaders(response: http.ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function writeRouteResponse(response: http.ServerResponse, routeResponse: LiveRouteResponse): void {
  response.writeHead(routeResponse.statusCode, {
    "Content-Type": routeResponse.contentType ?? "text/plain;charset=UTF-8"
  });
  response.end(routeResponse.body);
}

function readRequestBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let rawBody = "";
    let settled = false;
    let payloadTooLarge = false;

    const fail = (error: Error): void => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    };

    const succeed = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(rawBody);
    };

    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      if (payloadTooLarge) {
        return;
      }

      rawBody += chunk;
      if (rawBody.length > MAX_REQUEST_BYTES) {
        payloadTooLarge = true;
        rawBody = "";
      }
    });
    request.on("end", () => {
      if (payloadTooLarge) {
        fail(new Error("payload too large"));
        return;
      }

      succeed();
    });
    request.on("error", (error) => fail(error instanceof Error ? error : new Error("request error")));
  });
}
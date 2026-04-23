import type { LiveBridgeEndpoints } from "./types";

const EXTENSION_AI_BRIDGE_CHANGE_EVENT = "terajs:devtools:extension-ai-bridge:change";

export function buildLiveAttachSnippet(endpoints: LiveBridgeEndpoints): string {
  return `(() => {
  const bridge = window.__TERAJS_DEVTOOLS_BRIDGE__;
  if (!bridge) {
    throw new Error("Terajs DevTools bridge is not available. Open DevTools in a non-production session with the bridge enabled.");
  }

  const liveEndpoint = ${JSON.stringify(endpoints.session)};
  const aiEndpoint = ${JSON.stringify(endpoints.ai)};
  let lastPayload = "";
  let disposed = false;

  const dispatchAIBridgeChange = () => {
    window.dispatchEvent(new CustomEvent(${JSON.stringify(EXTENSION_AI_BRIDGE_CHANGE_EVENT)}));
  };

  const parseAIResponse = async (response) => {
    const rawText = await response.text();
    if (!rawText) {
      return null;
    }

    try {
      return JSON.parse(rawText);
    } catch {
      return { response: rawText };
    }
  };

  const requestAI = async (request) => {
    const response = await fetch(aiEndpoint, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json;charset=UTF-8"
      },
      body: JSON.stringify(request)
    });

    const payload = await parseAIResponse(response);
    if (!response.ok) {
      const message = payload && typeof payload.error === "string"
        ? payload.error
        : "VS Code AI bridge request failed (" + response.status + ").";
      throw new Error(message);
    }

    return payload;
  };

  const installAIBridge = () => {
    window.__TERAJS_VSCODE_AI_ASSISTANT__ = {
      label: "VS Code AI/Copilot",
      request: requestAI
    };
    dispatchAIBridgeChange();
  };

  const uninstallAIBridge = () => {
    delete window.__TERAJS_VSCODE_AI_ASSISTANT__;
    dispatchAIBridgeChange();
  };

  const send = async (phase) => {
    if (disposed) {
      return;
    }

    const session = bridge.exportSession(undefined, phase === "update" ? "update" : "full");
    if (!session) {
      return;
    }

    const payload = JSON.stringify({ phase, session });
    if (phase === "update" && payload === lastPayload) {
      return;
    }

    lastPayload = payload;
    await fetch(liveEndpoint, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8"
      },
      body: payload
    }).catch(() => {});
  };

  const handleReady = () => { void send("ready"); };
  const handleUpdate = () => { void send("update"); };
  const handleDispose = () => { void send("dispose"); };

  window.__TERAJS_DEVTOOLS_LIVE_ATTACH__?.stop?.();
  window.addEventListener("terajs:devtools:bridge:ready", handleReady);
  window.addEventListener("terajs:devtools:bridge:update", handleUpdate);
  window.addEventListener("terajs:devtools:bridge:dispose", handleDispose);
  installAIBridge();
  void send("ready");

  window.__TERAJS_DEVTOOLS_LIVE_ATTACH__ = {
    stop() {
      disposed = true;
      uninstallAIBridge();
      window.removeEventListener("terajs:devtools:bridge:ready", handleReady);
      window.removeEventListener("terajs:devtools:bridge:update", handleUpdate);
      window.removeEventListener("terajs:devtools:bridge:dispose", handleDispose);
    }
  };

  return "Terajs DevTools live attach enabled.";
})();`;
}
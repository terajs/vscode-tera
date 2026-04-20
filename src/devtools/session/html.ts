import * as vscode from "vscode";
import { DEVTOOLS_EXPORT_SNIPPET } from "./snippets";
import type { DevtoolsCodeReference, DevtoolsSessionExport, SessionHtmlRenderOptions } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return String(timestamp);
  }
}

function formatCodeReferenceLocation(reference: DevtoolsCodeReference): string {
  if (reference.line === null) {
    return reference.file;
  }

  if (reference.column === null) {
    return `${reference.file}:${reference.line}`;
  }

  return `${reference.file}:${reference.line}:${reference.column}`;
}

function createNonce(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let nonce = "";

  for (let index = 0; index < 24; index += 1) {
    nonce += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return nonce;
}

export function createSessionHtmlRenderOptions(webview: vscode.Webview): SessionHtmlRenderOptions {
  return {
    cspSource: webview.cspSource,
    scriptNonce: createNonce(),
    enableCodeReferenceActions: true
  };
}

function renderMetric(label: string, value: string): string {
  return `
    <div class="metric-card">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function renderStringList(title: string, items: string[]): string {
  if (items.length === 0) {
    return "";
  }

  return `
    <div class="panel" style="margin-top: 14px;">
      <h3>${escapeHtml(title)}</h3>
      <ul>
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>
  `;
}

export function renderSessionHtml(
  session: DevtoolsSessionExport,
  source: string,
  options: SessionHtmlRenderOptions = {}
): string {
  const warningCount = session.documentDiagnostics.filter((entry) => entry.severity === "warn").length;
  const infoCount = session.documentDiagnostics.filter((entry) => entry.severity === "info").length;
  const recentEvents = session.events.slice(-20).reverse();
  const documentSummary = session.document ?? null;
  const codeReferences = session.codeReferences.length > 0 ? session.codeReferences : session.snapshot.codeReferences;
  const scriptNonce = options.enableCodeReferenceActions ? (options.scriptNonce ?? createNonce()) : null;
  const cspSourcePrefix = options.cspSource ? `${options.cspSource} ` : "";
  const csp = [
    "default-src 'none'",
    `style-src ${cspSourcePrefix}'unsafe-inline'`,
    scriptNonce ? `script-src 'nonce-${scriptNonce}'` : "script-src 'none'"
  ].join("; ");
  const scriptMarkup = scriptNonce ? `
    <script nonce="${scriptNonce}">
      const vscode = acquireVsCodeApi();
      const readNumber = (value) => {
        if (!value) {
          return null;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };

      document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const button = target.closest('[data-action="open-code-reference"]');
        if (!(button instanceof HTMLButtonElement)) {
          return;
        }

        vscode.postMessage({
          type: "openCodeReference",
          reference: {
            file: button.dataset.file ?? "",
            line: readNumber(button.dataset.line),
            column: readNumber(button.dataset.column),
            summary: button.dataset.summary ?? null
          }
        });
      });
    </script>
  ` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terajs DevTools Session</title>
  <style>
    :root {
      color-scheme: light dark;
    }

    body {
      margin: 0;
      padding: 24px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      line-height: 1.5;
    }

    h1, h2, h3 {
      margin: 0 0 10px;
      font-weight: 600;
    }

    p {
      margin: 0 0 12px;
    }

    .page {
      display: grid;
      gap: 20px;
    }

    .hero {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 14px;
      padding: 18px;
      background: color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-textLink-foreground) 12%);
    }

    .muted {
      color: var(--vscode-descriptionForeground);
    }

    .grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }

    .metric-card,
    .panel {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 12px;
      padding: 14px;
      background: color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-sideBar-background) 6%);
    }

    .metric-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .metric-value {
      margin-top: 6px;
      font-size: 18px;
      font-weight: 600;
    }

    ul {
      margin: 0;
      padding-left: 18px;
    }

    li + li {
      margin-top: 8px;
    }

    .badge {
      display: inline-block;
      margin-right: 8px;
      padding: 1px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .badge.warn {
      color: var(--vscode-editorWarning-foreground);
      background: color-mix(in srgb, var(--vscode-editorWarning-foreground) 18%, transparent);
    }

    .badge.info {
      color: var(--vscode-textLink-foreground);
      background: color-mix(in srgb, var(--vscode-textLink-foreground) 16%, transparent);
    }

    code, pre {
      font-family: var(--vscode-editor-font-family, Consolas, monospace);
    }

    pre {
      white-space: pre-wrap;
      word-break: break-word;
      overflow: auto;
      margin: 0;
      padding: 12px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--vscode-editor-background) 80%, black 20%);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    th,
    td {
      text-align: left;
      vertical-align: top;
      padding: 8px 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    th {
      color: var(--vscode-descriptionForeground);
      font-weight: 600;
    }

    .pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .pill {
      padding: 3px 10px;
      border-radius: 999px;
      border: 1px solid var(--vscode-panel-border);
      color: var(--vscode-descriptionForeground);
      background: color-mix(in srgb, var(--vscode-editor-background) 92%, var(--vscode-button-background) 8%);
      font-size: 12px;
    }

    .reference-list {
      display: grid;
      gap: 12px;
    }

    .reference-card {
      display: grid;
      gap: 8px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 10px;
      padding: 12px;
      background: color-mix(in srgb, var(--vscode-editor-background) 93%, var(--vscode-textLink-foreground) 7%);
    }

    .reference-title {
      font-family: var(--vscode-editor-font-family, Consolas, monospace);
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
    }

    .reference-meta {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .action-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .link-button {
      appearance: none;
      border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
      border-radius: 8px;
      padding: 6px 10px;
      cursor: pointer;
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
      font: inherit;
    }

    .link-button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <h1>Terajs DevTools Session</h1>
      <p class="muted">Imported from ${escapeHtml(source)}. This inspector only reads the exported session payload; it does not connect to the browser or scrape page internals.</p>
      <div class="pill-row">
        <span class="pill">tab: ${escapeHtml(session.snapshot.activeTab)}</span>
        <span class="pill">theme: ${escapeHtml(session.snapshot.theme)}</span>
        <span class="pill">AI: ${escapeHtml(session.snapshot.ai.status)}</span>
        <span class="pill">events: ${escapeHtml(String(session.events.length))}</span>
      </div>
    </section>

    <section class="grid">
      ${renderMetric("Page title", documentSummary?.title || session.snapshot.document?.title || "Untitled")}
      ${renderMetric("Path", documentSummary?.path || session.snapshot.document?.path || "/")}
      ${renderMetric("Metadata warnings", String(warningCount))}
      ${renderMetric("Metadata info", String(infoCount))}
      ${renderMetric("Meta tags", String(documentSummary?.metaTags.length ?? session.snapshot.document?.metaTagCount ?? 0))}
      ${renderMetric("Head links", String(documentSummary?.linkTags.length ?? session.snapshot.document?.linkTagCount ?? 0))}
    </section>

    <section class="panel">
      <h2>AI Diagnosis</h2>
      <div class="grid">
        ${renderMetric("Assistant state", session.snapshot.ai.status)}
        ${renderMetric("Diagnosis summary", session.snapshot.ai.summary ?? "not available")}
        ${renderMetric("Likely causes", String(session.snapshot.ai.likelyCauses.length))}
        ${renderMetric("Next checks", String(session.snapshot.ai.nextChecks.length))}
      </div>
      <p class="muted" style="margin-top: 12px;">Likely cause hint: ${escapeHtml(session.snapshot.ai.likelyCause ?? "none")}</p>
      ${renderStringList("Likely Causes", session.snapshot.ai.likelyCauses)}
      ${renderStringList("Next Checks", session.snapshot.ai.nextChecks)}
      ${renderStringList("Suggested Fixes", session.snapshot.ai.suggestedFixes)}
    </section>

    <section class="panel">
      <h2>Metadata Checks</h2>
      ${session.documentDiagnostics.length === 0 ? `<p class="muted">No exported document-head diagnostics were reported.</p>` : `
        <ul>
          ${session.documentDiagnostics.map((entry) => `
            <li>
              <span class="badge ${escapeHtml(entry.severity)}">${escapeHtml(entry.severity)}</span>
              <strong>${escapeHtml(entry.message)}</strong>
              ${entry.detail ? `<div class="muted">${escapeHtml(entry.detail)}</div>` : ""}
            </li>
          `).join("")}
        </ul>
      `}
    </section>

    <section class="panel">
      <h2>Document Context</h2>
      ${!documentSummary ? `<p class="muted">No safe document context was exported with this session.</p>` : `
        <div class="grid">
          ${renderMetric("Language", documentSummary.lang ?? "not set")}
          ${renderMetric("Direction", documentSummary.dir ?? "not set")}
          ${renderMetric("Hash", documentSummary.hash ?? "none")}
          ${renderMetric("Query keys", documentSummary.queryKeys.length === 0 ? "none" : documentSummary.queryKeys.join(", "))}
        </div>
        <div class="panel" style="margin-top: 14px; padding: 0; overflow: hidden;">
          <table>
            <thead>
              <tr><th>Meta key</th><th>Source</th><th>Value</th></tr>
            </thead>
            <tbody>
              ${documentSummary.metaTags.length === 0 ? `<tr><td colspan="3" class="muted">No allowlisted meta tags were exported.</td></tr>` : documentSummary.metaTags.map((tag) => `
                <tr>
                  <td>${escapeHtml(tag.key)}</td>
                  <td>${escapeHtml(tag.source)}</td>
                  <td>${escapeHtml(tag.value)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        <div class="panel" style="margin-top: 14px; padding: 0; overflow: hidden;">
          <table>
            <thead>
              <tr><th>Link rel</th><th>Href</th><th>Notes</th></tr>
            </thead>
            <tbody>
              ${documentSummary.linkTags.length === 0 ? `<tr><td colspan="3" class="muted">No allowlisted head links were exported.</td></tr>` : documentSummary.linkTags.map((tag) => `
                <tr>
                  <td>${escapeHtml(tag.rel)}</td>
                  <td>${escapeHtml(tag.href)}</td>
                  <td>${escapeHtml(tag.sameOrigin ? "same-origin" : "cross-origin")}${tag.queryKeys.length > 0 ? ` | query keys: ${escapeHtml(tag.queryKeys.join(", "))}` : ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `}
    </section>

    <section class="panel">
      <h2>Runtime Summary</h2>
      <div class="grid">
        ${renderMetric("Mounted components", String(session.snapshot.mountedComponentCount))}
        ${renderMetric("Selected component", session.snapshot.selectedComponentKey ?? "none")}
        ${renderMetric("Assistant model", session.snapshot.ai.assistantModel)}
        ${renderMetric("Likely cause", session.snapshot.ai.likelyCause ?? "none")}
      </div>
      <p class="muted" style="margin-top: 12px;">Layout: ${escapeHtml(session.snapshot.layout.position)} / ${escapeHtml(session.snapshot.layout.panelSize)}. Persist preferences: ${session.snapshot.layout.persistPreferences ? "yes" : "no"}.</p>
    </section>

    <section class="panel">
      <h2>Code References</h2>
      ${codeReferences.length === 0 ? `<p class="muted">No issue-linked source locations were exported with this session.</p>` : `
        <div class="reference-list">
          ${codeReferences.map((reference) => `
            <article class="reference-card">
              <div class="reference-title">${escapeHtml(formatCodeReferenceLocation(reference))}</div>
              <div>${escapeHtml(reference.summary)}</div>
              <div class="reference-meta">${escapeHtml(reference.eventType)} | ${escapeHtml(reference.level)} | ${escapeHtml(formatDate(reference.timestamp))}</div>
              ${options.enableCodeReferenceActions ? `
                <div class="action-row">
                  <button
                    class="link-button"
                    type="button"
                    data-action="open-code-reference"
                    data-file="${escapeHtml(reference.file)}"
                    data-line="${reference.line ?? ""}"
                    data-column="${reference.column ?? ""}"
                    data-summary="${escapeHtml(reference.summary)}"
                  >Open in Editor</button>
                </div>
              ` : ""}
            </article>
          `).join("")}
        </div>
      `}
    </section>

    <section class="panel">
      <h2>Recent Events</h2>
      <div class="panel" style="padding: 0; overflow: hidden;">
        <table>
          <thead>
            <tr><th>Time</th><th>Type</th><th>Level</th></tr>
          </thead>
          <tbody>
            ${recentEvents.length === 0 ? `<tr><td colspan="3" class="muted">No events were exported.</td></tr>` : recentEvents.map((event) => `
              <tr>
                <td>${escapeHtml(formatDate(event.timestamp))}</td>
                <td>${escapeHtml(event.type)}</td>
                <td>${escapeHtml(event.level ?? "info")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>Browser Export Snippet</h2>
      <p class="muted">Run this in the browser console, then copy the JSON into VS Code and rerun the command.</p>
      <pre>${escapeHtml(DEVTOOLS_EXPORT_SNIPPET)}</pre>
    </section>
  </div>
  ${scriptMarkup}
</body>
</html>`;
}
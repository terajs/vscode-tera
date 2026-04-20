import { DEVTOOLS_EXPORT_SNIPPET } from "../session";

export function renderWaitingHtml(snippet: string): string {
  const escapedSnippet = snippet
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terajs Live DevTools Session</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      line-height: 1.55;
    }
    .panel {
      max-width: 880px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 14px;
      padding: 18px;
      background: color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-textLink-foreground) 6%);
    }
    pre {
      margin: 16px 0 0;
      padding: 14px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      border-radius: 10px;
      background: color-mix(in srgb, var(--vscode-editor-background) 78%, black 22%);
      font-family: var(--vscode-editor-font-family, Consolas, monospace);
    }
    .muted {
      color: var(--vscode-descriptionForeground);
    }
    code {
      font-family: var(--vscode-editor-font-family, Consolas, monospace);
    }
  </style>
</head>
<body>
  <div class="panel">
    <h1>Terajs Live DevTools Session</h1>
    <p class="muted">Waiting for a live DevTools attach. This receiver listens only on localhost, exposes the Ask Copilot bridge for this session, and can be discovered automatically by DevTools-enabled Terajs pages before you explicitly connect from the app.</p>
    <ol>
      <li>Open the Terajs page with DevTools mounted.</li>
      <li>Use the page-side Connect action when the VS Code receiver appears, or paste the attach snippet into the browser console for a manual attach.</li>
      <li>Keep the page open while the extension receives sanitized session updates and AI requests.</li>
    </ol>
    <p class="muted">Attach snippet:</p>
    <pre>${escapedSnippet}</pre>
    <p class="muted">Manual session export still works with <code>${DEVTOOLS_EXPORT_SNIPPET.replaceAll("<", "&lt;")}</code>.</p>
  </div>
</body>
</html>`;
}
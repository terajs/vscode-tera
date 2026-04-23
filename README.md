# Terajs - Tera Language Tools

Official VS Code extension for Terajs `.tera` single-file components.

Project links:

- Terajs project site: [terajs.com](https://terajs.com)
- Terajs documentation: [terajs.com/docs](https://terajs.com/docs)
- Source repository: [github.com/Thecodergabe/terajs](https://github.com/terajs/terajs)

## Install

- Marketplace: [Terajs - Tera Language Tools](https://marketplace.visualstudio.com/items?itemName=Terajs.terajs-tera-language-tools)
- Extensions search: search for `Terajs official`

The extension activates automatically in Terajs workspaces and provides the companion VS Code surface for the Terajs DevTools bridge.

## Features

- Registers the `.tera` language in VS Code
- Highlights `<template>`, `<script>`, `<style>`, `<meta>`, `<route>`, and `<ai>` blocks
- Validates Terajs-style YAML metadata blocks
- Surfaces inline diagnostics for malformed `meta` and `route` blocks
- Adds hover documentation and completions for `meta`, `route`, and `ai` fields
- Imports exported Terajs DevTools sessions so you can inspect safe page metadata, AI diagnostics context, and recent runtime events inside VS Code
- Mirrors live DevTools sessions through a localhost-only receiver, adds direct attached-site inspection in chat, and routes `Ask Copilot` requests through the VS Code language model API

## Included commands

- `Terajs: Copy DevTools Export Snippet`
- `Terajs: Inspect DevTools Session`
- `Terajs: Inspect Attached Site`
- `Terajs: Start Live DevTools Session`
- `Terajs: Copy Live DevTools Attach Snippet`
- `Terajs: Stop Live DevTools Session`

## Inspect an exported DevTools session

Workflow:

1. Run `Terajs: Copy DevTools Export Snippet` in VS Code.
2. Paste the snippet into the browser console on a page running Terajs DevTools.
3. Copy the JSON result.
4. Run `Terajs: Inspect DevTools Session` with that JSON in your clipboard, current selection, or active document.

The inspector only reads the exported session payload. It does not open a listener, scrape arbitrary DOM, or bypass the browser-side DevTools safety filters.

If the exported session includes `codeReferences`, the inspector can open those files directly in VS Code at the exported line and column so runtime diagnostics and AI suggestions can jump straight to likely implementation points.

## Live DevTools attach

If the current workspace contains `terajs.config.js`, `terajs.config.cjs`, `terajs.config.mjs`, or `terajs.config.ts`, the extension auto-starts the live receiver on activation. Running `Start Live DevTools Session` is still useful when you want to reveal the mirrored panel, restart the receiver intentionally, or generate a fresh one-session attach snippet.

Supported pairing paths:

1. Automatic app-side discovery: call `autoAttachVsCodeDevtoolsBridge()` from `@terajs/app/devtools` in a development build. The extension writes `node_modules/.cache/terajs/devtools-bridge.json` for active Terajs workspaces and also publishes a user-local fallback manifest, the Terajs Vite plugin serves that metadata at `/_terajs/devtools/bridge`, and the browser discovers the local receiver from that manifest. The page only starts streaming once you explicitly connect from the overlay or a custom shell.
2. Manual one-session pairing: run `Terajs: Start Live DevTools Session` or `Terajs: Copy Live DevTools Attach Snippet`, then paste the copied snippet into the browser console on a page where Terajs DevTools is mounted.

Once paired, the extension exposes three tokenized localhost routes on `127.0.0.1`:

- `/live/<token>` receives `ready`, `update`, and `dispose` payloads generated from `window.__TERAJS_DEVTOOLS_BRIDGE__.exportSession()` and returns a connection acknowledgement back to the page-side bridge controller.
- `/ai/<token>` handles `Ask Copilot` requests through the VS Code language model API, preferring GitHub Copilot when available and falling back to any accessible chat model.
- `/reveal/<token>` remains available for tooling that explicitly wants to reopen the mirrored panel, but the direct AI workflow no longer depends on it.

The automatic attach path also installs `window.__TERAJS_VSCODE_AI_ASSISTANT__` in the page so the DevTools overlay can route `Ask Copilot` through the attached extension bridge.

When a page connects, the extension also exposes a status bar entry, `Terajs: Inspect Attached Site`, the sticky `@terajs` chat participant, and the `getAttachedTerajsSiteDiagnostics` language-model tool so the same sanitized snapshot can be inspected directly in VS Code without reopening the mirrored panel first.

## Inspect an attached site in chat

Workflow:

1. Let the extension auto-start the live receiver or run `Terajs: Start Live DevTools Session`.
2. Open a Terajs development page with DevTools enabled and wait until the AI Diagnostics pane shows that a local VS Code receiver is available.
3. Use `Connect VS Code Bridge` in the page, or paste the manual attach snippet when you want a one-session pairing.
4. Run `Terajs: Inspect Attached Site` or ask `@terajs /inspect` in chat.

The participant also supports `@terajs /events` and `@terajs /metadata` for narrower debugging passes over the attached runtime snapshot.

Live sessions use the same inspector surface, including clickable code references that resolve against the current VS Code workspace when the browser exports source-linked issues.

This bridge is development-only. Production app builds do not expose the bridge manifest route, the auto-attach wiring, or the DevTools bootstrap path.

Safety model:

- The page does not open a listener port.
- Automatic discovery does not stream the live session until the page or custom shell explicitly connects.
- The extension listens only on `127.0.0.1`.
- The attach URL includes a random per-session token.
- The browser only sends the safe exported DevTools session, not arbitrary DOM content.
- If the DevTools bridge is disabled, the attach snippet fails instead of silently widening access.
- `Ask Copilot` and attached-site chat inspection only send the sanitized bundle that DevTools already assembled, and the extension surfaces permission, quota, and missing-model errors back to the overlay instead of silently falling back to raw page access.

## Need help?

- Terajs docs: [terajs.com/docs](https://terajs.com/docs)
- Terajs repository: [github.com/Thecodergabe/terajs](https://github.com/terajs/terajs)
- Terajs issues: [github.com/Thecodergabe/terajs/issues](https://github.com/terajs/terajs/issues)
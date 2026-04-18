# Terajs - Tera Language Tools

Official VS Code extension for Terajs `.tera` single-file components.

Project links:

- Terajs project site: [terajs.com](https://terajs.com)
- Terajs documentation: [terajs.com/docs](https://terajs.com/docs)
- Source repository: [github.com/Thecodergabe/terajs](https://github.com/Thecodergabe/terajs)

## Features

- Registers the `.tera` language in VS Code
- Highlights `<template>`, `<script>`, `<style>`, `<meta>`, `<route>`, and `<ai>` blocks
- Validates Terajs-style YAML metadata blocks
- Surfaces inline diagnostics for malformed `meta` and `route` blocks
- Adds hover documentation and completions for `meta`, `route`, and `ai` fields
- Imports exported Terajs DevTools sessions so you can inspect safe page metadata, AI diagnostics context, and recent runtime events inside VS Code
- Mirrors live DevTools sessions through a localhost-only receiver and routes `Ask VS Code AI` requests through the VS Code language model API

## Inspect an exported DevTools session

Commands:

- `Terajs: Copy DevTools Export Snippet`
- `Terajs: Inspect DevTools Session`

Workflow:

1. Run `Terajs: Copy DevTools Export Snippet` in VS Code.
2. Paste the snippet into the browser console on a page running Terajs DevTools.
3. Copy the JSON result.
4. Run `Terajs: Inspect DevTools Session` with that JSON in your clipboard, current selection, or active document.

The inspector only reads the exported session payload. It does not open a listener, scrape arbitrary DOM, or bypass the browser-side DevTools safety filters.

If the exported session includes `codeReferences`, the inspector can open those files directly in VS Code at the exported line and column so runtime diagnostics and AI suggestions can jump straight to likely implementation points.

## Live DevTools attach

Commands:

- `Terajs: Start Live DevTools Session`
- `Terajs: Copy Live DevTools Attach Snippet`
- `Terajs: Stop Live DevTools Session`

If the current workspace contains `terajs.config.js`, `terajs.config.cjs`, `terajs.config.mjs`, or `terajs.config.ts`, the extension auto-starts the live receiver on activation. Running `Start Live DevTools Session` is still useful when you want to reveal the panel or generate a fresh one-session attach snippet.

Supported pairing paths:

1. Automatic app-side pairing: call `autoAttachVsCodeDevtoolsBridge()` from `@terajs/app/devtools` in a development build. The extension writes `node_modules/.cache/terajs/devtools-bridge.json`, the Terajs Vite plugin serves that metadata at `/_terajs/devtools/bridge`, and the browser uses that manifest to connect automatically.
2. Manual one-session pairing: run `Terajs: Start Live DevTools Session` or `Terajs: Copy Live DevTools Attach Snippet`, then paste the copied snippet into the browser console on a page where Terajs DevTools is mounted.

Once paired, the extension exposes three tokenized localhost routes on `127.0.0.1`:

- `/live/<token>` receives `ready`, `update`, and `dispose` payloads generated from `window.__TERAJS_DEVTOOLS_BRIDGE__.exportSession()`.
- `/ai/<token>` handles `Ask VS Code AI` requests through the VS Code language model API, preferring GitHub Copilot when available and falling back to any accessible chat model.
- `/reveal/<token>` lets the browser-side overlay reopen the mirrored VS Code panel through `Open VS Code Live Session`.

The automatic attach path also installs `window.__TERAJS_VSCODE_AI_ASSISTANT__` in the page so the DevTools overlay can route `Ask VS Code AI` and `Open VS Code Live Session` through the attached extension bridge.

Live sessions use the same inspector surface, including clickable code references that resolve against the current VS Code workspace when the browser exports source-linked issues.

Safety model:

- The page does not open a listener port.
- The extension listens only on `127.0.0.1`.
- The attach URL includes a random per-session token.
- The browser only sends the safe exported DevTools session, not arbitrary DOM content.
- If the DevTools bridge is disabled, the attach snippet fails instead of silently widening access.
- `Ask VS Code AI` only sends the sanitized prompt bundle that DevTools already assembled, and the extension surfaces permission, quota, and missing-model errors back to the overlay instead of silently falling back to raw page access.

## Local development

1. `cd vscode-tera`
2. `npm install --package-lock=false`
3. `npm run compile`
4. `npm run test:runtime`
5. Open the `vscode-tera` folder in VS Code and press `F5`

The included local launch configuration opens an Extension Development Host with the extension loaded.

## Package a local VSIX

1. `cd vscode-tera`
2. `npm install --package-lock=false`
3. `npm run compile`
4. `npm run package`
5. Install the generated `.vsix` with the VS Code CLI:

```powershell
$vsix = Get-ChildItem .\terajs-tera-language-tools-*.vsix | Sort-Object LastWriteTime -Descending | Select-Object -First 1
& "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd" --install-extension $vsix.FullName
```

Using `code.cmd` avoids the Windows case where `code` resolves to the GUI executable instead of the CLI shim.

## Prepare a Marketplace release

Useful commands:

- `npm run package` builds a local VSIX using the checked-in Apache-2.0 license file.
- `npm run test:runtime` compiles the extension and checks the live attach, auto-attach metadata, and AI bridge helpers against the built runtime.
- `npm run publish:status` reports remaining publish blockers without failing.
- `npm run publish:check` fails until the project is actually publish-ready.
- `npm run package:publish` packages only after the strict publish checks pass.

Before publishing to the Marketplace:

1. Bump the version in `package.json` and add the release note to `CHANGELOG.md`.
2. Confirm the publisher id in `package.json` is the account you intend to publish under.
3. Keep the root Apache-2.0 `LICENSE` file in place.
4. Run `npm run publish:check`.
5. Sign in with `vsce`.
6. Run `npm run publish`.

More detailed release notes live in `PUBLISHING.md`.
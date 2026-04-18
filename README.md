# Terajs .tera Tools

Local VS Code extension project for Terajs `.tera` single-file components.

What it does:

- registers the `.tera` language in VS Code
- highlights `<template>`, `<script>`, `<style>`, `<meta>`, `<route>`, and `<ai>` blocks
- validates Terajs-style YAML metadata blocks
- surfaces inline diagnostics for malformed `meta` and `route` blocks
- adds hover docs and completions for `meta`, `route`, and `ai` fields
- imports exported Terajs DevTools sessions so you can inspect safe page metadata, AI diagnostics context, and recent runtime events inside VS Code
- can mirror live DevTools sessions over a localhost-only receiver and answer `Ask VS Code AI` requests through the VS Code language model API

## DevTools session workflow

The extension now includes two commands:

- `Terajs: Copy DevTools Export Snippet`
- `Terajs: Inspect DevTools Session`

Use them like this:

1. Run `Terajs: Copy DevTools Export Snippet` in VS Code.
2. Paste the snippet into the browser console on a page running Terajs DevTools.
3. Copy the JSON result.
4. Run `Terajs: Inspect DevTools Session` with that JSON in your clipboard, current selection, or active document.

The inspector only reads the exported session payload. It does not open a port, scrape arbitrary DOM, or bypass the browser-side DevTools safety filters.

If the exported session includes `codeReferences`, the inspector can open those files directly in VS Code at the exported line and column so AI and runtime diagnostics can jump straight to likely implementation points.

## Live DevTools attach

The extension also supports an explicit live session workflow:

- `Terajs: Start Live DevTools Session`
- `Terajs: Copy Live DevTools Attach Snippet`
- `Terajs: Stop Live DevTools Session`

If the current workspace contains a `terajs.config.js`, `terajs.config.cjs`, `terajs.config.mjs`, or `terajs.config.ts` file, the extension auto-starts the live receiver on activation. Running `Start Live DevTools Session` is still useful when you want to reveal the panel or copy a fresh one-session attach snippet.

There are two supported pairing paths:

1. Automatic app-side pairing: call `autoAttachVsCodeDevtoolsBridge()` from `@terajs/app/devtools` in a development build. The extension writes `node_modules/.cache/terajs/devtools-bridge.json`, the Terajs Vite plugin serves that metadata at `/_terajs/devtools/bridge`, and the browser uses the manifest to connect automatically.
2. Manual one-session pairing: run `Terajs: Start Live DevTools Session` or `Terajs: Copy Live DevTools Attach Snippet`, then paste the copied snippet into the browser console on a page where Terajs DevTools is mounted.

Once paired, the extension exposes three tokenized localhost routes on `127.0.0.1`:

- `/live/<token>` receives `ready`, `update`, and `dispose` payloads generated from `window.__TERAJS_DEVTOOLS_BRIDGE__.exportSession()`.
- `/ai/<token>` handles `Ask VS Code AI` requests through the VS Code language model API, preferring GitHub Copilot when available and falling back to any accessible chat model.
- `/reveal/<token>` lets the browser-side overlay reopen the mirrored VS Code panel through `Open VS Code Live Session`.

The automatic attach path also installs `window.__TERAJS_VSCODE_AI_ASSISTANT__` in the page so the DevTools overlay can route `Ask VS Code AI` and `Open VS Code Live Session` through the attached extension bridge.

Live sessions use the same inspector surface, including clickable code references that resolve against the current VS Code workspace when the browser exports source-linked issues.

This is intentionally explicit and dev-only:

- the page does not open a listener port
- the extension listens only on `127.0.0.1`
- the attach URL includes a random per-session token
- the browser only sends the safe exported DevTools session, not arbitrary DOM content
- if the DevTools bridge is disabled, the attach snippet fails instead of silently widening access
- `Ask VS Code AI` only sends the sanitized prompt bundle that DevTools already assembled, and the extension surfaces permission, quota, and missing-model errors back to the overlay instead of silently falling back to raw page access

## Local development

1. `cd vscode-tera`
2. `npm install --package-lock=false`
3. `npm run compile`
4. `npm run test:runtime`
5. Open the `vscode-tera` folder in VS Code and press `F5`

The included local launch configuration opens an Extension Development Host with the extension loaded.

## Local install without debugging

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

## Publishing later

This project now separates local packaging from publish-ready packaging.

Useful commands:

- `npm run package` builds a local VSIX using the checked-in Apache-2.0 license file.
- `npm run test:runtime` compiles the extension and checks the live attach, auto-attach metadata, and AI bridge helpers against the built runtime.
- `npm run publish:status` reports the remaining publish blockers without failing.
- `npm run publish:check` fails until the project is actually publish-ready.
- `npm run package:publish` packages only after the strict publish checks pass.

Before publishing to the Marketplace:

1. Change `publisher` in `package.json` to your real publisher id.
2. Create that publisher in the Visual Studio Marketplace.
3. Keep the root Apache-2.0 `LICENSE` file in place.
4. Run `npm run publish:check`.
5. Sign in with `vsce`.
6. Run `npm run publish`.

More detailed marketplace notes live in `PUBLISHING.md`.
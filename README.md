# Terajs .tera Tools

Local VS Code extension project for Terajs `.tera` single-file components.

What it does:

- registers the `.tera` language in VS Code
- highlights `<template>`, `<script>`, `<style>`, `<meta>`, `<route>`, and `<ai>` blocks
- validates Terajs-style YAML metadata blocks
- surfaces inline diagnostics for malformed `meta` and `route` blocks
- adds hover docs and completions for `meta`, `route`, and `ai` fields
- imports exported Terajs DevTools sessions so you can inspect safe page metadata, AI diagnostics context, and recent runtime events inside VS Code
- can receive live DevTools session updates over an explicit localhost-only attach workflow

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

`Start Live DevTools Session` launches a localhost-only receiver in the extension and copies a one-session attach snippet to your clipboard. Paste that snippet into the browser console on a page where Terajs DevTools is mounted. After that, the extension receives live sanitized session updates and refreshes the inspector panel as the DevTools session changes.

Live sessions use the same inspector surface, including clickable code references that resolve against the current VS Code workspace when the browser exports source-linked issues.

This is intentionally explicit and dev-only:

- the page does not open a listener port
- the extension listens only on `127.0.0.1`
- the attach URL includes a random per-session token
- the browser only sends the safe exported DevTools session, not arbitrary DOM content
- if the DevTools bridge is disabled, the attach snippet fails instead of silently widening access

## Local development

1. `cd vscode-tera`
2. `npm install --package-lock=false`
3. `npm run compile`
4. Open the `vscode-tera` folder in VS Code and press `F5`

The included local launch configuration opens an Extension Development Host with the extension loaded.

## Local install without debugging

1. `cd vscode-tera`
2. `npm install --package-lock=false`
3. `npm run compile`
4. `npm run package`
5. Install the generated `.vsix` with the VS Code CLI:

```powershell
code --install-extension .\terajs-tera-language-tools-0.0.3.vsix
```

## Publishing later

This project now separates local packaging from publish-ready packaging.

Useful commands:

- `npm run package` builds a local VSIX using the checked-in Apache-2.0 license file.
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
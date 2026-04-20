# Changelog

All notable changes to `terajs-tera-language-tools` are documented in this file.

## 0.0.6

- Add the sticky `@terajs` chat participant, `Terajs: Inspect Attached Site`, and the attached-site status bar surface so connected pages can be inspected directly in chat from the current sanitized snapshot
- Register the `getAttachedTerajsSiteDiagnostics` language-model tool and route attached-site inspection through the local service bridge instead of requiring the mirrored panel-first workflow
- Track live receiver connection state and acknowledgements, render structured AI diagnosis details in the session inspector, and improve oversized live-payload handling with clean `413` responses
- Refresh the public docs around the explicit `Connect VS Code Bridge` flow, direct Copilot inspection, and the development-only safety model

## 0.0.5

- Refocus the public README on extension users instead of extension maintainers
- Remove local development, packaging, and Marketplace publish workflow from the Marketplace-facing readme surface
- Keep installation, Terajs project links, DevTools bridge usage, and support paths front and center

## 0.0.4

- Refresh the Marketplace and repository docs so the extension reads like an official Terajs release instead of a local-only project
- Link the extension back to the main Terajs project, documentation, and repository surfaces
- Clarify local packaging and Marketplace publishing steps for the next release cut

## 0.0.3

- Align top-level `template` and `script` tag-name scopes with the HTML tag-name family so Dark Modern and similar themes color them more consistently
- Restore Vue-like control-directive highlighting so `v-for` and related directives use keyword scopes
- Normalize SFC block tag names and brackets so top-level `template`, `script`, `style`, `meta`, `route`, and `ai` blocks no longer inherit ordinary HTML tag coloring

## 0.0.1

- Initial standalone Terajs `.tera` VS Code extension project
- TextMate grammar for `template`, `script`, `style`, `meta`, `route`, and `ai` blocks
- Inline diagnostics for malformed template and structured metadata blocks
- Hover docs and completions for `meta`, `route`, and `ai` fields
- Commands to copy a Terajs DevTools export snippet and inspect exported DevTools sessions inside VS Code
- Live localhost-only DevTools session attach commands for safe real-time session inspection
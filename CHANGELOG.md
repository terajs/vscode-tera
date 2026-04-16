# Changelog

## 0.0.3

- Align top-level `template` and `script` tag-name scopes with the HTML tag-name family so Dark Modern and similar themes color them like Vue SFC blocks
- Keep the previous directive and SFC bracket fixes while shipping a fresh VSIX version for an unambiguous reinstall

## 0.0.2

- Fix stale local reinstall confusion by shipping a new VSIX version for the updated grammar
- Restore Vue-like control-directive highlighting so `v-for` and related directives use keyword scopes
- Normalize SFC block tag names and brackets so top-level `template`, `script`, `style`, `meta`, `route`, and `ai` blocks no longer inherit ordinary HTML tag coloring

## 0.0.1

- Initial standalone Terajs .tera VS Code extension project
- TextMate grammar for template, script, style, meta, route, and ai blocks
- Inline diagnostics for malformed template and structured metadata blocks
- Hover docs and completions for meta, route, and ai fields
- Commands to copy a Terajs DevTools export snippet and inspect exported DevTools sessions inside VS Code
- Live localhost-only DevTools session attach commands for real-time safe session inspection
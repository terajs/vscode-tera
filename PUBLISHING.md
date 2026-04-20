# Publishing

This extension is published as part of the broader Terajs project:

- Project site: [terajs.com](https://terajs.com)
- Documentation: [terajs.com/docs](https://terajs.com/docs)
- Source repository: [github.com/Thecodergabe/terajs](https://github.com/Thecodergabe/terajs)

Marketplace releases are manual today.

Use this checklist before the next Marketplace release.

## 1. Bump the release version

Before publishing:

1. Update `version` in `package.json`.
2. Add the release notes to `CHANGELOG.md`.
3. Rebuild the extension so the packaged output matches the new release metadata.

## 2. Confirm the publisher id

The current manifest uses `Terajs` as the publisher id.

Before publishing:

1. Keep `publisher` as `Terajs` if you are publishing under the official Terajs Marketplace account.
2. Replace it only if you are intentionally publishing from a different Marketplace publisher.

## 3. Keep the Apache-2.0 license file in place

This project includes a real root `LICENSE` file, so packaging does not need `--skip-license`.

Before publishing:

1. Keep `LICENSE` at the project root.
2. Run the publish readiness checks again.

## 4. Verify publish readiness

Run:

```powershell
npm run compile
npm run publish:status
npm run publish:check
```

`publish:status` prints the current blockers and suggestions.

`publish:check` exits non-zero until required publish metadata is in place.

## 5. Authenticate, package, and publish

Once the project is publish-ready:

```powershell
vsce login <publisher-id>
npm run package:publish
npm run publish
```

If you are publishing under the existing official account, `<publisher-id>` should be `Terajs`.

## 6. Recommended follow-up improvements

- Add Marketplace screenshots or a short walkthrough GIF once the public UI settles
- Publish to Open VSX in addition to the Visual Studio Marketplace
- Automate packaging and release with CI once the publisher workflow is stable
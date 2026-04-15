# Publishing

This project is ready for local development and local VSIX packaging today.

To publish it for general VS Code usage later, finish the items below in order.

## 1. Replace the local publisher id

The current manifest uses `terajs-local` as a placeholder publisher.

Before publishing:

1. Create a real publisher in the Visual Studio Marketplace.
2. Replace the `publisher` field in `package.json` with that publisher id.

## 2. Add a real license file

Local packaging currently uses `--skip-license` because this project does not yet include a license file.

Before publishing:

1. Add the intended license file at the project root, such as `LICENSE`.
2. Run the publish readiness check again.

## 3. Verify publish readiness

Run:

```powershell
npm run publish:status
npm run publish:check
```

`publish:status` prints the current blockers and suggestions.

`publish:check` exits non-zero until required publish metadata is in place.

## 4. Authenticate and publish

Once the project is publish-ready:

```powershell
vsce login <your-publisher-id>
npm run package:publish
npm run publish
```

## 5. Optional next publish improvements

- add an extension icon
- add a marketplace banner and richer README screenshots
- publish to Open VSX in addition to the Visual Studio Marketplace
- automate packaging and release with CI once the publisher identity is stable
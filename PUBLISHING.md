# Publishing Claudian

This repository contains a local development tree and a public-release flow. Publish from an exported copy, not from the working tree directly.

## 1. Validate the repo

```bash
npm install
npm run typecheck
npm run test
npm run build
```

## 2. Export a sanitized public copy

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-public-repo.ps1
```

Default output is a timestamped folder near the source repository.

## 3. Verify the exported copy

Before pushing to GitHub, confirm:

- `README.md` is the public version
- `manifest.json` contains the public plugin metadata you want to ship
- `package.json` has no private author or local-only metadata you do not want public
- no real API keys appear in tracked files
- no machine-specific absolute paths appear in docs or examples
- no `.claudian`, `.obsidian`, session logs, or local runtime folders are present
- internal agent-only files such as `CLAUDE.md` and `AGENTS.md` are not present in the exported copy
- run `node scripts/audit-public-release.mjs <exported-folder>` if you want an extra automated check outside the export script
- Claude-maintainer-only workflows that require private OAuth secrets should not be present in the public export

## 4. Create the GitHub repository

Initialize git inside the exported folder and push that folder:

```bash
git init
git add .
git commit -m "Initial public release"
```

Then create your remote repository and push as usual.

## 5. Prepare a release

Release artifacts should include:

- `main.js`
- `manifest.json`
- `styles.css`

These are the three files Obsidian users need for manual installation or BRAT-based testing.

## Notes

- Keep [NOTICE.md](NOTICE.md) in public releases for attribution.
- Keep secrets in environment variables, never in committed settings.
- If you change branding, author, or repository links, update both `manifest.json` and `package.json` before exporting.

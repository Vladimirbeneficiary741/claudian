# Claudian

Claudian is an Obsidian desktop plugin that embeds coding agents directly into your vault. It supports Claude Code and Codex as primary providers, with optional DeepSeek-compatible routing through Codex using environment-based configuration.

This public version is prepared for GitHub release. Personal machine paths, vault-specific configuration, runtime session data, and private keys are intentionally excluded.

## Highlights

- Sidebar chat inside Obsidian
- Claude Code provider
- Codex provider
- Optional DeepSeek-compatible routing for Codex
- Inline edit with diff preview
- Slash commands, skills, and `@mentions`
- Multi-tab conversations
- MCP server support

## Install

1. Download `main.js`, `manifest.json`, and `styles.css` from a GitHub release.
2. Copy them into:

```text
.obsidian/plugins/claudian/
```

3. Enable `Claudian` in `Settings -> Community plugins`.

## Build from source

```bash
npm install
npm run build
```

## Secret Policy

- Never commit real API keys
- Never commit local `.claudian` or `.obsidian` runtime state
- Keep provider credentials in environment variables
- Keep machine-specific CLI paths in local-only settings

Example for DeepSeek-compatible Codex routing:

```text
DEEPSEEK_API_KEY=your-key
```

## Export a GitHub-safe copy

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-public-repo.ps1
```

The export script excludes local development and runtime artifacts and rewrites public metadata files for a cleaner release repository.
It also removes internal agent instruction files and local runtime folders that are not intended for publication.
The export flow runs a public-release audit so obvious machine paths, author metadata, and runtime folders are caught before publishing.

## License

MIT. See [LICENSE](LICENSE).

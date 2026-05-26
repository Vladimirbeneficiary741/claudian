# Claudian v2.0.2 - Public Release

Claudian brings provider-backed AI coding agents into the Obsidian sidebar.

This public release includes:

- Claude Code provider support
- Codex provider support
- Optional DeepSeek-compatible routing through Codex via environment configuration
- Multi-tab chat and conversation history
- Inline edit workflows with diff preview
- Slash commands, skills, and `@mentions`
- MCP integration support

## Release Assets

Download these files and place them in:

`.obsidian/plugins/claudian/`

Files:

- `main.js`
- `manifest.json`
- `styles.css`

Then enable `Claudian` in:

`Settings -> Community plugins`

## Notes

- This release is sanitized for public distribution.
- Local machine paths, private runtime folders, and private credentials are intentionally excluded.
- Provider credentials should be configured locally through environment variables or local plugin settings.
- If you want to build from source, see the repository README.

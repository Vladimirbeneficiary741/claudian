# Claudian v2.0.2

Claudian is an Obsidian desktop plugin that embeds provider-backed coding agents directly into your vault.

This release includes:

- Claude Code provider support
- Codex provider support
- Optional DeepSeek-compatible routing through Codex using environment-based configuration
- Inline edit workflows with diff preview
- Multi-tab chat and conversation history
- Slash commands, skills, and `@mentions`
- MCP integration support

## Installation

Download these files from the release and place them into:

`.obsidian/plugins/claudian/`

Files:

- `main.js`
- `manifest.json`
- `styles.css`

Then enable `Claudian` in:

`Settings -> Community plugins`

## Notes

- This release is sanitized for public distribution.
- Local machine paths, private runtime folders, and secrets are intentionally excluded.
- Provider credentials should be configured locally through environment variables or local plugin settings.

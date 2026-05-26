# Claudian

Claudian is an Obsidian desktop plugin that brings provider-backed AI coding agents into your vault sidebar.

It supports Claude Code and Codex as primary providers, with optional DeepSeek-compatible routing through Codex using environment-based configuration.

This public repository is prepared for GitHub release. Personal machine paths, vault-specific configuration, runtime session data, and private keys are intentionally excluded.

## Why Claudian

Claudian is designed for people who want an agent workflow inside Obsidian instead of a separate terminal or browser-only chat tool.

You can use it to:

- chat with a coding agent directly in your vault
- run multi-turn implementation and review workflows
- edit notes and project files from the sidebar
- use slash commands, skills, and `@mentions`
- keep multiple conversations open in tabs
- connect external tools through MCP

## Core Features

- Provider-backed sidebar chat for Obsidian
- Claude Code provider
- Codex provider
- Optional DeepSeek-compatible routing via Codex
- Inline edit flows with diff preview
- Multi-tab chat and conversation history
- Slash commands, skills, and mention-based context loading
- MCP server support

## Provider Model

### Claude Code

- Uses the local Claude Code CLI
- Best fit when you want Claude-native coding workflows in Obsidian
- Requires a Claude account and working Claude Code entitlement

### Codex

- Uses the local Codex CLI
- Works as an independent provider in the same Obsidian interface

### DeepSeek via Codex

- Uses environment-based configuration
- Keeps DeepSeek credentials out of committed repository state
- Useful when you want Codex UI with a DeepSeek-compatible backend

## Installation

### Install from a release

1. Download these files from the latest GitHub release:
   - `main.js`
   - `manifest.json`
   - `styles.css`
2. Create this folder inside your vault:

```text
.obsidian/plugins/claudian/
```

3. Copy the three files into that folder.
4. Open Obsidian and enable `Claudian` in `Settings -> Community plugins`.

### Build from source

```bash
npm install
npm run typecheck
npm run build
```

## Local Development

Useful commands:

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```

If you want development-time auto copy into a local vault, copy `.env.local.example` to `.env.local` and set your own vault path locally.

## Secrets and Privacy

This repository is structured so secrets do not need to live in git.

- Do not commit provider API keys
- Do not commit real `.claudian` or `.obsidian` runtime state
- Keep machine-specific CLI paths in local-only settings
- Prefer environment variables for provider credentials

Example for DeepSeek-compatible Codex routing:

```text
DEEPSEEK_API_KEY=your-key
OPENAI_API_KEY=${env:DEEPSEEK_API_KEY}
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

## Public Release Workflow

To generate a GitHub-safe copy from the source workspace:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-public-repo.ps1
```

The export flow:

- excludes local development and runtime artifacts
- removes internal instruction files such as `CLAUDE.md` and `AGENTS.md`
- clears public metadata fields like author information
- runs a public-release audit to catch obvious private paths and runtime leftovers

## Repository Layout

```text
src/
  app/
  core/
  features/
  providers/
    claude/
    codex/
    deepseek/
  shared/
  style/
  utils/
scripts/
tests/
```

## Attribution

This codebase is based on upstream Claudian work and includes local refactors and provider extensions. Keep [NOTICE.md](NOTICE.md) in any public redistribution.

## License

MIT. See [LICENSE](LICENSE).

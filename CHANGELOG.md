# Changelog

All notable changes to this public Claudian fork will be documented in this file.

## 2.0.2 - 2026-05-25

- Prepared the repository for public GitHub release with sanitized metadata and release documentation.
- Added a public-release audit script to detect obvious local paths, author metadata, runtime folders, and accidental secret-like strings.
- Hardened the public export script to exclude additional local runtime folders and validate the exported copy automatically.
- Kept provider support focused on Claude Code, Codex, and environment-based DeepSeek-compatible routing for Codex.

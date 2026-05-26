# Claudian v2.0.2 - Public Release

## English

Claudian brings provider-backed AI coding agents into the Obsidian sidebar.

This public release includes:

- Claude Code provider support
- Codex provider support
- Optional DeepSeek-compatible routing through Codex via environment configuration
- Multi-tab chat and conversation history
- Inline edit workflows with diff preview
- Slash commands, skills, and `@mentions`
- MCP integration support

### Release Assets

Download these files and place them in:

`.obsidian/plugins/claudian/`

Files:

- `main.js`
- `manifest.json`
- `styles.css`

Then enable `Claudian` in:

`Settings -> Community plugins`

### Notes

- This release is sanitized for public distribution.
- Local machine paths, private runtime folders, and private credentials are intentionally excluded.
- Provider credentials should be configured locally through environment variables or local plugin settings.
- If you want to build from source, see the repository README.

## 中文说明

Claudian 是一个把 AI 编码助手放进 Obsidian 侧边栏的插件。

这个公开版本包含：

- Claude Code provider 支持
- Codex provider 支持
- 通过 Codex 进行的 DeepSeek 兼容路由
- 多标签会话与历史
- Inline edit 和 diff 预览
- Slash commands、skills、`@mentions`
- MCP 集成支持

### 安装文件

下载以下文件，并放到：

`.obsidian/plugins/claudian/`

文件包括：

- `main.js`
- `manifest.json`
- `styles.css`

然后在 Obsidian 中启用：

`Settings -> Community plugins`

### 说明

- 这个 release 已经按公开发布场景做过脱敏。
- 本地机器路径、私有运行态目录、私有凭据都没有包含在发布内容里。
- provider 的凭据建议在本地通过环境变量或本地设置配置。
- 如果你要从源码构建，请查看仓库里的 README。

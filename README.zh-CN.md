# Claudian

Claudian 是一个运行在 Obsidian 桌面端里的 AI Agent 插件，可以把基于 provider 的编码助手直接放进你的知识库侧边栏。

当前主要支持：

- Claude Code
- Codex
- 通过 Codex 进行的 DeepSeek 兼容路由

这个公开仓库已经按 GitHub 发布场景做过脱敏处理，不包含个人机器路径、私有运行态目录、vault 私有内容或明文密钥。

## 语言

- English: [README.md](README.md)
- 简体中文：当前页面

## 这个插件适合做什么

Claudian 更像一个“在 Obsidian 里工作的 AI 协作台”，而不是单纯聊天窗口。

你可以用它来：

- 在 Obsidian 里直接和编码助手对话
- 多轮推进实现、调试、重构、评审任务
- 在侧边栏里编辑笔记或项目文件
- 使用 slash commands、skills、`@mentions`
- 同时保留多个 tab 会话
- 通过 MCP 连接外部工具

## 核心能力

- Obsidian 侧边栏 AI 会话
- Claude Code provider
- Codex provider
- 可选 DeepSeek 兼容路由
- Inline edit 与 diff 预览
- 多标签会话与历史
- Slash commands、skills、上下文引用
- MCP 集成

## Provider 说明

### Claude Code

- 使用本地 Claude Code CLI
- 适合偏 Claude 原生工作流的使用场景
- 需要可用的 Claude 账号和 Claude Code 权限

### Codex

- 使用本地 Codex CLI
- 作为独立 provider 接入同一个 Obsidian 界面

### DeepSeek via Codex

- 通过环境变量进行配置
- 不需要把 DeepSeek 密钥写进仓库
- 适合想保留 Codex UI，但走 DeepSeek 兼容后端的人

## 安装方式

### 从 Release 安装

1. 从 GitHub Release 下载这 3 个文件：
   - `main.js`
   - `manifest.json`
   - `styles.css`
2. 在你的 vault 里创建目录：

```text
.obsidian/plugins/claudian/
```

3. 把这 3 个文件复制进去
4. 打开 Obsidian，在 `Settings -> Community plugins` 里启用 `Claudian`

### 从源码构建

```bash
npm install
npm run typecheck
npm run build
```

## 本地开发

常用命令：

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
```

如果你希望开发时自动复制到本地 vault，可以把 `.env.local.example` 复制成 `.env.local`，然后只在本机填写你自己的 vault 路径。

## 密钥与隐私

这个仓库按“密钥不入库”的原则整理：

- 不要提交真实 API key
- 不要提交真实 `.claudian` 或 `.obsidian` 运行态目录
- 机器相关 CLI 路径只放在本地设置
- provider 凭据尽量走环境变量

DeepSeek 兼容路由示例：

```text
DEEPSEEK_API_KEY=your-key
OPENAI_API_KEY=${env:DEEPSEEK_API_KEY}
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

## 公开发布流程

如果你要从源码工作树导出一个适合 GitHub 公开发布的副本，可以运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-public-repo.ps1
```

这个导出流程会：

- 排除本地开发和运行态目录
- 删除 `CLAUDE.md`、`AGENTS.md` 这类内部说明文件
- 清空作者等公开元数据里的敏感信息
- 移除依赖私有维护 secret 的 workflow
- 对导出副本再做一次公开发布审计

## 仓库结构

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

## 署名与来源

这个代码库基于上游 Claudian 继续整理和扩展，公开分发时建议保留 [NOTICE.md](NOTICE.md)。

## License

MIT，见 [LICENSE](LICENSE)。

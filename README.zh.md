# Agent Dotfiles

[English](./README.md) | 中文

自用 AI Coding Agent 规范与实践合集。一部分根据自身工作流定制，一部分整理自社区经验。

## 仓库结构

| 文件 | 说明 |
|------|------|
| `AGENTS.template.md` | 主模板文件，包含所有 Agent 规则与约定。复制或软链接到各 Agent 的全局提示词路径即可。 |
| `scripts/sync-agent-config.js` | 自动将模板同步到多个 Agent 配置文件中（见下文）。 |

## 快速开始

### 先决条件

`AGENTS.template.md` 中的规则依赖以下 MCP 服务器，请提前安装：

- [Context7](https://github.com/upstash/context7) — 获取最新库文档
- [GitNexus](https://github.com/abhigyanpatwari/GitNexus) — 分析代码变更影响范围

### 同步配置到各 Agent

```bash
node scripts/sync-agent-config.js
```

脚本通过标记文本块将模板同步到各 Agent 的全局提示词文件中，与其他配置共存，重复运行自动更新已有块。

**支持的 Agent：**

| Agent | 目标路径 |
|-------|---------|
| Claude Code | `~/.claude/CLAUDE.md` |
| Codex (OpenAI) | `~/.codex/AGENTS.md` |
| Gemini CLI | `~/.gemini/GEMINI.md` |
| OpenCode | `~/.config/opencode/AGENTS.md` |

## 模板内容概览

`AGENTS.template.md` 涵盖以下规范分类：

- **通用** — 身份与交互协议、执行前规划、文档优先
- **网页内容获取** — 根据需求选择 `webfetch`（总结）或 `curl`（原始源码）
- **变更影响评估** — 修改前使用 GitNexus 分析影响范围、保持文档同步
- **编码原则与自我审查** — 扁平显式代码、最小耦合、可重写性，以及任务完成后的自检清单
- **项目构建** — 始终使用框架脚手架初始化；优先用命令行管理依赖
- **语言特定** — Go（使用 `go mod tidy` 而非 `go get`）
- **版本管理** — 未经用户确认不执行破坏性 Git 操作

完整规则请查阅 [`AGENTS.template.md`](AGENTS.template.md)。

## 实用工具

### `scripts/sync-agent-config.js`

将 `AGENTS.template.md` 同步到各支持 Agent 的全局提示词文件中。

```bash
node scripts/sync-agent-config.js        # 同步 / 更新
node scripts/sync-agent-config.js --delete # 删除已同步的标记块
node scripts/sync-agent-config.js --help   # 查看完整用法
```

- 使用标记块（`<!-- AGENT_DOTFILES_START -->` … `<!-- AGENT_DOTFILES_END -->`）管理内容
- 自动展开 `~` 为实际用户目录（跨平台兼容）
- 已有标记块时原地更新；无块时追加到文件末尾
- 非破坏性 — 不会覆盖文件中已有其他配置
- `--delete` / `-d` 可移除标记块，保留其他自定义配置
- `--help` / `-h` 显示用法说明

## 未来计划

- [ ] (Command) 同步不同语言的Readme，基于一个版本更新
- [ ] (Instruction) （对于brownfield）不要对之前的api有破坏性修改，防止之前的用户连不上
- [ ] 将每个session完成的部分记录下来
- [ ] 所有代码都应该经过测试
    - lint/build
    - 接口测试
    - 前端浏览器环境测试（playwright/browser-use）
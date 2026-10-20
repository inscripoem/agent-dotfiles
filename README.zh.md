# Agent Dotfiles

[English](./README.md) | 中文

自用 AI Coding Agent 规范与实践合集。一部分根据自身工作流定制，一部分整理自社区经验。

## 仓库结构

| 文件 | 说明 |
|------|------|
| `AGENTS.template.md` | 主模板文件，包含所有 Agent 规则与约定。复制或软链接到各 Agent 的全局提示词路径即可。 |
| `skills/` | 跨 Agent 技能（每个技能一个含 `SKILL.md` 的目录），由脚本的 `--skills` 模式分发。 |
| `vale/` | 可选的文件层硬校验：双档 Vale 样式包（error 级纯填充词 + warning 级软工黑话观察名单）及接线说明。见 [vale/README.md](vale/README.md)。 |
| `scripts/sync-agent-config.js` | 自动将模板同步到多个 Agent 配置文件，并将 `skills/` 分发到各 Agent 的 skills 目录（见下文）。 |

## 快速开始

### 先决条件

安装依赖：

```bash
bun install
```

`AGENTS.template.md` 中的规则使用以下 MCP 服务器：

- [Context7](https://github.com/upstash/context7) — 获取最新库文档
- [GitNexus](https://github.com/abhigyanpatwari/GitNexus)（可选）— 修改函数签名、导出 API 或共享模块前追踪调用方与依赖；不可用时通过仓库搜索与源码检查完成分析

### 同步配置到各 Agent

```bash
node scripts/sync-agent-config.js
```

打开两步交互选择器：先选同步内容（指令块和/或 skills），再选 Agent——默认全选。非交互旗标见[实用工具](#实用工具)。

**各 Agent 及其目标：**

| Agent | 指令文件 | Skills 目标目录 |
|-------|----------|-----------------|
| Claude Code（`claude`） | `~/.claude/CLAUDE.md` | `~/.claude/skills/` |
| Codex（`codex`） | `~/.codex/AGENTS.md` | `~/.agents/skills/`（共享） |
| DeepSeek Harness（`dsh`） | `~/.dsh/AGENTS.md` | `~/.agents/skills/`（共享） |
| Gemini CLI（`gemini`） | `~/.gemini/GEMINI.md` | `~/.agents/skills/`（共享） |
| Antigravity CLI（`agy`） | `~/.gemini/GEMINI.md` | `~/.gemini/antigravity-cli/skills/` |
| OpenCode（`opencode`） | `~/.config/opencode/AGENTS.md` | `~/.agents/skills/`（共享） |
| Pi（`pi`） | `~/.pi/agent/AGENTS.md` | `~/.agents/skills/`（共享） |
| Trae CN（`trae-cn`） | `~/.trae-cn/user_rules/agent-dotfiles.md` | `~/.trae-cn/skills/` |
| ZCode（`zcode`） | `~/.zcode/AGENTS.md` | `~/.agents/skills/`（共享） |

`~/.agents/skills/` 是共享目录：一次同步即可覆盖 ZCode、Codex、OpenCode、Gemini CLI、pi、dsh。Skills 是当前的跨 Agent 通用原语——在 ZCode、pi、Antigravity CLI、Claude Code 中可作为 slash command 调用；Codex 使用 `/skills` 或 `$name`；OpenCode 通过 `opencode/slash` 元数据字段暴露。

> dsh（DeepSeek Harness）从 `$DSH_HOME/AGENTS.md`（默认 `~/.dsh/AGENTS.md`）读取用户全局指令，请保持 `DSH_HOME` 未设置或指向 `~/.dsh`。其对 `~/.agents/skills` 的支持已于 2026 年 10 月实测验证。
>
> agy（Antigravity CLI）与 Gemini CLI 共享同一指令文件——两者同时勾选时只写入一次；删除时需要同时包含两者。

## 模板内容概览

`AGENTS.template.md` 涵盖以下规范分类：

- **通用** — 身份与交互协议、写代码前先规划（只读研究不受限制）、文档优先
- **写作风格** — 文档及所有面向用户的内容（包括网页和应用内文本）均使用书面用语；除非用户明确要求，否则避免过于口语化的表达
- **说人话** — 输出信息密集：每个论断都可替换为「具体动作 + 具体对象」；纯填充词（赋能、抓手、拉通）不出现；软工术语不禁用，但需精确用法、首次出现附一句解释并给具体对象
- **网页内容获取** — 根据需求选择 `webfetch`（总结）或 `curl`（原始源码）
- **密钥安全** — 绝不让密钥进入 AI context；通过 shell 管道传递（$(jq)、source、$VAR）
- **变更影响评估** — 修改函数签名、导出 API 或共享模块前追踪调用方与依赖，更新受影响的调用方与测试，执行相关检查，并同步文档引用；不得将空搜索结果视为无影响的证明
- **编码原则与自我审查** — 扁平显式代码、最小耦合、可重写性，以及任务完成后的自检清单
- **项目构建** — 始终使用框架脚手架初始化；优先用命令行管理依赖
- **CLI 优先于直接 API 调用** — 已知 API 有对应 CLI 时，先确认其可用且能完成所需操作；除非用户明确要求直接调用 API，否则优先使用 CLI，以减少不必要的限流问题（如使用 `gh` 操作 GitHub）
- **语言特定** — Go（使用 `go mod tidy` 而非 `go get`）
- **版本管理** — 未经用户确认不执行破坏性 Git 操作；提交时整文件提交，不进行切片

完整规则请查阅 [`AGENTS.template.md`](AGENTS.template.md)。

## 实用工具

### `scripts/sync-agent-config.js`

选择模型——三个轴，对所有类别完全一致：

- **动词**：`sync`（默认）· `--status`（只读）· `--delete`
- **类别**：指令块 · skills——裸命令覆盖全部类别；`--instructions` / `--skills` 收窄到单一类别
- **范围**：`--agents <ids>`（默认 `all`；裸 sync/delete 不带它时先交互确认）

```bash
# 同步
node scripts/sync-agent-config.js                          # 交互式：先选内容，再选 Agent
node scripts/sync-agent-config.js --agents all             # 所有类别，全部范围
node scripts/sync-agent-config.js --skills --agents claude # 单一类别，单一范围

# 查看
node scripts/sync-agent-config.js --status                 # 所有类别的状态
node scripts/sync-agent-config.js --skills --status        # 仅 skills 状态
node scripts/sync-agent-config.js --dry-run --agents all   # 预览，不写入

# 移除
node scripts/sync-agent-config.js --delete                 # 交互确认范围
node scripts/sync-agent-config.js --delete --agents claude # 单一范围
node scripts/sync-agent-config.js --skills --delete --agents all  # 单一类别，全部范围
```

- 两步交互：裸命令先问内容、再问 Agent；同一份选择驱动所有类别，取消勾选的 Agent 其托管内容会被移除
- `--prune-unselected`：与 `--agents` 连用时同时清除未选中 Agent 的托管内容——对所有类别一致生效
- 指令块：各 Agent 全局配置中的标记块（`<!-- AGENT_DOTFILES_START -->` … `<!-- AGENT_DOTFILES_END -->`）；更新只重写该块，原地进行，不触碰周边配置
- Skills 所有权：每个目标目录中的 `.agent-dotfiles-manifest.json` 记录本脚本托管的 skills——非托管 skills 永不被覆盖或清理；已从仓库移除的托管 skills 会在下次同步时清理；非托管同名 skill 会被报告并跳过
- 符号链接策略：目标为符号链接时默认跳过并警告（绝不静默接管 stow 式配置）；`--follow-symlinks` 可穿透链接写入，多个 Agent 链接到同一文件时只写一次；删除时若会波及未包含的共享文件则拒绝执行
- `--dry-run` 预览不写入；`~` 跨平台展开
- 测试：`npm test`（使用 Node 内置测试运行器，无额外依赖）

## 未来计划

- [ ] (Command) 同步不同语言的Readme，基于一个版本更新
- [ ] (Instruction) （对于brownfield）不要对之前的api有破坏性修改，防止之前的用户连不上
- [ ] 将每个session完成的部分记录下来
- [ ] 所有代码都应该经过测试
    - lint/build
    - 接口测试
    - 前端浏览器环境测试（playwright/browser-use）

## 另请参阅

- [plain-language-research.md](说人话机制的研究与设计依据——论点、核查记录、社区扫描、词表来源、参考链接)
- [inspirations.md](灵感来源)

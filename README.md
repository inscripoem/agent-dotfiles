# Agent Dotfiles

English | [中文](./README.zh.md)

A personal collection of conventions and best practices for AI coding agents. Partly tailored for my own workflows, partly collected from the community.

## Repository Structure

| File | Purpose |
|------|---------|
| `AGENTS.template.md` | The main template containing all agent rules and conventions. Copy or symlink this into your agent's global instructions path. |
| `scripts/sync-agent-config.js` | Syncs `AGENTS.template.md` into multiple agent config files automatically (see below). |

## Quick Start

### Prerequisites

Install dependencies:

```bash
bun install
```

Install the following MCP servers used by the rules in `AGENTS.template.md`:

- [Context7](https://github.com/upstash/context7) — fetch up-to-date library docs
- [GitNexus](https://github.com/abhigyanpatwari/GitNexus) — analyze change impact across the codebase

### Sync Configuration to Your Agents

```bash
node scripts/sync-agent-config.js
```

Opens interactive multi-select with all agents selected by default. Use `--agents` to skip interactive mode.

```bash
# Interactive (default: all selected)
node scripts/sync-agent-config.js

# Non-interactive: sync all agents
node scripts/sync-agent-config.js --agents all

# Non-interactive: sync specific agents
node scripts/sync-agent-config.js --agents claude,codex
```

**Supported agents:**

| ID | Agent | Target Path |
|----|-------|-------------|
| `claude` | Claude Code | `~/.claude/CLAUDE.md` |
| `codex` | Codex (OpenAI) | `~/.codex/AGENTS.md` |
| `gemini` | Gemini CLI | `~/.gemini/GEMINI.md` |
| `opencode` | OpenCode | `~/.config/opencode/AGENTS.md` |
| `trae-cn` | Trae CN | `~/.trae-cn/rules/agent-dotfiles.md` |

## What's Inside the Template

`AGENTS.template.md` covers the following categories:

- **General** — identity protocol, planning before execution, documentation-first approach
- **Web Content Retrieval** — choose `webfetch` for summaries or `curl` for raw source
- **Change Impact Assessment** — using GitNexus before modifications, keeping docs in sync
- **Coding Principles and Self-Review** — flat explicit code, minimal coupling, regenerability, and post-task self-review checklist
- **Project Setup** — always use framework scaffolding; use CLI for dependency management
- **Language-Specific** — Go (`go mod tidy` over `go get`)
- **Version Control** — avoid destructive Git operations without explicit user confirmation; commit whole files, not partial slices

For the full rules, open [`AGENTS.template.md`](AGENTS.template.md).

## Utility Tools

### `scripts/sync-agent-config.js`

Syncs `AGENTS.template.md` into the global instruction files of supported agents.

```bash
node scripts/sync-agent-config.js                          # Interactive (default: all selected)
node scripts/sync-agent-config.js --agents all             # Sync all (non-interactive)
node scripts/sync-agent-config.js --agents claude,codex    # Sync specific agents (non-interactive)
node scripts/sync-agent-config.js --delete                 # Remove all managed blocks
node scripts/sync-agent-config.js --delete --agents claude # Remove from specific agents
node scripts/sync-agent-config.js --help                   # Show full usage
```

- Default: interactive multi-select with all agents selected
- `--agents`: skips interactive, syncs specified agents (or "all")
- Coverage behavior: unselected agents get their blocks removed
- Uses marked blocks (`<!-- AGENT_DOTFILES_START -->` … `<!-- AGENT_DOTFILES_END -->`)
- Expands `~` to the real home directory (cross-platform)
- Updates existing blocks in place; appends at EOF if absent
- Non-destructive — never overwrites unrelated config
- Trae CN: adds YAML frontmatter for rule activation (`alwaysApply: true`)
- `--delete` / `-d` removes managed blocks while preserving other custom config
- `--help` / `-h` shows usage information

## Roadmap

- [ ] (Command) Sync READMEs across languages, updating from a single source
- [ ] (Instruction) For brownfield projects, avoid breaking changes to existing APIs to prevent disrupting current users
- [ ] Record completed items from each session
- [ ] All code should be tested
    - lint / build
    - API testing
    - Frontend browser testing (Playwright / browser-use)

## See Also

- [inspirations.md](Inspirations)
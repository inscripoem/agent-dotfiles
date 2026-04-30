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

Install the following MCP servers used by the rules in `AGENTS.template.md`:

- [Context7](https://github.com/upstash/context7) — fetch up-to-date library docs
- [GitNexus](https://github.com/abhigyanpatwari/GitNexus) — analyze change impact across the codebase

### Sync Configuration to Your Agents

```bash
node scripts/sync-agent-config.js
```

Inserts the template into the global instructions of supported agents using marker blocks, so it coexists with your existing config and updates in place on subsequent runs.

**Supported agents:**

| Agent | Target Path |
|-------|-------------|
| Claude Code | `~/.claude/CLAUDE.md` |
| Codex (OpenAI) | `~/.codex/AGENTS.md` |
| Gemini CLI | `~/.gemini/GEMINI.md` |
| OpenCode | `~/.config/opencode/AGENTS.md` |

## What's Inside the Template

`AGENTS.template.md` covers the following categories:

- **General** — identity protocol, planning before execution, documentation-first approach
- **Web Content Retrieval** — choose `webfetch` for summaries or `curl` for raw source
- **Change Impact Assessment** — using GitNexus before modifications, keeping docs in sync
- **Coding Principles and Self-Review** — flat explicit code, minimal coupling, regenerability, and post-task self-review checklist
- **Project Setup** — always use framework scaffolding; use CLI for dependency management
- **Language-Specific** — Go (`go mod tidy` over `go get`)
- **Version Control** — avoid destructive Git operations without explicit user confirmation

For the full rules, open [`AGENTS.template.md`](AGENTS.template.md).

## Utility Tools

### `scripts/sync-agent-config.js`

Syncs `AGENTS.template.md` into the global instruction files of supported agents.

```bash
node scripts/sync-agent-config.js        # Sync / update
node scripts/sync-agent-config.js --delete # Remove synced marker blocks
node scripts/sync-agent-config.js --help   # Show full usage
```

- Uses marked blocks (`<!-- AGENT_DOTFILES_START -->` … `<!-- AGENT_DOTFILES_END -->`)
- Expands `~` to the real home directory (cross-platform)
- Updates existing blocks in place; appends at EOF if absent
- Non-destructive — never overwrites unrelated config
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
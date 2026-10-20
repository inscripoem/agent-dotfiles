# Agent Dotfiles

English | [中文](./README.zh.md)

A personal collection of conventions and best practices for AI coding agents. Partly tailored for my own workflows, partly collected from the community.

## Repository Structure

| File | Purpose |
|------|---------|
| `AGENTS.template.md` | The main template containing all agent rules and conventions. Copy or symlink this into your agent's global instructions path. |
| `skills/` | Cross-agent skills (one folder with a `SKILL.md` per skill), distributed by the script's `--skills` mode. |
| `vale/` | Optional file-layer enforcement: a two-tier Vale style pack (error-tier filler words, warning-tier software-jargon watch list) with wiring notes. See [vale/README.md](vale/README.md). |
| `scripts/sync-agent-config.js` | Syncs `AGENTS.template.md` into multiple agent config files and `skills/` into the agents' skills directories (see below). |

## Quick Start

### Prerequisites

Install dependencies:

```bash
bun install
```

The rules in `AGENTS.template.md` use the following MCP servers:

- [Context7](https://github.com/upstash/context7) — fetch up-to-date library docs
- [GitNexus](https://github.com/abhigyanpatwari/GitNexus) (optional) — trace callers and dependencies before changing function signatures, exported APIs, or shared modules; use repository search and source inspection when unavailable

### Sync Configuration to Your Agents

```bash
node scripts/sync-agent-config.js
```

Opens a two-step interactive picker: what to sync (instruction blocks and/or skills), then which agents — everything selected by default. Non-interactive flags are listed under [Utility Tools](#utility-tools).

**Agents and their targets:**

| Agent | Instruction file | Skills destination |
|-------|------------------|--------------------|
| Claude Code (`claude`) | `~/.claude/CLAUDE.md` | `~/.claude/skills/` |
| Codex (`codex`) | `~/.codex/AGENTS.md` | `~/.agents/skills/` (shared) |
| DeepSeek Harness (`dsh`) | `~/.dsh/AGENTS.md` | `~/.agents/skills/` (shared) |
| Gemini CLI (`gemini`) | `~/.gemini/GEMINI.md` | `~/.agents/skills/` (shared) |
| Antigravity CLI (`agy`) | `~/.gemini/GEMINI.md` | `~/.gemini/antigravity-cli/skills/` |
| OpenCode (`opencode`) | `~/.config/opencode/AGENTS.md` | `~/.agents/skills/` (shared) |
| Pi (`pi`) | `~/.pi/agent/AGENTS.md` | `~/.agents/skills/` (shared) |
| Trae CN (`trae-cn`) | `~/.trae-cn/user_rules/agent-dotfiles.md` | `~/.trae-cn/skills/` |
| ZCode (`zcode`) | `~/.zcode/AGENTS.md` | `~/.agents/skills/` (shared) |

`~/.agents/skills/` is the shared directory: one sync covers ZCode, Codex, OpenCode, Gemini CLI, pi, and dsh. Skills are the cross-agent primitive — invocable as slash commands in ZCode, pi, Antigravity CLI, and Claude Code; via `/skills` or `$name` in Codex; via the `opencode/slash` metadata flag in OpenCode.

> dsh (DeepSeek Harness) reads its user-global instructions from `$DSH_HOME/AGENTS.md` (default `~/.dsh/AGENTS.md`); keep `DSH_HOME` unset or pointing at `~/.dsh`. Its `~/.agents/skills` discovery has been verified live (October 2026).
>
> agy (Antigravity CLI) shares the Gemini CLI instruction file — selecting both writes it once, and deleting requires including both.

## What's Inside the Template

`AGENTS.template.md` covers the following categories:

- **General** — identity protocol, planning before writing code (with read-only investigation freely permitted), documentation-first approach
- **Writing Style** — use formal written language in documentation and all user-facing content, including websites and in-app text; avoid overly colloquial expressions unless explicitly requested by the user
- **Plain Language** — information-dense statements: every claim replaceable by a concrete action on a concrete object; filler words (赋能、抓手、拉通) never appear; software jargon is not banned but requires precise meaning, a first-occurrence explanation, and a concrete object
- **Web Content Retrieval** — choose `webfetch` for summaries or `curl` for raw source
- **Secret Security** — never read secrets into context; pipe values through shell ($(jq), source, $VAR)
- **Change Impact Assessment** — trace callers and dependencies before changing function signatures, exported APIs, or shared modules; update affected callers and tests, run relevant checks, and keep document references in sync; empty search results do not prove absence of impact
- **Coding Principles and Self-Review** — flat explicit code, minimal coupling, regenerability, and post-task self-review checklist
- **Project Setup** — always use framework scaffolding; use CLI for dependency management
- **CLI Before Direct APIs** — when an API has a known CLI, confirm it is available and can perform the operation, then prefer it unless the user explicitly requests a direct API call, reducing avoidable rate-limit issues (for example, `gh` for GitHub)
- **Language-Specific** — Go (`go mod tidy` over `go get`)
- **Version Control** — avoid destructive Git operations without explicit user confirmation; commit whole files, not partial slices

For the full rules, open [`AGENTS.template.md`](AGENTS.template.md).

## Utility Tools

### `scripts/sync-agent-config.js`

Selection model — three axes, identical for every kind:

- **Verb**: `sync` (default) · `--status` (read-only) · `--delete`
- **Kind**: instructions · skills — a bare command covers every kind; `--instructions` / `--skills` narrow it
- **Scope**: `--agents <ids>` (default `all`; bare sync/delete without it ask interactively)

```bash
# Sync
node scripts/sync-agent-config.js                          # Interactive: what, then which agents
node scripts/sync-agent-config.js --agents all             # Every kind, everywhere
node scripts/sync-agent-config.js --skills --agents claude # One kind, one scope

# Inspect
node scripts/sync-agent-config.js --status                 # State of every kind
node scripts/sync-agent-config.js --skills --status        # One kind only
node scripts/sync-agent-config.js --dry-run --agents all   # Preview without writing

# Remove
node scripts/sync-agent-config.js --delete                 # Interactive scope confirmation
node scripts/sync-agent-config.js --delete --agents claude # One scope
node scripts/sync-agent-config.js --skills --delete --agents all  # One kind, everywhere
```

- Two-step interactive: bare runs ask what, then which agents; one selection drives every kind, and deselected agents get their managed content removed
- `--prune-unselected`: with `--agents`, also removes unselected agents' managed content — applies to all kinds
- Instruction blocks: marked blocks (`<!-- AGENT_DOTFILES_START -->` … `<!-- AGENT_DOTFILES_END -->`) inside each agent's global config; updates rewrite only that block, in place, never touching surrounding config
- Skills ownership: `.agent-dotfiles-manifest.json` in each destination records managed skills — foreign skills are never overwritten or pruned, skills removed from the repository are pruned on the next sync, and unowned same-name skills are reported and skipped
- Symlink policy: symlinked targets are skipped with a warning by default (stow-style setups are never taken over); `--follow-symlinks` writes through links, deduplicating agents that share one file; deletion refuses to touch a shared file unless every sharer is included
- `--dry-run` previews without writing; `~` expands cross-platform
- Tests: `npm test` (Node's built-in test runner, no dependencies)


## Roadmap

- [ ] (Command) Sync READMEs across languages, updating from a single source
- [ ] (Instruction) For brownfield projects, avoid breaking changes to existing APIs to prevent disrupting current users
- [ ] Record completed items from each session
- [ ] All code should be tested
    - lint / build
    - API testing
    - Frontend browser testing (Playwright / browser-use)

## See Also

- [plain-language-research.md](Plain Language research & rationale — thesis, fact-check log, community scan, word-list provenance, sources)
- [inspirations.md](Inspirations)

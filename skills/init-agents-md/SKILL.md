---
name: init-agents-md
description: |
  Create, audit, or update a repository-level AGENTS.md from verified repository evidence. Use for 「生成 AGENTS.md」「初始化 agents.md」「审查/更新 AGENTS.md」 and for reconciling a shared AGENTS.md with CLAUDE.md or nested agent instruction files. Not for general README or documentation writing, and not for tool-specific rule files unless the user explicitly asks to coordinate them.
metadata:
  opencode/slash: "true"
---

# Initialize AGENTS.md

Create a concise, project-specific instruction file that a new coding agent can
use without reading the entire repository. Investigate first; do not generate
from a generic template.

This skill does not override the active agent's approval policy or the user's
global instructions.

## Workflow

### 1. Reconnaissance

Read the repository without modifying it:

- Locate the repository root and every existing `AGENTS.md`,
  `AGENTS.override.md`, `CLAUDE.md`, and tool-specific instruction file.
- Read the README, manifests, lockfiles, CI workflows, build and test config,
  deployment config, and top-level source layout.
- Inspect scripts and entry points to identify the real setup, development,
  test, lint, type-check, and build commands.
- Identify generated files, vendored code, data schemas, migrations, secrets
  boundaries, and server/client or package dependency boundaries.
- For a monorepo, identify projects with genuinely different commands,
  ownership, or constraints.

Do not read secret values or files such as `.env`, credential stores, private
keys, or files whose names indicate secrets. File names and config keys are
enough to understand the repository.

### 2. Decide scope

Answer these questions before writing:

- Does this rule apply to everyone working in the repository?
- Is it a root rule or a rule for one subtree?
- Can an agent infer it cheaply from code, scripts, or tooling?
- Is it a project requirement, a personal preference, or a hard permission
  rule that belongs in hooks, CI, permissions, or a sandbox?
- Does the repository have durable guidance worth loading in every session?

Name concrete directories for toolchain and project boundaries. Do not
generalize a subtree's tooling to a parent directory without evidence covering
the whole parent directory.

If the answer is only generic advice or information already obvious from the
repository, omit it. If there is no durable guidance, report that creating or
changing `AGENTS.md` is not justified.

Do not copy this skill's own approval, secret-handling, or Git rules into the
output. Include a security or workflow rule only when it names a
repository-specific path, mechanism, or irreversible operation.

### 3. Draft the relevant sections

Use only sections that carry repository-specific information. Common choices:

- Project purpose and non-obvious domain model
- Setup, build, test, lint, and single-test commands
- Architecture and directory boundaries
- Testing and verification rules
- Repository-specific code conventions
- Generated, vendored, migration, or data boundaries
- Security and operational traps
- PR and commit requirements, when the repository actually documents them
- Conditional references to deeper docs or canonical examples

Put executable commands near the top. For every command, state its working
directory, dependency and environment prerequisites, and any required wrapper,
flags, or single-test syntax. Distinguish CI-only setup from commands directly
runnable after the documented prerequisites. Check prerequisites before
execution; mark commands that cannot be executed as unverified.

Do not copy the README, a complete style guide, API reference, or generic
software-engineering advice. Link to a canonical document instead of repeating
it.

Default to one root `AGENTS.md`. Add a nested file only when a subtree has
materially different commands or constraints. Nested files should contain
incremental guidance, not a copy of the root rules.

### 4. Respect existing agent instructions

- If `AGENTS.md` exists, read it first and merge only supported updates.
- Preserve user-written content unless the user explicitly asks for a rewrite.
- Report personal/global rules that do not belong in the project file; do not
  silently delete them from an existing file.
- If `CLAUDE.md`, `.claude/CLAUDE.md`, or another tool-specific file exists,
  inspect it for conflicts and duplication.
- Do not edit `CLAUDE.md` or tool-specific files unless the user asks.
- Do not assume every agent uses the same discovery or precedence rules.
  Keep the root file independently useful and avoid contradictory parent/child
  instructions.

### 5. Verify before finishing

- Confirm each referenced path exists.
- Confirm each command is defined in a manifest, Makefile, task runner, CI, or
  script.
- Check for stale architecture claims by reading the current source, not only
  the README or an old `AGENTS.md`.
- Check for conflicts with existing `AGENTS.md`, `CLAUDE.md`, and nested files.
- Check for personal paths, secrets, generic boilerplate, duplicated README
  content, and rules already enforced by linters or formatters.
- Trace non-obvious claims to source paths or symbols. Drop claims that have
  no source.
- Trace runtime behavior through the code before calling a command a
  verification step. The existence of a command does not prove that it
  exercises the user's local change.
- Copy exact filesystem paths from tool output. Do not abbreviate nested or
  dynamic route segments.
- Treat a repository convention as a rule only when documentation, CI, or
  repeated enforcement supports it. Recent commit history is only an
  observation and cannot by itself prove commit or PR conventions.
- Never merge to a default branch, push, deploy, or change external state just
  to verify local behavior.
- Keep ordinary files around 30-80 lines. Treat 200 lines as a soft warning;
  Codex reads at most 32 KiB of project instructions by default.
- Run only harmless verification commands. Do not install dependencies, start
  services, change configuration, or execute destructive commands unless the
  user explicitly authorizes them.
- Review `git diff -- AGENTS.md` and `git status` so the only change is the
  intended instruction file.

Read [references/audit-checklist.md](references/audit-checklist.md) for a
repository audit, a monorepo, an existing instruction file, or any uncertain
scope decision.

When maintaining this skill, read
[references/sources.md](references/sources.md) for the evidence behind these
rules. The source list is not needed during ordinary repository initialization.

## Final response

State:

- which file was created or updated;
- a compact `claim/command/path -> evidence -> verified/unverified` summary,
  distinguishing source inspection from execution, outside the generated
  `AGENTS.md`;
- which checks were not possible;
- any unresolved conflict, unverified command, or suggested nested file.

Do not claim a command or path was verified when it was only inferred.

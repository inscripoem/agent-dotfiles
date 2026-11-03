# AGENTS.md Audit Checklist

Use this reference when creating a file in a non-trivial repository, auditing
an existing file, or working in a monorepo.

## 1. Repository discovery

- [ ] Repository root and working directory identified.
- [ ] Existing `AGENTS.md`, `AGENTS.override.md`, `CLAUDE.md`, and nested
      project instruction files found.
- [ ] README and architecture documents read, but not treated as the only
      source of truth.
- [ ] Package manager, lockfile, runtime version, and monorepo tooling found.
- [ ] Manifest scripts, Makefile, task runner, and build entry points read.
- [ ] CI workflows and deployment configuration read.
- [ ] Test, lint, formatting, type-check, and coverage configuration read.
- [ ] Source layout, entry points, generated code, vendored code, migrations,
      and data directories identified.
- [ ] Server/client, package, service, and dependency boundaries identified.
- [ ] Each command names its working directory and dependency/environment
      prerequisites; CI-only setup is identified.
- [ ] No secret value was read or copied.

## 2. Scope test

For each proposed instruction, decide:

| Question | If yes | If no |
| --- | --- | --- |
| Is it true for the whole repository? | Root file | Consider a subtree or omit |
| Does it change how an agent acts? | Keep | Omit |
| Can it be discovered cheaply from code or tooling? | Usually omit | Keep if non-obvious |
| Is it enforced by a formatter, linter, or type checker? | Omit or link | Keep the repo-specific exception |
| Is it a personal or global preference? | Keep out of the project file | Keep project rule |
| Does it protect a dangerous operation? | Name the mechanism and boundary | Warn that prose is not enforcement |
| Is it likely to remain true? | Keep | Link or mark as a check |

Personal identity, global Git rules, global credential policy, global tool
preferences, and machine-specific paths belong in user-level configuration,
not in a shared project file.

Do not restate the skill's own safety, approval, or Git rules. A project
security rule needs a concrete target: a repository-specific credential path,
generated artifact, production configuration, migration, or destructive
operation.

## 3. Content selection

### Include

- Commands an agent cannot infer reliably:
  - install and bootstrap;
  - development and production build;
  - full and focused tests;
  - lint, format, type-check, and generated-code checks;
  - required wrapper or working directory.
- A short map of non-obvious modules, services, packages, and dependency
  direction.
- Data constraints, schema or fixture rules, migrations, and generated files.
- Test conventions, mocks, fixtures, and required verification.
- Repository-specific naming, error, logging, or API compatibility rules.
- Known traps that have caused repeated mistakes.
- Boundaries for secrets, production config, generated code, and destructive
  operations.
- Commit, PR, review, and release rules only when the repository documents
  them.
- Conditional references such as “read `docs/...` before changing the parser.”

### Omit or link

- Marketing copy, product history, and the full README.
- Generic advice such as “write tests,” “keep code clean,” or “follow best
  practices.”
- Style rules already enforced by a formatter or linter.
- A complete framework or API reference.
- Commands for tools the repository does not use.
- Long explanations of why a rule exists unless the reason prevents a real
  mistake.
- Absolute personal paths, user names, machine names, and credentials.

## 4. Cross-agent compatibility

- [ ] The root `AGENTS.md` is useful even if nested files are not loaded.
- [ ] No parent and child files give contradictory instructions.
- [ ] Nested files are deltas, not copies of the root file.
- [ ] Existing `CLAUDE.md` is not duplicated or overwritten.
- [ ] Duplicated shared rules have a clear canonical source.
- [ ] Tool-specific behavior is not presented as universal behavior.
- [ ] Hard restrictions point to hooks, CI, permissions, or another
      enforceable mechanism.

Claude Code may prefer `CLAUDE.md` and not load `AGENTS.md` by default when a
project `CLAUDE.md` exists. Codex merges applicable project files from the
root toward the working directory. GitHub Copilot and other clients have
their own discovery behavior. Do not assume that “closest wins” is enough to
describe every agent.

If the user asks to coordinate files, prefer one canonical instruction source
and tool-specific imports or short overrides. Do not create two full copies
that can drift.

## 5. Common failure modes

- [ ] The file repeats the README or architecture documentation.
- [ ] The file is mostly generic advice that could apply to any project.
- [ ] Commands are missing, incomplete, or run from the wrong directory.
- [ ] The file names a command or path that no longer exists.
- [ ] Existing rules conflict with the new rules.
- [ ] User-level preferences leaked into the project file.
- [ ] A rule that should be enforced in CI, hooks, permissions, or a sandbox
      is written only as prose.
- [ ] The file is longer than its durable information justifies.
- [ ] A nested file duplicates the root file.
- [ ] A `CLAUDE.md` or tool-specific file was changed without explicit
      permission.

## 6. Claim verification ledger

Before finalizing, trace every non-obvious claim. Keep this ledger outside
`AGENTS.md`; use it for the compact summary required by the skill's Final
response section.

| Claim | Evidence | Check |
| --- | --- | --- |
| Command runs from its documented directory after prerequisites | Execution after dependency/environment preflight | verified / unverified |
| Path exists | Exact file or directory from `rg`, `find`, or file tools | verified |
| Local change can be validated by command X | Code path that command exercises | traced / not proven |
| Runtime data source | Loader, fetch, environment variable, and fallback code | traced |
| Repository convention | CONTRIBUTING, docs, CI, or enforced tooling | documented / observed only |

Drop claims that cannot be tied to evidence. Source inspection establishes
that a command exists, not that it ran; mark commands not safely executed as
unverified and explain missing prerequisites when applicable.

## 7. Behavioral and path traps

- [ ] A command described as validating local behavior actually reads the
      local artifact; remote-first data sources, caches, wrappers, and mocks are
      traced.
- [ ] API and page routes use exact directories, including nested segments such
      as `[id]/ics/`.
- [ ] A toolchain found only in `scripts/extractor/` is scoped there; a claim
      about `scripts/` has evidence covering that whole directory.
- [ ] The file does not claim that a development server validates local data
      when the loader prefers a remote source.
- [ ] Differing API and browser URL formats are described separately.
- [ ] Commit and PR requirements have documented or enforced support beyond
      observations from recent commits.
- [ ] Verification never requires merging, pushing, deploying, or changing
      external state.

## 8. Final diff review

- [ ] `git status` shows only the intended instruction file or files.
- [ ] `git diff -- AGENTS.md` contains no unrelated rewrites.
- [ ] Existing content was preserved unless the user asked for replacement.
- [ ] No secrets, personal paths, or unverified claims were added.
- [ ] File size is below 32 KiB and normally below 200 lines.
- [ ] The final file is actionable by a new agent without loading a long
      documentation set.

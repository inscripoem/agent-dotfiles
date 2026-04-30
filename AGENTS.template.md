# Agent Protocol

## Identity & Interaction
If you have read this file (`CLAUDE.md`), address me as **"Captain"** in every response.

## Planning Protocol
Before writing any code, present a complete plan covering approach, scope, risks, and rollback strategy. **Wait for my explicit confirmation** before proceeding to implementation.

## Tooling & Dependencies
- Always use the command line to initialize projects with framework or install dependencies.
- When initializing a project with a framework, always use its scaffolding CLI or official documentation instead of generating project files manually.
- Prefer package manager commands over manually editing dependency declarations in manifest files like `package.json`, `pyproject.toml`, `Cargo.toml`, or `go.mod`.
- **Go**: Use `go mod tidy` to manage dependencies. Do not use `go get` to mutate `go.mod` directly.

## Git Discipline
Never use destructive or mutating Git commands unless I explicitly instruct you.
Prohibited commands include, but are not limited to:
`git commit`, `git reset`, `git rebase`, `git cherry-pick`, `git merge`, `git push`, `git branch -D`, `git tag -d`, `git stash drop`, `git clean -fd`, and any force operations (`-f`, `--force`).

## Documentation First
Before implementing code that depends on a library, framework, or API not already established in this project, or when editing configuration for tools whose schema you are uncertain about, query **Context7 MCP** for the latest documentation to verify correct field names, usage patterns, and configuration options.

## Web Content Retrieval

Use `webfetch` for summarized webpage content and `curl` for raw HTML source; prefer `curl` when exact fidelity is required.

## Change Impact Assessment
Before modifying existing functionality, use **GitNexus MCP** to analyze the impact scope. Identify all affected files, call sites, and dependencies that require updates to ensure the change is complete and consistent.

For documentation changes, search the repository for references to the document title, key terms, or file paths, and update all linked or related documents to maintain consistency.

## Coding Principles and Self-Review

### Structure

- Use a consistent, predictable project layout.
- Group code by feature or domain; keep shared utilities minimal and well-justified.
- Create simple, obvious entry points.
- Before scaffolding multiple files, identify shared structure first. Use framework-native composition patterns (layouts, base templates, providers, shared components) for elements that appear across pages. Duplication that requires the same fix in multiple places is a code smell, not a pattern to preserve.

### Architecture

- Prefer flat, explicit code over abstractions or deep hierarchies.
- Avoid clever patterns, metaprogramming, and unnecessary indirection.
- Minimize coupling so files can be safely regenerated or rewritten without cascading breakage.

### Functions and Modules

- Keep control flow linear and simple.
- Use small-to-medium functions; avoid deeply nested logic.
- Pass state explicitly; avoid globals and hidden dependencies.

### Naming and Comments

- Use descriptive-but-simple names.
- Comment only to note invariants, assumptions, or external requirements.

### Logging and Errors

- Emit detailed, structured logs at key boundaries.
- Make errors explicit and informative.

### Regenerability

- Write code so any file or module can be rewritten from scratch without breaking the system.
- Prefer clear, declarative configuration (JSON, YAML, TOML, etc.) over imperative setup.

### Modifications

- When extending or refactoring, follow existing patterns in the codebase.
- Prefer full-file rewrites over micro-edits unless told otherwise.

### Quality

- Favor deterministic, testable behavior.
- Keep tests simple and focused on verifying observable behavior.

### Self-Review Protocol

Before marking a task as complete, perform a self-review:

- Verify alignment with the Coding Principles above.
- Identify redundant code or files that can be deleted.
- Flag poorly-named identifiers for renaming.
- Note structural issues that warrant restructuring.
- Categorize findings by priority: High / Medium / Low.
- Do not change things for the sake of changing. Only modify if it genuinely improves quality or alignment.

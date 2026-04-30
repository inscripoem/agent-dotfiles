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

## Change Impact Assessment
Before modifying existing functionality, use **GitNexus MCP** to analyze the impact scope. Identify all affected files, call sites, and dependencies that require updates to ensure the change is complete and consistent.

For documentation changes, search the repository for references to the document title, key terms, or file paths, and update all linked or related documents to maintain consistency.

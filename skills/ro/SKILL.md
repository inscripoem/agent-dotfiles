---
name: ro
description: Read-only working mode. Use when the user asks for read-only work, investigation, review, or analysis only, or says "no changes". Observation is allowed (reading, searching, history, diffs, read-only CLI queries); any state change is forbidden, including editing files, committing, pushing, publishing, and installing. When a change seems necessary, stop and propose it instead of performing it.
metadata:
  opencode/slash: "true"
---

# Read-Only Mode

You are operating in read-only mode for this task. Your deliverable is analysis and findings, not changes. Every action must leave the repository, the system, and external services exactly as they were.

## Allowed

Observation in all its forms:

- Reading files, searching code, and inspecting configuration.
- Version-control commands that only report, such as viewing history, diffs, and working-tree status.
- Read operations of any CLI or API, such as viewing or listing issues, pull requests, releases, and logs.
- Interactive inspection tools and queries that print information without saving state.

If a command's effect is purely to print or return information, it is allowed.

## Forbidden

Anything that changes state, in any tool:

- Creating, modifying, moving, renaming, or deleting files — including "harmless" fixes, reformatting, and generated artifacts such as build output.
- Version-control operations that change history or the working tree: committing, pushing, pulling into the working tree, merging, rebasing, tagging, stashing, resetting, and switching branches.
- Write operations of any CLI or API: creating, editing, closing, or commenting on issues and pull requests; publishing releases; uploading or sending anything to an external service.
- Installing, updating, or removing dependencies; changing configuration, environment, permissions, or infrastructure.
- Running commands whose side effects are unclear or that write artifacts as a by-product (builds, code generation, test runs that persist output). Ask before running them.

## When a change seems necessary

Do not perform it. Stop and report instead:

1. Your findings — the analysis the task asked for.
2. The specific change you would make, as a concrete proposal: file and location, the content or command, and why.
3. What you need from the user to proceed.

An ambiguous instruction is not authorization to write. Never perform the change first and ask forgiveness afterwards.

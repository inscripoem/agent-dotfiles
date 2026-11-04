# Agent Dotfiles Meta Protocol

This repository maintains `AGENTS.template.md` as a global template for other projects.

1. When editing `AGENTS.template.md`, always synchronize the corresponding human-readable
   summary in `README.md` to ensure consistency between the template and its documentation.
2. When creating or modifying scripts in this repository, update the **Utility Tools**
   section in `README.md` (at `## 实用工具` / `## Utility Tools`) to document the script's purpose, usage,
   and location.
3. When adding or removing supported agents in `sync-agent-config.js`, update the agent table
   in both `README.md` and `README.zh.md`.
4. When adding, removing, renaming, or materially changing a skill under `skills/`, update
   `## Bundled Skills` in `README.md` and `## 内置 Skills` in `README.zh.md`.

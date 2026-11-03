# Sources

Read this file only when auditing or changing the skill's rules. Access date
for all web sources: 2026-11-03.

These sources support the defaults in this skill; they do not make every
recommendation a requirement for every repository. Tool behavior can change,
so re-check the current documentation before changing a hard rule.

## Format and discovery

- [AGENTS.md](https://agents.md/) — open Markdown format; no required headings;
  root and nested files; closest file wins as the general rule; explicit user
  instructions override files; living documentation.
- [OpenAI Codex: Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
  — global and project scopes; root-to-working-directory merge order;
  `AGENTS.override.md`; fallback filenames; 32 KiB default project-instruction
  limit; code-review rules belong near the governed code.
- [Claude Code: How Claude remembers your project](https://code.claude.com/docs/en/memory)
  — project, user, and local instruction scopes; `AGENTS.md` fallback and
  configuration; ancestor and on-demand subdirectory loading; target under
  200 lines; instructions are context, not enforcement; audit conflicting and
  outdated instructions.
- [GitHub Copilot now supports AGENTS.md](https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions/)
  — root and nested `AGENTS.md` support alongside existing Copilot and other
  agent instruction files.

## Practical writing guidance

- [GitHub Blog: Lessons from over 2,500 repositories](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)
  — put executable commands early; prefer concrete examples; state the actual
  stack; set boundaries; cover commands, testing, structure, style, Git
  workflow, and boundaries. This is a case analysis, not a controlled study.
- [Agent Surface: Context-file anti-patterns](https://agentsurface.dev/docs/context-files/anti-patterns)
  — warns against README dumping, very long files, stale commands, duplicated
  instruction files, vague boundaries, and generic template language. This is
  community guidance, not a normative specification.

## Empirical evidence

- [What Open-Source Projects Tell Their Coding Agents](https://arxiv.org/abs/2610.31715)
  — census of 22,854 popular repositories; 26.3% had agent instructions and
  59.6% of the most-starred did; analysis covers 341,852 statements, including
  the prevalence of directives without rationale and post-creation editing.
- [Evaluating AGENTS.md: Are Repository-Level Context Files Helpful?](https://www.sri.inf.ethz.ch/publications/gloaguen2026agentsmd)
  — controlled evaluation reporting no improvement in task success and more
  than 20% higher inference cost, with more exploration and testing; supports
  keeping only minimal requirements.

## Repository examples

- [Microsoft VS Code AGENTS.md](https://github.com/microsoft/vscode/blob/main/AGENTS.md)
  — a small root pointer with deeper instructions in relevant subdirectories.
- [Hugging Face Transformers AGENTS.md](https://github.com/huggingface/transformers/blob/main/AGENTS.md)
  — a root link to a canonical file, shared with other agent entry files.
- [Vercel Next.js AGENTS.md](https://github.com/vercel/next.js/blob/canary/AGENTS.md)
  — a larger monorepo root file with nested files for distinct subsystems.

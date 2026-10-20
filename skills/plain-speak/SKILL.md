---
name: plain-speak
description: |
  Make agent output plain and information-dense: detect and rewrite statements where jargon displaces a concrete action. Use for 「说人话」「别整黑话」「改具体点」「太抽象了」「术语堆砌」「讲清楚」, "too abstract", "replace jargon with the concrete action", "reads as jargon" — or when output, reports, summaries, or commit messages contain sentences like 「验证了基线一致性」/「烟测通过」/「形成闭环」 that carry no executable information. Works for generating new content and for reviewing existing text. Not for style polishing of AI-flavored prose (use humanizer-type tools), not for translation.
metadata:
  opencode/slash: "true"
---

# Plain Speak

The root cause: **jargon displaces the concrete action description that should be there.** 「验证了基线一致性，烟测和全量 dry-run 均通过」 — no action is described: consistency between which two artifacts? how many smoke checks? The jargon fills the blank, making the sentence look like process while carrying zero information.

## The test (before any word list)

Can the sentence be rewritten as **a concrete action on a concrete object** («跟昨天那份文件对比», not «确认基线一致性»)?

- Cannot → there was no information there. Cut it, or state the real action.
- Can → rewrite it. The plain version is shorter and executable.

## Three questions (whether a term stays)

1. Would a reader who doesn't know the term **guess wrong**? → Keep, add a one-line explanation + concrete object at first occurrence.
2. Does context already give it away? → Cut it, say it plainly.
3. Guessable but **requires a pause** to decode? → Cut it; explicit is cheaper.

## Two-tier word list (clues, not a blacklist)

- **Pure filler — never appear**: 赋能、抓手、拉通.
- **Watch list — not banned; apply the three questions**: 探针、快照、证据、门禁、夹具、哈希、基线、可追溯备份、烟测、全量 dry-run、验收矩阵、对齐、闭环、沉淀、复盘、留痕、心智.

Dual-meaning words have legitimate technical uses (内存对齐, 闭环反馈, 操作留痕). A hit means "stop and check", never "delete"; formal and engineering terms are not removed for matching a list.

## Three context tiers

| Context | Policy |
|---|---|
| Casual / non-software | No process boilerplate at all; give the conclusion + genuinely risky steps |
| Real software project | Terms allowed: first occurrence with a one-line explanation + concrete object (not "baseline consistent" but "matches yesterday's copy") |
| High-risk operations | Full standard terminology + the gate triple: who is blocked, on what action, what counts as passing |

## Hard rules

1. **Numbers over adjectives**: 「快了很多」→「12s 降到 3s」; "mostly done" → "9/12 done".
2. **At most one new term per paragraph.**
3. **At most two unexplained terms per 100 characters** (heuristic self-check, not a hard standard).

## Deep reference

Read `references/jargon-table.md` for the 12-term ❌/✅ mapping, the 5-step replacement order, doc-author rules, and the two-extremes reminders.

## Boundaries

- Information density only (does jargon displace actions). Not prose style (「首先其次最后」「不是…而是…」) — that is humanizer territory.
- Precise terminology always survives; the bar is "every sentence executable", not "zero jargon".

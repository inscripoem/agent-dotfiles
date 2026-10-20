# Plain Language — Research & Rationale

Why this repository ships the Plain Language template section, the `plain-speak` skill, and the `vale/` style pack. Research conducted in a prior session of this project (October 2026); fact-checked and extended 2026-10-20.

## 1. Thesis

**Jargon displaces the concrete action description that should be there.**

> ❌ "验证了基线一致性，烟测和全量 dry-run 均通过，夹具无回归。"

No action is described: consistency between which two artifacts? how many smoke checks? what fixtures? The jargon fills the blank — the sentence looks like process while carrying zero information. This is also why such vocabulary leaks into non-software projects: where no concrete action exists to write, jargon is the cheapest filler.

**The operational test**: a sentence is jargon-polluted if it cannot be rewritten as a concrete action on a concrete object. If it cannot, there was no information there to begin with.

The problem has two layers, and tooling splits the same way:

- **Wording layer** — banned-word / readability checking (Vale, textlint, skill-based rewriters)
- **Process layer** — why agents produce these rituals: verification-centric defaults, snapshot tests locking flawed baselines, unreliable LLM verifiers (see [agentpatterns.ai](https://agentpatterns.ai/workflows/verification-centric-development/))

**The counter-side**: banning everything does not make writing clearer, only vaguer. 烟测 carries more information than "跑一遍看看"; 幂等性 and 最终一致性 have precise meanings that plain paraphrases lose. The criterion is whether a reader who lacks the term would guess wrong. 最小改动 is the standing exception — it conveys real meaning with no accurate plain substitute.

## 2. Fact-check log (2026-10-20)

Verified verbatim against primary sources:

- [agentpatterns.ai / Verification-Centric Development](https://agentpatterns.ai/workflows/verification-centric-development/) — all three cited claims match, including "20 to 40% of LeetCode problems that passed LiveCodeBench's private tests still failed on the online judge" (citing Ma et al., arXiv 2507.06920)
- [alexfazio/plankton](https://github.com/alexfazio/plankton) — rule-gaming FAQ, exactly 14 protected linter configs, PreToolUse block + Stop-hook `git diff` net, three-phase pipeline
- [alphalab.site minimal-config article](https://www.alphalab.site/ai-coding-agent-minimal-config) — "零外掛 baseline + 同一組 eval 證明值得保留"
- [AI Engineer 2026 Q1 report](https://www.ai.engineer/AIE_2026_Q1_report.pdf) — Zechner quote present ("Agents will happily keep shitting into your codebase", from his talk *Building pi in a World of Slop*)
- Plain Writing Act 2010 / OMB M-11-15 (April 2011); the 15–20-words guidance lives on plainlanguage.gov's history pages
- [pi.dev](https://pi.dev) — four tools (read/write/edit/bash); the "<1k tokens" figure covers system prompt **and** tool definitions combined
- [vale-cli/agent-tools](https://github.com/vale-cli/agent-tools) — official Agent Skills + Claude Code plugin; edit hook lints the moment the assistant writes; returns **error-level alerts only** by default (`VALE_HOOK_LEVEL` widens); MCP server is paid

Corrections (original claims → verified):

- "load-bearing ×123" → Abraham's study ([461,121 PR descriptions](https://louisabraham.github.io/load-bearing/)) reports a **39× within-cluster vs out-of-cluster ratio**; "123" is the em-dash frequency per 10k words. The ×123 figure exists only in @vernsg/anti-slop's own README (a garbled transcription)
- `anti-ai-flavor` → **not on PyPI** (registry 404); GitHub repo real (25 patterns P1–P25, `rewrite` CLI)
- `textlint-rule-preset-zh-technical-writing` → stale since 2021-06, ~279 weekly downloads (not single digits)
- `qu-ai-wei` → "51 rules" is deprecated numbering, now 8 pattern families; 5 supported environments (not 8); the named register-tier table does not exist
- `no-ai-slop-zh` → no canonical repo (multiple Chinese adaptations of Peter Yang's no-ai-slop); ~17–20 patterns (not 30)
- Symon Baikov trust-boundary tiering → person real, positions match scattered posts; no written framework source exists (treat as synthesis, not citation)
- proselint → Vale ports its rules as built-in styles; influence relationship, not shared code lineage

## 3. First-hand tooling findings

- **Vale cannot match pure-Chinese tokens by default.** The default `WordTemplate` wraps every token with ASCII word boundaries (`\b`), which never occur inside continuous CJK text — rules match **nothing, silently** (reproduced on vale 3.17.1; documented at [docs.vale.sh/keys/wordtemplate](https://docs.vale.sh/keys/wordtemplate)). Fix: `WordTemplate = (?m)(?:%s)` in `.vale.ini`. Global tradeoff: Latin tokens start matching inside longer words — acceptable only for Chinese-primary repos.
- **`existence` rules have no `unless` exception key** (E201 in 3.17.1). Lookbehind is available (regexp2) but unworkable for Chinese without word segmentation — a string matcher cannot judge whether usage is legitimate. Hence the **two-tier design**: error tier only for words with no legitimate usage anywhere (赋能、抓手、拉通); warning tier with a judgment-guiding message for everything else; the model, not the linter, decides context.
- English-side plain-language Vale packs exist ([vale-cli/Microsoft](https://github.com/vale-cli/Microsoft), [vale-cli/Google](https://github.com/vale-cli/Google), [testthedocs/PlainLanguage](https://github.com/testthedocs/PlainLanguage)) for stacking on English docs.

## 4. Community scan (October 2026)

| Project | Form | Notes |
|---|---|---|
| [blader/humanizer](https://github.com/blader/humanizer) (57.7k, MIT) | skill | Prose rewriting, based on Wikipedia's "Signs of AI writing"; PR #180 narrowed its description to avoid loading every session |
| [op7418/Humanizer-zh](https://github.com/op7418/Humanizer-zh) (19.8k, MIT) | skill | Chinese adaptation; conditional word list — 「不因命中词表而删除」, preserves 「闭环反馈」; corroborates our two-tier stance |
| [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop) (12.5k) | skill | 20-ish patterns; README suggests copying core rules into custom instructions |
| [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop) (18.2k) | skill + references | 68-line core, banned phrases in `references/phrases.md` loaded on demand |
| [LifelongLazyLearner/qu-ai-wei](https://github.com/LifelongLazyLearner/qu-ai-wei) (667) | skill + 6 references | Per-pattern evidence levels; bilingual natural-language trigger description (best-in-class) |
| [mat10tng/easy-read](https://github.com/mat10tng/easy-read) | YAML → build → SKILL.md + Vale | Single rule source, dual channel (soft constraint + hard check); hard 6KB cap on resident text |

Official division of labor (Claude Code docs): output style = voice of every reply; CLAUDE.md = always-loaded conventions; skill = loads only when the task matches; hook = things that must happen without exception. Cursor: User Rules for communication style; Windsurf: Always On rules. Codex/Gemini CLI/OpenCode have no output-style mechanism — **the global instructions file is the only cross-vendor always-on channel**, which is what `AGENTS.template.md` provides. Length anchors: CLAUDE.md ≤ 200 lines (Anthropic), Codex 32 KiB, Windsurf 6k/12k chars, Cursor 500 lines; see context-rot research ([Chroma](https://research.trychroma.com/context-rot)) for why resident text must stay small.

**Positioning**: every existing project is an on-demand skill in the style layer. No project ships a **resident-layer + on-demand-layer pair**; and the information-density lane (verification-ritual vocabulary displacing actions) is untouched by style tools — our 12 software-engineering terms have **zero hits across the four community catalogs**. Both are whitespace.

## 5. Word-list provenance

Full per-word provenance table: `skills/plain-speak/references/jargon-table.md` §5. Summary: the 12 software-engineering terms come from this project's own prior research session (observation of agent output — sample-based, unvalidated by corpus); the internet-corporate filler words are common knowledge without an authoritative list; the two-tier split is this session's editorial design, corroborated by Humanizer-zh's conditional-list stance. A Chinese-agent-output frequency study (the analogue of Abraham's English-side work) does not exist and would be the empirical backbone if this becomes a public framework.

## 6. Sources

Official documentation: [Vale WordTemplate](https://docs.vale.sh/keys/wordtemplate) · [Vale existence](https://docs.vale.sh/checks/existence) · [Claude Code output styles](https://code.claude.com/docs/en/output-styles) · [Claude Code skills](https://code.claude.com/docs/en/skills) · [Claude Code memory](https://code.claude.com/docs/en/memory) · [Cursor rules](https://cursor.com/docs/context/rules) · [AGENTS.md](https://agents.md/) · [Windsurf memories/rules](https://docs.windsurf.com/windsurf/cascade/memories) · [plainlanguage.gov](https://www.plainlanguage.gov/about/history/) · [OMB M-11-15](https://obamawhitehouse.archives.gov/sites/default/files/omb/memoranda/2011/m11-15.pdf)

Projects: [vale-cli/agent-tools](https://github.com/vale-cli/agent-tools) · [alexfazio/plankton](https://github.com/alexfazio/plankton) · [errata-ai organization](https://github.com/errata-ai) · [amperser/proselint](https://github.com/amperser/proselint)

Research: [louisabraham/load-bearing](https://louisabraham.github.io/load-bearing/) · [Chroma — Context Rot](https://research.trychroma.com/context-rot) · [Anthropic — Claude Code best practices](https://www.anthropic.com/engineering/claude-code-best-practices) · [Anthropic — Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) · [Ma et al., Rethinking Verification for LLM Code Generation (arXiv 2507.06920)](https://arxiv.org/abs/2507.06920) · [agentpatterns.ai](https://agentpatterns.ai/workflows/verification-centric-development/) · [AI Engineer 2026 Q1 report](https://www.ai.engineer/AIE_2026_Q1_report.pdf)

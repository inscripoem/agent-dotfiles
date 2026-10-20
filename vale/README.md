# vale/ — File-Layer Hard Enforcement (optional, per-repo)

The conversation layer (template resident section) and the writing layer (plain-speak skill) are soft constraints; this directory is deterministic string matching. A word on the list is flagged regardless of model cooperation, and the rules do not drift over time.

## Setup

1. Install Vale (static binary, zero runtime dependencies):
   - macOS / Linux Homebrew: `brew install vale`
   - Windows: `winget install errata-ai.Vale`
   - Nix: `nix profile install nixpkgs#vale`
2. Copy this directory's `.vale.ini` and `styles/` into the target repository root.
3. Run `vale --output=line <file>`, or wire it into CI.

## Rule tiers

| File | Level | Content |
|---|---|---|
| `styles/Project/Filler.yml` | error | 赋能、抓手、拉通 — pure filler, no legitimate usage in any context |
| `styles/Project/Jargon.yml` | warning | Software-engineering terms and dual-meaning words — the message asks "precise usage or filler?", it does not ban |

Non-software repositories can flip `Jargon.yml`'s `level` to `error` for the strict tier.

## Agent write-time interception (optional)

Vale's official [agent-tools](https://github.com/vale-cli/agent-tools) provides a Claude Code edit hook that lints the moment the agent writes a file:

```
/plugin marketplace add vale-cli/agent-tools
/plugin install vale@agent-tools
```

The hook returns error-level alerts only by default; set `VALE_HOOK_LEVEL=warning` to surface the warning tier.

## Required Chinese configuration

`WordTemplate = (?m)(?:%s)` in `.vale.ini` must not be removed: Vale's default template wraps tokens with ASCII word boundaries (`\b`), which never occur inside continuous Chinese text — pure-Chinese tokens silently match nothing ([docs.vale.sh/keys/wordtemplate](https://docs.vale.sh/keys/wordtemplate)). The tradeoff is global: Latin tokens start matching inside longer words, so this setup suits Chinese-primary repositories only. For English documents, drop this pack and use vale-cli's official Microsoft or Google styles instead.

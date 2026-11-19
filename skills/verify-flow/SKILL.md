---
name: verify-flow
description: >-
  Lightweight, non-mandatory navigation router for the modular local-verify-kit skills. Use only
  when the user asks for an overview of the verification modules or asks which independent step
  to run next. Prioritizes reusing mature existing skills (such as superpowers or browser tools)
  and never forces a rigid end-to-end pipeline.
---

# verify-flow

A thin routing guide — never a mandatory state machine. Every verification skill in this kit is independent; pick only the single module needed right now.

## Reuse Mature Ecosystem Skills First

When the user's need is already well-served by mature installed skills or host features, route there directly instead of duplicating them:
- **Planning, specs, and git worktrees**: prefer existing skills such as `superpowers` (`brainstorming`, `writing-plans`, `using-git-worktrees`) or your host's native planning mode.
- **Strict TDD & structured debugging**: prefer `superpowers` (`test-driven-development`, `systematic-debugging`).
- **Live browser driving**: prefer `chrome-devtools`, Playwright, `browser-use`, or your host's browser tool.
- **Handling review feedback & branch completion**: prefer `superpowers` (`receiving-code-review`, `finishing-a-development-branch`).

## Independent Modules in This Kit (Invoke Any One Standalone)

| Skill | Purpose | Typical Cross-Agent Delegation |
| :--- | :--- | :--- |
| `verify-init` | Inspect repo (new or mid-flight), scaffold & stress-test project `verify/SKILL.md` | Current agent (default) |
| `verify-run` | Fast local checks + real E2E smoke test + 3-round fuse + `.verify/last-run.json` | Often delegated to **`codex`** or clean subagent |
| `diff-gate` | Check only diff-matched reliability checklist items + soft pre-commit readiness/stamps | Current agent or read-only `codex` / `claude` |
| `isolated-review` | Base-branch `REVIEW.md` isolation + `HEAD` SHA binding + progressive graded review | **Strongly recommend a different agent** (`codex` ↔ `claude` / host) |
| `verify-retro` | Scan git reverts, hotfixes, `.skip`/`sleep` tests, rule bloat + falsified rule updates | Local scanner + independent falsifier (`codex` / `claude`) |

## Routing Steps

1. Recommend only the 1–2 standalone skills relevant to what the user is doing right now (or route directly to an existing mature skill).
2. Confirm whether the user wants the current agent or another agent (`codex`, `claude`, or an isolated subagent) to run that module, then hand off directly to that skill.

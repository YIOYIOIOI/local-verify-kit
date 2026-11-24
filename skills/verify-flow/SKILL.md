---
name: verify-flow
description: >-
  Lightweight, non-mandatory navigation router for the modular local-verify-kit skills. Use only
  when explicitly asked for an overview of verification modules, to toggle a repo's verification
  profile (off, lite, full), or to decide which independent step to run next. Respects
  per-project profiles, prioritizes reusing mature existing skills (such as superpowers or
  browser tools), and never forces a rigid end-to-end pipeline.
---

# verify-flow

A thin routing guide and profile switcher — never a mandatory state machine. Install this kit globally once, leave simple repos silent by default, and opt in per project or per task.

## Project Profiles (Install Globally, Enable Per Repo)

Check `<repo>/.verify/config.json` to see the current repository's profile:

| Profile | Default Active Modules | Best For |
| :--- | :--- | :--- |
| **`off`** (default when no `.verify/config.json`) | None automatically (explicit one-off invocation always works) | Simple scripts, prototypes, small utilities |
| **`lite`** (`{ "profile": "lite" }`) | `verify-run` only | Small/medium personal projects — fast checks & smoke runs, zero heavy review ceremony |
| **`full`** (`{ "profile": "full" }`) | `verify-run`, `diff-gate`, `isolated-review`, `verify-retro` | Core production or multi-contributor repositories |
| Custom **`modules`** array | Any exact subset (e.g., `["verify-run", "isolated-review"]`) | Custom per-repo combinations |

## Reuse Mature Ecosystem Skills First

When the user's need is already well-served by mature installed skills or host features, route there directly instead of duplicating them:
- **Planning, specs, and git worktrees**: prefer existing skills such as `superpowers` (`brainstorming`, `writing-plans`, `using-git-worktrees`) or your host's native planning mode.
- **Strict TDD & structured debugging**: prefer `superpowers` (`test-driven-development`, `systematic-debugging`).
- **Live browser driving**: prefer `chrome-devtools`, Playwright, `browser-use`, or your host's browser tool.
- **Handling review feedback & branch completion**: prefer `superpowers` (`receiving-code-review`, `finishing-a-development-branch`).

## Independent Modules in This Kit (Invoke Any One Standalone)

| Skill | Purpose | Typical Cross-Agent Delegation |
| :--- | :--- | :--- |
| `verify-init` | Choose `lite`/`full` profile, inspect repo, scaffold & stress-test project `verify/SKILL.md` | Current agent (default) |
| `verify-run` | Fast local checks + real E2E smoke test + 3-round fuse + `.verify/last-run.json` | Often delegated to **`codex`** or clean subagent |
| `diff-gate` | Check only diff-matched reliability checklist items + soft pre-commit readiness/stamps | Current agent or read-only `codex` / `claude` |
| `isolated-review` | Base-branch `REVIEW.md` isolation + `HEAD` SHA binding + progressive graded review | **Strongly recommend a different agent** (`codex` ↔ `claude` / host) |
| `verify-retro` | Scan git reverts, hotfixes, `.skip`/`sleep` tests, rule bloat + falsified rule updates | Local scanner + independent falsifier (`codex` / `claude`) |

## Routing Steps

1. Check `<repo>/.verify/config.json` (if any) and respect the repo's profile (`off` / `lite` / `full`). If the user wants to switch profiles, update `.verify/config.json` (or remove it to return to `off`).
2. Recommend only the 1–2 standalone skills relevant to what the user is doing right now (or route directly to an existing mature skill).
3. Confirm whether the user wants the current agent or another agent (`codex`, `claude`, or an isolated subagent) to run that module, then hand off directly to that skill.

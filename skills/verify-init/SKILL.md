---
name: verify-init
description: >-
  Use only when explicitly asked to bootstrap or upgrade a repository's local verification setup
  (safe for both new and mid-flight projects). Lets the user choose a project profile (lite or
  full), inspects the codebase using the Surface/Run/Drive/Observe model to scaffold and live
  stress-test a project-specific verify SKILL.md, and optionally initializes .verify/config.json,
  REVIEW.md, and a diff-triggered reliability checklist. Works completely standalone.
---

# verify-init

Inspect the current repository and scaffold a fast, reliable, project-specific `verify` skill (inspired by `pstack`'s `create-verification-skill`). Designed to be installed globally once and opted into per repository without disturbing simple projects.

## Step 0: Choose Project Profile & Execution Routing

1. **Choose Project Profile first** (ask concisely if the user didn't specify):
   - **`lite`** (Recommended for small/medium projects & personal tools): scaffolds ONLY `.agents/skills/verify/SKILL.md` + a minimal `.verify/config.json` (`{ "profile": "lite" }`). Skips `REVIEW.md`, diff checklists, and heavy PR review flows.
   - **`full`** (Recommended for core production/team repositories): scaffolds `verify/SKILL.md`, `.verify/config.json` (`{ "profile": "full", ... }`), `REVIEW.md`, and a starter `.verify/reliability-checklist.json`.
   - *(Note: repositories without `.verify/config.json` remain implicitly `off` — zero noise unless explicitly invoked.)*
2. **Execution Routing (Default: `self` / `subagent`; External CLIs Strictly Opt-In)**:
   Check `<repo>/.verify/config.json` under `delegation["verify-init"]` (**default: `"self"`**).
   1. **Current agent (`self`, Default)** — best for initial repo discovery.
   2. **Clean isolated subagent (`subagent`)** — fresh context window with zero external CLI quota consumption.
   3. **External CLI (`codex` or `claude`) — Strict Explicit Opt-In Only**: use only when the user explicitly names that CLI in the current request, exclusively via `node "../../scripts/delegate.mjs" --agent <codex|claude> --mode workspace-write --cwd "<repo>" --prompt-file <promptFile> --out <outFile>` (never silently fall back between external CLIs).

## Step 1: Reuse First & Mid-Project Detection

Never duplicate mature tools already present in the repository or user environment:
- **Existing verify skill found** (`.agents/skills/verify/SKILL.md` or `.claude/skills/verify/SKILL.md`): upgrade incrementally rather than overwriting.
- **Mid-flight repository choosing `full` profile**: suggest running `verify-retro` first (or inspect recent `git log` reverts/hotfixes) so the first `REVIEW.md` and checklist reflect real past incidents instead of generic guesses.
- **Mature ecosystem tools**: keep existing TDD, planning, worktree, and debugging skills (e.g., `superpowers`) and browser tools (e.g., `chrome-devtools`, Playwright, `browser-use`). Focus strictly on how to boot and smoke-test *this* application.

## Step 2: Inspect the Repository (Surface · Run · Drive · Observe)

Read repo manifests and docs (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Makefile`, `docker-compose*`, `README.md`, CI workflows) and capture:
1. **Surface**: What real users or callers touch (Web UI, CLI, HTTP/RPC API, mobile simulator, library).
2. **Run**: Fast cheap checks (lint, typecheck, build, unit/property tests), real local startup command, port, seed/env setup, and clean shutdown.
3. **Drive**: How to exercise 2–5 critical end-to-end user flows (browser/CDP/Playwright, real CLI invocations, real HTTP calls). Flag parsing/state/idempotent modules as candidates for property-based tests (`fast-check`, `Hypothesis`, `proptest`).
4. **Observe**: Concrete pass/fail evidence (screenshots, zero console errors, HTTP status/body assertions, persisted files, exit codes).

## Step 3: Scaffold Project-Local Assets (Scoped to Chosen Profile)

1. **Always created (`lite` & `full`)**:
   - `.agents/skills/verify/SKILL.md` (and optionally mirror/link to `.claude/skills/verify/SKILL.md` if the repo uses `.claude/`), covering cheap checks first, real startup + 2–5 core user flows + cleanup, fresh evidence only, no `.skip`/hardcoded `sleep`/blind retries, and a 3-round failure fuse.
   - `.verify/config.json` (**never write `"codex"`, `"claude"`, or `"allowExternalCli"` unless the user explicitly requested that external CLI**):
     - For **`lite`**: `{ "profile": "lite", "delegation": { "verify-run": "subagent" } }`
     - For **`full`**: `{ "profile": "full", "baseBranch": "main", "delegation": { "verify-init": "self", "verify-run": "subagent", "diff-gate": "subagent", "isolated-review": "subagent", "verify-retro": "subagent" }, "commitCheck": { "mode": "observe", ... } }`
2. **Created only for `full` profile** (if missing):
   - `REVIEW.md` (5–10 high-signal repo invariants; remind the user to merge `REVIEW.md` onto the default branch `main` so `isolated-review` can enforce tamper-proof base-branch isolation)
   - `.verify/reliability-checklist.json` (2–3 concrete diff-triggered items)

## Step 4: Live Stress-Test Before Finishing (Mandatory)

Immediately run the newly created `verify/SKILL.md` end-to-end once against the live repository:
- Fix any port collisions, missing env vars, timeouts, or leftover background processes until the smoke harness runs fast, cleanly, and reproducibly.
- Report the chosen profile, files created/updated, actual runtime duration, observed output, and any business flows the user should review or add.

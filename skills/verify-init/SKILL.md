---
name: verify-init
description: >-
  Bootstrap or incrementally upgrade a repository's local verification setup (safe for both new
  and mid-flight projects). Inspects the codebase using the Surface/Run/Drive/Observe model to
  scaffold and live stress-test a project-specific verify SKILL.md, plus optional REVIEW.md,
  .verify/config.json, and diff-triggered reliability checklist. Works completely standalone.
---

# verify-init

Inspect the current repository and scaffold a fast, reliable, project-specific `verify` skill (inspired by `pstack`'s `create-verification-skill`). Works cleanly on both greenfield projects and mid-flight existing repositories without overwriting existing workflows.

## Step 0: Execution Routing (Cross-Agent Delegation Prompt)

Before starting, check `<repo>/.verify/config.json` under `delegation["verify-init"]` (treat missing as `"ask"`).
- If the user already named an executor in this turn, follow their choice.
- Otherwise, if configured as `"ask"`, ask the user concisely (using your host's prompt/choice UI or a brief numbered list in chat) who should run this step:
  1. **Current agent** (Recommended for initial repo discovery)
  2. **Clean isolated subagent** (fresh context window)
  3. **Local `codex` CLI** (`codex exec -C "<repo>" -s workspace-write -` or `node "../../scripts/delegate.mjs" --agent codex --mode workspace-write ...`)
  4. **Local `claude` CLI** (`claude -p` or `node "../../scripts/delegate.mjs" --agent claude --mode workspace-write ...`)

## Step 1: Reuse First & Mid-Project Detection

Never duplicate mature tools already present in the repository or user environment:
- **Existing verify skill found** (`.agents/skills/verify/SKILL.md` or `.claude/skills/verify/SKILL.md`): upgrade incrementally rather than overwriting.
- **Mid-flight repository with git history**: suggest running `verify-retro` first (or inspect recent `git log` reverts/hotfixes) so the first `REVIEW.md` and checklist reflect real past incidents instead of generic guesses.
- **Mature ecosystem tools**: keep existing TDD, planning, worktree, and debugging skills (e.g., `superpowers`) and browser tools (e.g., `chrome-devtools`, Playwright, `browser-use`). Focus strictly on how to boot and smoke-test *this* application.

## Step 2: Inspect the Repository (Surface · Run · Drive · Observe)

Read repo manifests and docs (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Makefile`, `docker-compose*`, `README.md`, CI workflows) and capture:
1. **Surface**: What real users or callers touch (Web UI, CLI, HTTP/RPC API, mobile simulator, library).
2. **Run**: Fast cheap checks (lint, typecheck, build, unit/property tests), real local startup command, port, seed/env setup, and clean shutdown.
3. **Drive**: How to exercise 2–5 critical end-to-end user flows (browser/CDP/Playwright, real CLI invocations, real HTTP calls). Flag parsing/state/idempotent modules as candidates for property-based tests (`fast-check`, `Hypothesis`, `proptest`).
4. **Observe**: Concrete pass/fail evidence (screenshots, zero console errors, HTTP status/body assertions, persisted files, exit codes).

## Step 3: Scaffold Project-Local Assets (Opt-In, Non-Destructive)

1. **Core artifact**: Create `.agents/skills/verify/SKILL.md` (and optionally mirror/link to `.claude/skills/verify/SKILL.md` if the repo uses `.claude/`). Include:
   - Cheap checks first (lint / typecheck / build / fast tests)
   - Concrete real startup + end-to-end smoke flow + cleanup
   - Non-negotiable rules: fresh evidence required, no `.skip`/hardcoded `sleep`/blind retries, stop and escalate to a human after 3 consecutive failed fix rounds
2. **Optional starter files** (ask before creating if missing):
   - `.verify/config.json` (default `commitCheck.mode: "observe"`, all `delegation.*: "ask"`)
   - `REVIEW.md` (5–10 high-signal repo invariants; remind the user to merge `REVIEW.md` onto the default branch `main` so `isolated-review` can enforce tamper-proof base-branch isolation)
   - `.verify/reliability-checklist.json` (2–3 concrete diff-triggered items)

## Step 4: Live Stress-Test Before Finishing (Mandatory)

Immediately run the newly created `verify/SKILL.md` end-to-end once against the live repository:
- Fix any port collisions, missing env vars, timeouts, or leftover background processes until the smoke harness runs fast, cleanly, and reproducibly.
- Report the files created/updated, actual runtime duration, observed output, and any business flows the user should review or add.

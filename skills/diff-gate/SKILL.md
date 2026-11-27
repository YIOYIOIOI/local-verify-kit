---
name: diff-gate
description: >-
  Run diff-triggered reliability checklist checks before committing (evaluating only matched
  items) and audit local commit verification readiness/stamps via skill reminders instead of hard
  hooks. Activate only when explicitly requested by the user OR when .verify/config.json enables
  profile "full" (or includes "diff-gate" in modules); stay silent on simple or "lite" repos.
---

# diff-gate

Evaluate only the reliability checklist rules triggered by the active `git diff`, and run a lightweight pre-commit verification readiness reminder without injecting harness-specific hooks.

## Step 0: Profile Opt-In Gate & Executor Selection (Default: `subagent`)

1. **HARD STOP — Opt-In Profile Check** (run before any diff inspection or commit check):
   - Read `<repo>/.verify/config.json` if present. If `targets` is defined (e.g., `private` vs `public` remote, or `dev` vs `release`), resolve `profile`/`modules` from the matching `targets.<name>` for the current push/PR target (defaulting to top-level `profile`).
   - **If `.verify/config.json` is missing** (and the user did not explicitly tell you to run `diff-gate` directly without asking): **STOP immediately — do not run checks yet.** Ask the user in one brief question whether this repo should use `lite` (skip `diff-gate`), `full`, a one-off `diff-gate` without writing `.verify/`, or `off` (default executor is `subagent`). Wait for their reply.
   - **If `.verify/config.json` exists** with `"profile": "off"` or `"lite"` (without `"diff-gate"` in `"modules"`): skip silently unless the user explicitly invoked `diff-gate`.
   - Never auto-chain into `isolated-review` or other modules after finishing unless asked.
2. **Execution Routing — Default Mode is `subagent` (External CLIs Strictly Opt-In)**:
   If the user is only toggling `profile` or `commitCheck.mode` (`off` / `observe` / `enforce`), handle directly. Before running a diff checklist audit, check `delegation["diff-gate"]` in `<repo>/.verify/config.json` (**default: `"subagent"`**).
   1. **Clean isolated subagent (Default, read-only)** — fresh read-only context with zero external CLI quota consumption.
   2. **Current agent (`self`)** — direct run or fallback when the host does not support subagents.
   3. **External CLI (`codex` or `claude`) — Strict Explicit Opt-In Only**:
      - **NEVER** select an external CLI automatically, **NEVER** write `"codex"`, `"claude"`, or `"allowExternalCli"` into `.verify/config.json` unasked, and **NEVER** silently fall back from one external CLI to another on failure (stop or fall back to `subagent`).
      - Invoke exclusively through the gated helper `scripts/delegate.mjs` (fail-closed by default unless explicitly opted in):
        - `codex`: `node "../../scripts/delegate.mjs" --agent codex --mode read-only --cwd "<repo>" --prompt-file <promptFile> --out <outFile>`
        - `claude`: `node "../../scripts/delegate.mjs" --agent claude --mode read-only --cwd "<repo>" --prompt-file <promptFile> --out <outFile>`

## Step 1: Load Diff & Base Checklist (Mid-Project Safe)

1. Collect the diff to check: use `git diff --cached` when staged changes exist; otherwise `git diff HEAD` or `git diff <baseBranch>...HEAD`.
2. Load checklist rules safely:
   - Prefer reading `.verify/reliability-checklist.json` from the default branch via `git show <baseBranch>:.verify/reliability-checklist.json`.
   - Fall back to working tree `.verify/reliability-checklist.json` if not yet merged into the default branch.
   - If neither exists, scan for universal high-risk diff surfaces (persisted data compatibility, auth boundaries, retry/migration idempotency, credential redaction in logs) and offer to save a starter checklist only if the user wants one.

## Step 2: Check Matched Items Only

Compare changed file paths and code edits against each item's `trigger` and `fileGlobs`.
- Evaluate only matched items (usually a small subset) instead of auditing unrelated rules.
- Return `PASS`, `RISK`, or `N/A` per matched item with `file:line` references.
- Whenever marking `RISK` for a human reviewer, state **clearly why** it was flagged so the reviewer does not have to deduce it from the raw diff.

## Step 3: Pre-Commit Readiness Reminder & Stamps (No Hard Hook)

Instead of hard-implanting a harness hook, remind before `git commit`:
1. Optionally run the standalone readiness checker:
   ```bash
   node "./scripts/commit-check.mjs" --cwd "<repo>" [--target <name>] --message "<commit message>"
   ```
   - Missing config or `profile: "off"`: returns `profile_off` and exits 0 silently.
   - `profile: "lite"`: defaults to checking only `verify-run`.
   - `observe` (default): logs would-be blocks to `.verify/commit-check.log.jsonl` without blocking.
   - `enforce`: flags missing fresh evidence unless `[skip-verify: <reason>]` is present or the 2-block session escape hatch is reached.
2. Remind the agent/user to append a verification trailer to the commit message (`Verified-by: verify-run(subagent), diff-gate(subagent)` or `Verified-by: none (<reason>)`).
3. Only if `<repo>/.verify/` already exists, save `.verify/last-diff-gate.json` (`timestamp`, `headSha`, `executor`, `status`, `matchedIds`, `risks`).
4. Only if a team explicitly requests OS/Git-level hard gating, explain how to call `commit-check.mjs` from standard `.git/hooks/pre-commit`.

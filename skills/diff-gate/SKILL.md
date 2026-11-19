---
name: diff-gate
description: >-
  Run diff-triggered reliability checklist checks before committing (evaluating only matched
  items) and audit local commit verification readiness and stamps via skill-level reminders
  instead of hard-implanted hooks. Prompts whether to delegate inspection to codex, claude,
  or a clean subagent. Works completely standalone.
---

# diff-gate

Evaluate only the reliability checklist rules triggered by the active `git diff`, and run a lightweight pre-commit verification readiness reminder without injecting harness-specific hooks.

## Step 0: Execution Routing (Cross-Agent Delegation Prompt)

1. Check `<repo>/.verify/config.json` under `delegation["diff-gate"]` (missing defaults to `"ask"`).
2. If the user only wants to change `commitCheck.mode` (`off` / `observe` / `enforce`) or inspect readiness, run directly.
3. Before running the diff checklist audit, if no executor was named and config is `"ask"`, ask concisely who should inspect the diff:
   1. **Current agent**
   2. **Clean isolated subagent** (read-only)
   3. **Local `codex` CLI** (read-only sandbox):
      - Helper: `node "../../scripts/delegate.mjs" --agent codex --mode read-only --cwd "<repo>" --prompt-file <promptFile> --out ".verify/delegations/diff-gate-codex.md"`
      - Direct fallback: `codex exec -C "<repo>" -s read-only - < <promptFile>`
   4. **Local `claude` CLI** (read-only):
      - Helper: `node "../../scripts/delegate.mjs" --agent claude --mode read-only --cwd "<repo>" --prompt-file <promptFile> --out ".verify/delegations/diff-gate-claude.md"`

## Step 1: Load Diff & Base Checklist (Mid-Project Safe)

1. Collect the diff to check: use `git diff --cached` when staged changes exist; otherwise `git diff HEAD` or `git diff <baseBranch>...HEAD`.
2. Load checklist rules safely:
   - Prefer reading `.verify/reliability-checklist.json` from the default branch via `git show <baseBranch>:.verify/reliability-checklist.json`.
   - Fall back to working tree `.verify/reliability-checklist.json` if not yet merged into the default branch.
   - If neither exists, scan for universal high-risk diff surfaces (persisted data compatibility, auth boundaries, retry/migration idempotency, credential redaction in logs) and offer to create a starter checklist.

## Step 2: Check Matched Items Only

Compare changed file paths and code edits against each item's `trigger` and `fileGlobs`.
- Evaluate only matched items (usually a small subset) instead of auditing unrelated rules.
- Return `PASS`, `RISK`, or `N/A` per matched item with `file:line` references.
- Whenever marking `RISK` for a human reviewer, state **clearly why** it was flagged so the reviewer does not have to deduce it from the raw diff.

## Step 3: Pre-Commit Readiness Reminder & Stamps (No Hard Hook)

Instead of hard-implanting a harness hook, remind before `git commit`:
1. Optionally run the standalone readiness checker:
   ```bash
   node "./scripts/commit-check.mjs" --cwd "<repo>" --message "<commit message>"
   ```
   - `observe` (default): logs would-be blocks to `.verify/commit-check.log.jsonl` without blocking.
   - `enforce`: flags missing fresh evidence unless `[skip-verify: <reason>]` is present or the 2-block session escape hatch is reached.
   - `off`: bypasses completely.
2. Remind the agent/user to append a verification trailer to the commit message:
   - e.g., `Verified-by: verify-run(codex), diff-gate(self)`
   - or `Verified-by: none (<reason>)` for transparent auditability.
3. If `<repo>/.verify/` exists, save `.verify/last-diff-gate.json` (`timestamp`, `headSha`, `executor`, `status`, `matchedIds`, `risks`).
4. Only if a team explicitly requests OS/Git-level hard gating, explain how to call `commit-check.mjs` from standard `.git/hooks/pre-commit`.

---
name: verify-retro
description: >-
  Run local post-merge retrospectives and verification health audits using git history: scans
  reverts, hotfix commits, skipped or sleep-padded tests, commit-check logs, and rule file bloat;
  distills recurring misses into candidate rules, challenges them with an independent falsifier
  agent before human approval, and prunes stale rules. Activate only when explicitly requested by
  the user; never auto-trigger on simple or "lite" repos.
---

# verify-retro

Audit how well your local verification layer is catching real bugs using local git history — zero external eval platform or API key required. Works standalone and is also an ideal first step when adopting this kit on an existing repository.

## Step 0: Profile Opt-In Gate & Falsifier Selection (Default: `subagent`)

1. **HARD STOP — Explicit Opt-In Only**: never auto-run retrospectives on everyday edits or simple/`lite` repos. If `.verify/config.json` is missing and the user did not explicitly instruct you to run `verify-retro` immediately, **STOP and ask** before running `retro-scan.mjs` or proposing rule edits (falsification defaults to a clean isolated `subagent`). Never auto-chain into other verification modules unless asked.
2. Run the deterministic local scanner first with the current agent to collect objective git/test metrics.
3. Before **challenging candidate rules (falsification)** or proposing rule edits, check `<repo>/.verify/config.json` under `delegation["verify-retro"]` (**default: `"subagent"`**):
   1. **Clean isolated subagent (Default — independent skeptic)** — fresh read-only context in the current host with zero external CLI quota consumption.
   2. **Current agent (`self`)** — fallback only when the host does not support subagents.
   3. **External CLI (`codex` or `claude`) — Strict Explicit Opt-In Only**:
      - **NEVER** select an external CLI automatically, **NEVER** write `"codex"`, `"claude"`, or `"allowExternalCli"` into `.verify/config.json` unasked, and **NEVER** silently fall back from one external CLI to another on failure (stop or fall back to `subagent`).
      - Invoke exclusively through the gated helper `scripts/delegate.mjs` (fail-closed by default unless explicitly opted in):
        - `codex`: `node "../../scripts/delegate.mjs" --agent codex --mode read-only --cwd "<repo>" --prompt-file <promptFile> --out <outFile>`
        - `claude`: `node "../../scripts/delegate.mjs" --agent claude --mode read-only --cwd "<repo>" --prompt-file <promptFile> --out <outFile>`

## Step 1: Collect Objective Local Signals

Run the bundled scanner (adjust `--since` as needed):
```bash
node "./scripts/retro-scan.mjs" --cwd "<repo>" --since "30 days ago"
```
Inspect four signals:
1. **Missed bugs**: `reverts` and `recentFixes` — run `git show <sha>` on relevant commits to understand why existing checks missed them.
2. **Flaky test shortcuts**: `flakyScan.findings` — locate `.skip`, `xit`, `@pytest.mark.skip`, `time.sleep`, and long hardcoded `setTimeout` workarounds inside test files.
3. **Rule & doc bloat**: `ruleBloat` — line counts and item counts across `REVIEW.md`, `.verify/reliability-checklist.json`, `verify/SKILL.md`, `AGENTS.md`, and `CLAUDE.md`.
4. **Readiness audit log**: `commitCheckStats` — check verification coverage and false-positive rate before considering a switch from `observe` to `enforce`.

## Step 2: Distill Recurring Misses Into Rules (High Bar + Falsification)

Propose a new rule for `REVIEW.md` or `.verify/reliability-checklist.json` ONLY when it meets all three criteria:
1. **Recurring or severe**: appeared across at least 2 distinct PRs/commits (or caused a major outage).
2. **Diff-detectable**: specifies a clear diff trigger (paths or code patterns), never vague advice.
3. **Survives falsification**: ask the chosen falsifier agent to try to disprove the candidate rule on three grounds:
   - Will it cause frequent false positives on clean, stable commits?
   - Is it already caught by an existing compiler, linter, or automated test?
   - Is the wording too broad or likely to overfit to one past incident?

Present surviving candidate rules as a concise proposed diff for **explicit human approval** — never silently mutate default-branch rules.

## Step 3: Prune Flaky Tests & Bloated Rules

1. For each `.skip` or hardcoded `sleep` finding, propose either a real root-cause fix or deleting the broken test with a documented reason.
2. Identify outdated, redundant, or linter-superseded items in `REVIEW.md` and `.verify/reliability-checklist.json` and propose removals so verification stays fast and high-signal.
3. Output a brief **Verification Health Report** summarizing: proposed rule additions, proposed rule/test removals, and whether `commitCheck.mode` should stay `observe` or move to `enforce`.

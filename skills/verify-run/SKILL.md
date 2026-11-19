---
name: verify-run
description: >-
  Run local cheap checks and real end-to-end smoke verification for current changes, enforcing a
  3-round failure fuse, zero tolerance for flaky workarounds, and writing fresh evidence to
  .verify/last-run.json. Prompts whether to delegate verification to another agent (such as codex,
  claude, or a clean subagent) and reminds about verification stamps before git commit. Works
  completely standalone.
---

# verify-run

Execute fast checks and real end-to-end smoke verification against live changes, producing objective evidence. Completely standalone — does not require any other skill to have run first.

## Step 0: Execution Routing (Cross-Agent Delegation Prompt)

1. Check `<repo>/.verify/config.json` under `delegation["verify-run"]` (missing defaults to `"ask"`).
2. If the user did not specify an executor and the setting is `"ask"`, ask concisely before running who should execute verification:
   1. **Current agent**
   2. **Local `codex` CLI** (great for independent execution and saving main context):
      Write a concise brief (repo path, changed files, project `verify/SKILL.md` instructions, and required evidence format) to `.verify/tmp-verify-prompt.md`, then run:
      - Via bundled helper (if present): `node "../../scripts/delegate.mjs" --agent codex --mode workspace-write --cwd "<repo>" --prompt-file ".verify/tmp-verify-prompt.md" --out ".verify/delegations/verify-run-codex.md"`
      - Or direct CLI fallback: `codex exec -C "<repo>" -s workspace-write -o ".verify/delegations/verify-run-codex.md" - < ".verify/tmp-verify-prompt.md"`
   3. **Local `claude` CLI**:
      - Via bundled helper: `node "../../scripts/delegate.mjs" --agent claude --mode workspace-write --cwd "<repo>" --prompt-file ".verify/tmp-verify-prompt.md" --out ".verify/delegations/verify-run-claude.md"`
      - Or direct CLI fallback: `claude -p --max-turns 12 < ".verify/tmp-verify-prompt.md"`
   4. **Clean isolated subagent** (fresh context without implementation bias)

> When delegating externally, inspect the returned report to confirm real commands, exit codes, and fresh output are present — never accept unverified "looks good" claims.

## Step 1: Locate Verification Harness

Look for project-specific verification instructions in order:
1. Nearest `.agents/skills/verify/SKILL.md` or `.claude/skills/verify/SKILL.md` to the modified directory
2. Repo root `verify/SKILL.md`
3. If none exists (e.g., mid-flight project without init): infer fast checks and real run/smoke commands from `package.json`, `Makefile`, `pyproject.toml`, `Cargo.toml`, or `go.mod`, and mention `verify-init` afterward as an optional follow-up.

## Step 2: Layered Execution (Cheap Checks → Real Smoke Run)

1. **Cheap checks first**: run linter, typecheck, build, and fast unit/property tests locally before touching remote CI.
2. **Real end-to-end smoke run**: boot the app or compiled artifact and exercise affected user flows.
   - Reuse existing browser tooling (`chrome-devtools`, Playwright, `browser-use`, or host browser subagent) for Web UIs to capture screenshots and console state.
   - For CLIs/backends, run real commands or HTTP requests and verify exit codes, responses, logs, and persisted state.
3. **Root-cause debugging**: when a failure is unclear, apply structured root-cause investigation (e.g., `superpowers`'s `systematic-debugging` discipline) instead of guessing patches.

## Step 3: Non-Negotiable Guardrails

1. **3-round failure fuse**: fix failures and re-verify up to 3 rounds. **If the same check still fails after 3 rounds, stop immediately** and escalate to the user with full failure evidence (commands, logs, screenshots, and what each round tested).
2. **Zero tolerance for flaky workarounds**: never silence failures with `.skip`, `xit`, commented assertions, hardcoded `sleep`/`setTimeout`, or blind re-runs. If a test is genuinely flaky and the root cause cannot be found, stop and ask the user whether to fix or remove it with a written explanation.
3. **Fresh evidence only**: every pass claim must cite the exact commands run, exit codes, and fresh observed output from this run.

## Step 4: Record Evidence & Pre-Commit Reminder (No Hard Hook Needed)

If `<repo>/.verify/` exists (or the user wants verification tracking), write `.verify/last-run.json`:
```json
{
  "timestamp": "<ISO-8601>",
  "headSha": "<git rev-parse HEAD>",
  "executor": "self | subagent | codex | claude",
  "status": "passed | failed | fuse_triggered",
  "rounds": 1,
  "checks": ["lint", "build", "e2e-smoke"],
  "evidenceSummary": "<concise objective evidence>"
}
```
Before committing changes, remind the user/agent to include a verification trailer in the commit message (e.g., `Verified-by: verify-run(codex)` or `Verified-by: none (<reason>)`) — no hard-implanted harness hook required.

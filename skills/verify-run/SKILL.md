---
name: verify-run
description: >-
  Run local cheap checks and real end-to-end smoke verification for current changes, enforcing a
  3-round failure fuse, zero tolerance for flaky workarounds, and writing fresh evidence to
  .verify/last-run.json. Activate only when explicitly requested by the user OR when the repo's
  .verify/config.json enables profile "lite"/"full" (or includes "verify-run" in modules); stay
  silent on simple repos with no config. Supports delegating to codex, claude, or a clean subagent.
---

# verify-run

Execute fast checks and real end-to-end smoke verification against live changes, producing objective evidence. Completely standalone — does not require any other skill to have run first.

## Step 0: Profile Opt-In Gate & Cross-Agent Delegation

1. **HARD STOP — Opt-In Profile Check** (run before any build/test/smoke command):
   - Read `<repo>/.verify/config.json` if it exists.
   - **If `.verify/config.json` is missing** (and the user did not explicitly tell you to run `verify-run` directly without asking): **STOP immediately — do not execute any checks yet.** Ask the user in one brief question: (a) how this repo should run verification (`lite` smoke only / `full` / one-off `verify-run` without writing `.verify/` / `off` skip), and (b) which executor to use (`current agent` / `codex` / `claude` / clean subagent). Wait for their reply.
   - **If `.verify/config.json` exists** with `"profile": "off"` (or a custom `"modules"` list excluding `"verify-run"`): stay silent unless the user explicitly invoked `verify-run`.
   - Never auto-chain into `diff-gate`, `isolated-review`, or other modules after finishing unless asked.
2. **Execution Routing**: check `delegation["verify-run"]` in `.verify/config.json` (default `"ask"`). If the user did not specify an executor and the setting is `"ask"`, ask concisely before running:
   1. **Current agent**
   2. **Local `codex` CLI** (great for independent execution and saving main context):
      Write a concise brief (repo path, changed files, project `verify/SKILL.md` instructions, and required evidence format) to `.verify/tmp-verify-prompt.md` (or OS temp dir if `.verify/` doesn't exist), then run:
      - Via bundled helper (if present): `node "../../scripts/delegate.mjs" --agent codex --mode workspace-write --cwd "<repo>" --prompt-file <promptFile> --out <outFile>`
      - Or direct CLI fallback: `codex exec -C "<repo>" -s workspace-write -o <outFile> - < <promptFile>`
   3. **Local `claude` CLI**:
      - Via bundled helper: `node "../../scripts/delegate.mjs" --agent claude --mode workspace-write --cwd "<repo>" --prompt-file <promptFile> --out <outFile>`
      - Or direct CLI fallback: `claude -p --max-turns 12 < <promptFile>`
   4. **Clean isolated subagent** (fresh context without implementation bias)

> When delegating externally, inspect the returned report to confirm real commands, exit codes, and fresh output are present — never accept unverified "looks good" claims.

## Step 1: Locate Verification Harness

Look for project-specific verification instructions in order:
1. Nearest `.agents/skills/verify/SKILL.md` or `.claude/skills/verify/SKILL.md` to the modified directory
2. Repo root `verify/SKILL.md`
3. If none exists (e.g., mid-flight or ad-hoc repo): infer fast checks and real run/smoke commands from `package.json`, `Makefile`, `pyproject.toml`, `Cargo.toml`, or `go.mod`, and optionally mention `verify-init` (with `lite` profile) afterward.

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

Only if `<repo>/.verify/` already exists (or the user asks to track verification state), write `.verify/last-run.json`:
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
If the project uses `profile: "full"` (or `commitCheck.mode !== "off"`), remind before committing to include a verification trailer (e.g., `Verified-by: verify-run(codex)` or `Verified-by: none (<reason>)`).

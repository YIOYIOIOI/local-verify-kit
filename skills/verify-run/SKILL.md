---
name: verify-run
description: >-
  Run local cheap checks and real end-to-end smoke verification for current changes, enforcing a
  3-round failure fuse, zero tolerance for flaky workarounds, and writing fresh evidence to
  .verify/last-run.json. Activate only when explicitly requested by the user OR when the repo's
  .verify/config.json enables profile "lite"/"full" (or includes "verify-run" in modules); stay
  silent on simple repos with no config. Defaults to a clean isolated subagent (or current agent);
  external CLIs (codex/claude) are strict explicit opt-in only.
---

# verify-run

Execute fast checks and real end-to-end smoke verification against live changes, producing objective evidence. Completely standalone — does not require any other skill to have run first.

## Step 0: Profile Opt-In Gate & Executor Selection (Default: `subagent`)

1. **HARD STOP — Opt-In Profile Check** (run before any build/test/smoke command):
   - Read `<repo>/.verify/config.json` if it exists. If `targets` is defined (e.g., `private` vs `public` remote, or `dev` vs `release`), resolve the active `profile`/`modules` from the matching `targets.<name>` for the current task (defaulting to top-level `profile`).
   - **If `.verify/config.json` is missing** (and the user did not explicitly tell you to run `verify-run` directly without asking): **STOP immediately — do not execute any checks yet.** Ask the user in one brief question how this repo should run verification (`lite` smoke only / `full` / one-off `verify-run` without writing `.verify/` / `off` skip; executor defaults to `subagent`). Wait for their reply.
   - **If `.verify/config.json` exists** with `"profile": "off"` (or a custom `"modules"` list excluding `"verify-run"`): stay silent unless the user explicitly invoked `verify-run`.
   - Never auto-chain into `diff-gate`, `isolated-review`, or other modules after finishing unless asked.
2. **Execution Routing — Default Mode is `subagent` (External CLIs Strictly Opt-In)**:
   Check `delegation["verify-run"]` in `<repo>/.verify/config.json` (**default: `"subagent"`**). If set to `"ask"`, ask concisely before running (recommending `subagent` or `self`).
   1. **Clean isolated subagent (Default)** — fresh context without implementation bias and zero external CLI quota consumption.
   2. **Current agent (`self`)** — direct local run, or fallback when the host does not support subagents.
   3. **External CLI (`codex` or `claude`) — Strict Explicit Opt-In Only**:
      - **NEVER** choose an external CLI on your own, **NEVER** write `"codex"`, `"claude"`, or `"allowExternalCli"` into `.verify/config.json` unless the user explicitly named that CLI, and **NEVER** silently fall back from one external CLI to another on failure (stop and report or fall back to `subagent`).
      - Write a concise brief (repo path, changed files, project `verify/SKILL.md` instructions, and required evidence format) to `.verify/tmp-verify-prompt.md` (or OS temp dir if `.verify/` doesn't exist), then invoke exclusively through the gated helper `scripts/delegate.mjs` (fail-closed by default unless explicitly opted in):
        - `codex`: `node "../../scripts/delegate.mjs" --agent codex --mode workspace-write --cwd "<repo>" --prompt-file <promptFile> --out <outFile>`
        - `claude`: `node "../../scripts/delegate.mjs" --agent claude --mode workspace-write --cwd "<repo>" --prompt-file <promptFile> --out <outFile>`

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
If the project uses `profile: "full"` (or `commitCheck.mode !== "off"`), remind before committing to include a verification trailer (e.g., `Verified-by: verify-run(subagent)` or `Verified-by: none (<reason>)`).

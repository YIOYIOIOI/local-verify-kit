# Changelog

All notable changes to this project will be documented in this file.

## [0.2.3] - 2026-11-27

### Changed
- Set **`subagent`** (host-native clean isolated subagent) as the default delegation mode across all skills (`isolated-review`, `verify-run`, `diff-gate`, `verify-retro`, `verify-flow`, `verify-init`) and starter config templates (`examples/config.json`, `examples/config.lite.json`).
- Made external CLI delegation (`codex` / `claude`) strict explicit opt-in only: removed raw shell bypass fallbacks (`claude -p`, `codex exec`) from `SKILL.md` files and explicitly forbade auto-selecting, persisting, or silently falling back across external CLIs.

### Added
- Fail-closed policy gate in `scripts/delegate.mjs` (zero hooks, 100% cross-harness): blocks `codex`/`claude` with exit code `3` by default unless explicitly opted in via `LOCAL_VERIFY_ALLOW_EXTERNAL_CLI` or `.verify/config.json` (`"allowExternalCli"`), plus `LOCAL_VERIFY_ALLOW_EXTERNAL_CLI=none` global kill-switch.
- Regression checks in `test/validate-skills.mjs` (forbidding raw CLI bypass fallbacks in skills and external CLI defaults in starter templates) and unit tests in `test/scripts.test.mjs` covering `delegate.mjs` fail-closed enforcement.

## [0.2.2] - 2026-11-24

### Added
- Optional per-target profile overrides (`targets` in `.verify/config.json`, e.g., `private: lite` vs `public: full`, or `dev` vs `release`) plus `--target <name>` support in `skills/diff-gate/scripts/commit-check.mjs`.
- `examples/config.dual-repo.json` starter config and end-to-end integration test covering private vs. public target enforcement.

## [0.2.1] - 2026-11-24

### Changed
- Added an explicit **HARD STOP** check in `Step 0` of `verify-run`, `diff-gate`, `isolated-review`, and `verify-retro`: when `<repo>/.verify/config.json` is missing, agents must pause and ask the user for the project's desired profile (`lite` / `full` / one-off / `off`) and executor before running any checks, and must never auto-chain across modules unasked.

## [0.2.0] - 2026-11-24

### Added
- **Per-Project Verification Profiles (`off` / `lite` / `full`) & Custom `modules`**: install `local-verify-kit` globally once, keep simple repos completely quiet by default (no `.verify/config.json` = `off`), opt medium repos into `lite` (`verify-run` only), and enable `full` on core repositories — while explicit user commands always override the profile for one-off runs.
- `examples/config.lite.json` minimal starter config.
- Automated integration tests covering missing config, `profile: "off"`, and `profile: "lite"` enforcement semantics in `commit-check.mjs`.

### Changed
- Tightened opt-in activation guardrails across all 6 `SKILL.md` modules so heavy workflows (`isolated-review`, `diff-gate`, `verify-retro`) never auto-trigger on simple or `lite` repositories.
- Updated `verify-init` to ask for `lite` vs `full` profile upfront (skipping `REVIEW.md` and diff checklists for `lite` projects).
- Updated `commit-check.mjs` to treat missing `.verify/config.json` or `profile: "off"` as silent pass without writing files, while maintaining full backward compatibility with `v0.1.0` configs.

## [0.1.0] - 2026-11-19

### Added
- Six standalone, harness-agnostic Agent Skills (`verify-init`, `verify-run`, `diff-gate`, `isolated-review`, `verify-retro`, `verify-flow`).
- Cross-agent delegation support across every execution skill (`codex`, `claude`, isolated subagent, or current agent) via `scripts/delegate.mjs` and direct CLI fallbacks.
- Local Stage-05 base-branch rule isolator (`skills/isolated-review/scripts/base-rules.mjs`) with tampering detection and `HEAD` SHA binding.
- Local Stage-06 git-history retrospective & flaky-test scanner (`skills/verify-retro/scripts/retro-scan.mjs`).
- Non-intrusive pre-commit readiness & verification stamp checker (`skills/diff-gate/scripts/commit-check.mjs`) using skill-level reminders instead of hard-implanted hooks.
- Starter templates in `examples/`, custom SVG brand assets, bilingual documentation (`README.md` + `README.zh-CN.md`), and cross-platform CI tests (`node:test`).

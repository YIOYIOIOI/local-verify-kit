# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-11-19

### Added
- Six standalone, harness-agnostic Agent Skills (`verify-init`, `verify-run`, `diff-gate`, `isolated-review`, `verify-retro`, `verify-flow`).
- Cross-agent delegation support across every execution skill (`codex`, `claude`, isolated subagent, or current agent) via `scripts/delegate.mjs` and direct CLI fallbacks.
- Local Stage-05 base-branch rule isolator (`skills/isolated-review/scripts/base-rules.mjs`) with tampering detection and `HEAD` SHA binding.
- Local Stage-06 git-history retrospective & flaky-test scanner (`skills/verify-retro/scripts/retro-scan.mjs`).
- Non-intrusive pre-commit readiness & verification stamp checker (`skills/diff-gate/scripts/commit-check.mjs`) using skill-level reminders instead of hard-implanted hooks.
- Starter templates in `examples/`, custom SVG brand assets, bilingual documentation (`README.md` + `README.zh-CN.md`), and cross-platform CI tests (`node:test`).

# Security Policy

## Threat Model

`local-verify-kit` is designed around two local security invariants:

1. **Tamper-resistant review rules**: `isolated-review` and `skills/isolated-review/scripts/base-rules.mjs` always read `REVIEW.md` and `.verify/reliability-checklist.json` from the default base branch via `git show <baseBranch>:...`, never from the active feature branch or working tree, and explicitly surface a `ruleTamperingWarning` if rule files were modified.
2. **Least-privilege cross-agent delegation**: `scripts/delegate.mjs` defaults to read-only execution (`--mode read-only`) for audit, diff-gate, isolated-review, and retro falsification passes. Write access (`--mode workspace-write`) is reserved for explicit test/smoke runs (`verify-run`, `verify-init`).

## Reporting a Vulnerability

If you discover a command-injection risk, shell-escaping bug, or rule-isolation bypass in any script:
- Please open a private GitHub Security Advisory on the repository rather than posting an exploit publicly.
- Include reproduction steps, OS, Node.js version, and the affected script path.

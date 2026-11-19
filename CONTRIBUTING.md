# Contributing to Local Verify Kit

Thank you for helping make local-first AI coding verification sharper and simpler!

## Design Guardrails (Please Read Before Opening a PR)

1. **Every module must work standalone**: Do not couple skills into a mandatory end-to-end state machine. Loose file exchange under `.verify/` must always degrade gracefully when absent.
2. **Stay harness-agnostic**: Never reference host-specific internal tool names, environment variables, or hard-implanted hook schemas (`hooks.json`). Keep skills portable across Claude Code, Codex, Cursor, Antigravity, and any Agent Skills host.
3. **Reuse mature ecosystem tools first**: Do not duplicate TDD, planning, worktree, or browser-automation skills that mature projects (such as `superpowers` or `chrome-devtools`) already own.
4. **Zero runtime dependencies**: Helper scripts under `scripts/` and `skills/*/scripts/` must rely strictly on Node.js >= 18 built-ins and `git`.

## Local Checks Before Opening a PR

```bash
npm run check
```

This runs both `npm run lint:skills` (frontmatter, manifests, anti-host-lock-in checks, zero-hook policy) and `npm test` (real temporary Git repo integration tests).

# Code Review Guidelines (`REVIEW.md`)

> Keep this file on your default branch (`main`). During `isolated-review`, the reviewer
> reads this file strictly from the default branch — never from the PR/feature branch.

## Must-Check Invariants (Important)

1. **Backward compatibility on persisted state**: Any schema or storage change must safely load older files/records without crashing.
2. **Boundary & auth enforcement**: Server-side endpoints and CLI privileged actions must validate caller identity and input bounds.
3. **No silent error swallowing**: Never catch and discard errors without explicit logging or structured propagation.
4. **No flaky-test shortcuts**: Reject PRs that add `.skip`, `xit`, or arbitrary `sleep` / `setTimeout` delays to make failing tests appear green.

## Review Output Policy

- Tag every finding as `[Important]`, `[Nit]`, or `[Pre-existing]`.
- Cite exact `file:line` and concrete failure impact for every `[Important]` item.
- Do not block a change over `[Pre-existing]` issues untouched by the diff.

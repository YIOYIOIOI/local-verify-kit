#!/usr/bin/env node
/**
 * Base-Branch Rule Isolator (zero dependencies, harness-agnostic).
 *
 * Extracts REVIEW.md and .verify/reliability-checklist.json strictly from the
 * default base branch (never from the working branch), detects rule tampering,
 * and binds review context to the exact HEAD commit SHA.
 *
 * Usage:
 *   node base-rules.mjs [--cwd <repoDir>] [--base <branch>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function parseArgs(argv) {
  const opts = { cwd: process.cwd(), base: '' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cwd') opts.cwd = argv[++i] || process.cwd();
    else if (argv[i] === '--base') opts.base = argv[++i] || '';
  }
  return opts;
}

function tryGit(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function detectBaseBranch(cwd, explicitBase) {
  if (explicitBase && tryGit(['rev-parse', '--verify', explicitBase], cwd)) {
    return explicitBase;
  }
  const symref = tryGit(['symbolic-ref', 'refs/remotes/origin/HEAD'], cwd);
  if (symref) {
    const candidate = symref.replace(/^refs\/remotes\//, '');
    if (tryGit(['rev-parse', '--verify', candidate], cwd)) return candidate;
  }
  for (const candidate of ['origin/main', 'main', 'origin/master', 'master']) {
    if (tryGit(['rev-parse', '--verify', candidate], cwd)) return candidate;
  }
  return 'HEAD';
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const repoRoot = tryGit(['rev-parse', '--show-toplevel'], opts.cwd);
  if (!repoRoot) {
    console.error(JSON.stringify({ error: 'Not a git repository', cwd: opts.cwd }));
    process.exit(1);
  }

  const baseBranch = detectBaseBranch(repoRoot, opts.base);
  const currentBranch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot) || 'HEAD';
  const headSha = tryGit(['rev-parse', 'HEAD'], repoRoot) || 'UNBORN';
  const baseSha = tryGit(['rev-parse', baseBranch], repoRoot) || headSha;
  const dirtyStatus = tryGit(['status', '--porcelain'], repoRoot) || '';

  const baseReviewMd = tryGit(['show', `${baseBranch}:REVIEW.md`], repoRoot);
  const baseChecklistRaw = tryGit(['show', `${baseBranch}:.verify/reliability-checklist.json`], repoRoot);

  const committedChanged =
    baseBranch !== 'HEAD'
      ? (tryGit(['diff', '--name-only', `${baseBranch}...HEAD`], repoRoot) || '').split(/\r?\n/).filter(Boolean)
      : [];
  const workingChanged = (tryGit(['diff', '--name-only'], repoRoot) || '').split(/\r?\n/).filter(Boolean);
  const stagedChanged = (tryGit(['diff', '--cached', '--name-only'], repoRoot) || '').split(/\r?\n/).filter(Boolean);
  const allChanged = Array.from(new Set([...committedChanged, ...workingChanged, ...stagedChanged]));

  const ruleFilesTouched = allChanged.filter(
    (f) => f === 'REVIEW.md' || f === '.verify/reliability-checklist.json' || f === '.verify/config.json'
  );

  let priorReview = null;
  const lastReviewPath = path.join(repoRoot, '.verify', 'last-review.json');
  if (fs.existsSync(lastReviewPath)) {
    try {
      priorReview = JSON.parse(fs.readFileSync(lastReviewPath, 'utf8'));
    } catch {
      priorReview = null;
    }
  }

  const result = {
    repoRoot,
    baseBranch,
    baseSha,
    currentBranch,
    headSha,
    hasUncommittedChanges: dirtyStatus.length > 0,
    changedFiles: allChanged,
    ruleTamperingWarning: ruleFilesTouched.length > 0,
    ruleFilesTouched,
    baseReviewMdFound: baseReviewMd !== null,
    baseReviewMd: baseReviewMd || '',
    baseChecklistFound: baseChecklistRaw !== null,
    baseChecklist: (() => {
      if (!baseChecklistRaw) return null;
      try {
        return JSON.parse(baseChecklistRaw);
      } catch {
        return { parseError: true, raw: baseChecklistRaw };
      }
    })(),
    priorReview,
    priorReviewStale: Boolean(priorReview && priorReview.headSha && priorReview.headSha !== headSha),
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main();

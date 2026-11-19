#!/usr/bin/env node
/**
 * Commit Readiness & Verification Stamp Checker (zero dependencies, harness-agnostic).
 *
 * Called directly by the agent (on skill reminder) or optionally from a user's
 * standard `.git/hooks/pre-commit` script. Never requires a harness-specific hook.
 *
 * Exit codes:
 *   0 - ready / allowed (including observe mode, off mode, exempt reason, or escape hatch)
 *   1 - blocked in enforce mode (fresh verification evidence missing)
 *
 * Usage:
 *   node commit-check.mjs [--cwd <repoDir>] [--session <id>] [--message <commitMsg>]
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function parseArgs(argv) {
  const opts = { cwd: process.cwd(), session: 'default', message: '' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cwd') opts.cwd = argv[++i] || process.cwd();
    else if (argv[i] === '--session') opts.session = argv[++i] || 'default';
    else if (argv[i] === '--message') opts.message = argv[++i] || '';
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

function safeReadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function hasExemption(message) {
  return /\[skip-verify:[^\]]+\]|Verify-Exempt:|Verified-by:\s*none\s*\([^)]+\)/i.test(message || '');
}

function getEscapeStateFile(sessionId) {
  const dir = path.join(os.tmpdir(), 'local-verify-kit-commit-check');
  fs.mkdirSync(dir, { recursive: true });
  const safeId = String(sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(dir, `blocks-${safeId}.json`);
}

function readBlocks(sessionId) {
  return Number(safeReadJson(getEscapeStateFile(sessionId))?.blocks || 0);
}

function writeBlocks(sessionId, blocks) {
  try {
    fs.writeFileSync(
      getEscapeStateFile(sessionId),
      JSON.stringify({ blocks, updatedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch {
    // non-fatal
  }
}

function appendAuditLog(verifyDir, entry) {
  try {
    if (!fs.existsSync(verifyDir)) return;
    fs.appendFileSync(path.join(verifyDir, 'commit-check.log.jsonl'), JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // non-fatal
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const repoRoot = tryGit(['rev-parse', '--show-toplevel'], opts.cwd);
  if (!repoRoot) {
    process.stdout.write(JSON.stringify({ status: 'allow', reason: 'Not a git repository' }, null, 2) + '\n');
    return;
  }

  const verifyDir = path.join(repoRoot, '.verify');
  const config = safeReadJson(path.join(verifyDir, 'config.json')) || {};
  const gateCfg = config.commitCheck || config.commitGate || {};
  const mode = gateCfg.mode || 'observe';

  const requireAny =
    Array.isArray(gateCfg.requireAny) && gateCfg.requireAny.length > 0
      ? gateCfg.requireAny
      : ['verify-run', 'isolated-review'];
  const maxAgeMinutes = Number(gateCfg.maxAgeMinutes || 120);
  const maxBlocks = Number(gateCfg.maxBlocksPerSession || 2);

  const headSha = tryGit(['rev-parse', 'HEAD'], repoRoot) || 'UNBORN';
  const now = Date.now();

  const lastRun = safeReadJson(path.join(verifyDir, 'last-run.json'));
  const lastReview = safeReadJson(path.join(verifyDir, 'last-review.json'));
  const lastDiffGate = safeReadJson(path.join(verifyDir, 'last-diff-gate.json'));

  const isFresh = (rec) => {
    if (!rec || rec.status !== 'passed') return false;
    const ts = Date.parse(rec.timestamp || '');
    if (!Number.isFinite(ts) || now - ts > maxAgeMinutes * 60 * 1000) return false;
    if (rec.headSha && headSha !== 'UNBORN' && rec.headSha !== headSha) return false;
    return true;
  };

  const stamps = [];
  if (isFresh(lastRun)) stamps.push(`verify-run(${lastRun.executor || 'local'})`);
  if (isFresh(lastReview)) stamps.push(`isolated-review(${lastReview.executor || 'local'})`);
  if (isFresh(lastDiffGate)) stamps.push(`diff-gate(${lastDiffGate.executor || 'local'})`);

  const satisfied =
    (requireAny.includes('verify-run') && isFresh(lastRun)) ||
    (requireAny.includes('isolated-review') && isFresh(lastReview)) ||
    (requireAny.includes('diff-gate') && isFresh(lastDiffGate));

  const exempt = hasExemption(opts.message);
  const recommendedTrailer =
    stamps.length > 0 ? `Verified-by: ${stamps.join(', ')}` : 'Verified-by: none (<explain reason>)';

  const baseRecord = {
    timestamp: new Date().toISOString(),
    mode,
    headSha,
    stamps: stamps.length > 0 ? stamps : ['none'],
    satisfied,
    exempt,
    recommendedTrailer,
  };

  if (mode === 'off' || satisfied || exempt) {
    const out = { ...baseRecord, status: 'allow', action: 'allow' };
    appendAuditLog(verifyDir, out);
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    return;
  }

  if (mode === 'observe') {
    const out = {
      ...baseRecord,
      status: 'allow',
      action: 'observe_would_block',
      note: `Observe mode: commit allowed, but no fresh verification evidence found for HEAD ${headSha.slice(0, 7)}.`,
    };
    appendAuditLog(verifyDir, out);
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    return;
  }

  const prevBlocks = readBlocks(opts.session);
  if (prevBlocks >= maxBlocks) {
    const out = {
      ...baseRecord,
      status: 'allow',
      action: 'escape_hatch_allow',
      priorBlocks: prevBlocks,
      note: `Escape hatch triggered after ${prevBlocks} consecutive blocks in session "${opts.session}".`,
    };
    appendAuditLog(verifyDir, out);
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    return;
  }

  const nextBlocks = prevBlocks + 1;
  writeBlocks(opts.session, nextBlocks);
  const out = {
    ...baseRecord,
    status: 'block',
    action: 'block',
    blockNumber: nextBlocks,
    maxBlocksPerSession: maxBlocks,
    reason: `Missing fresh verification evidence (${requireAny.join(' or ')}) for HEAD ${headSha.slice(0, 7)}. Run verify-run/isolated-review or add [skip-verify: <reason>] in your commit message.`,
  };
  appendAuditLog(verifyDir, out);
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(1);
}

main();

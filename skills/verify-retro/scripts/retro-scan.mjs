#!/usr/bin/env node
/**
 * Local Retrospective & Health Scanner (zero dependencies, harness-agnostic).
 *
 * Scans:
 *   1. Recent git history for reverts & hotfix commits
 *   2. Test files for forbidden flaky-test workarounds (.skip, xit, test.skip, sleep, setTimeout)
 *   3. Verification artifact bloat (REVIEW.md, reliability-checklist.json, verify/SKILL.md)
 *   4. Commit-check audit log stats (.verify/commit-check.log.jsonl)
 *
 * Usage:
 *   node retro-scan.mjs [--cwd <repoDir>] [--since "30 days ago"]
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function parseArgs(argv) {
  const opts = { cwd: process.cwd(), since: '30 days ago' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cwd') opts.cwd = argv[++i] || process.cwd();
    else if (argv[i] === '--since') opts.since = argv[++i] || '30 days ago';
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
    return '';
  }
}

function isTestFile(relPath) {
  return /(^|[\\/])(__tests__|tests?|spec)[\\/]|(\.(test|spec)\.[a-z0-9]+$|_test\.(go|py|rs)$)/i.test(relPath);
}

function scanFlakyPatterns(repoRoot) {
  const tracked = tryGit(['ls-files'], repoRoot).split(/\r?\n/).filter(Boolean);
  const testFiles = tracked.filter(isTestFile);
  const findings = [];

  const rules = [
    {
      id: 'skipped-test',
      regex: /\b(it|test|describe)\.skip\s*\(|\bx(it|test|describe)\s*\(|@pytest\.mark\.skip|@unittest\.skip|t\.Skip\s*\(/,
    },
    {
      id: 'hardcoded-sleep',
      regex: /\btime\.sleep\s*\(|\bsetTimeout\s*\([^,]+,\s*\d{3,}|\bThread\.sleep\s*\(|\basyncio\.sleep\s*\(/,
    },
  ];

  for (const rel of testFiles) {
    const abs = path.join(repoRoot, rel);
    let content = '';
    try {
      content = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      for (const r of rules) {
        if (r.regex.test(line)) {
          findings.push({
            file: rel,
            line: idx + 1,
            rule: r.id,
            snippet: line.trim().slice(0, 120),
          });
        }
      }
    });
  }
  return { scannedTestFiles: testFiles.length, findings: findings.slice(0, 50) };
}

function inspectBloat(repoRoot) {
  const candidates = [
    'REVIEW.md',
    '.verify/reliability-checklist.json',
    '.agents/skills/verify/SKILL.md',
    '.claude/skills/verify/SKILL.md',
    'AGENTS.md',
    'CLAUDE.md',
  ];
  const stats = [];
  for (const rel of candidates) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    const lines = text.split(/\r?\n/).length;
    const item = { file: rel, lines, bytes: Buffer.byteLength(text, 'utf8') };
    if (rel.endsWith('.json')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed?.items)) item.checklistItems = parsed.items.length;
      } catch {
        item.parseError = true;
      }
    }
    stats.push(item);
  }
  return stats;
}

function inspectCheckLog(repoRoot) {
  const candidates = [
    path.join(repoRoot, '.verify', 'commit-check.log.jsonl'),
    path.join(repoRoot, '.verify', 'commit-gate.log.jsonl'),
  ];
  const logPath = candidates.find((p) => fs.existsSync(p));
  if (!logPath) return null;
  const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const summary = { totalChecks: 0, verified: 0, unverified: 0, wouldBlock: 0, blocked: 0, escapeHatch: 0 };
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      summary.totalChecks += 1;
      if (entry.satisfied) summary.verified += 1;
      else summary.unverified += 1;
      if (entry.action === 'observe_would_block') summary.wouldBlock += 1;
      if (entry.action === 'block' || entry.action === 'deny') summary.blocked += 1;
      if (entry.action === 'escape_hatch_allow') summary.escapeHatch += 1;
    } catch {
      // skip malformed line
    }
  }
  return summary;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const repoRoot = tryGit(['rev-parse', '--show-toplevel'], opts.cwd);
  if (!repoRoot) {
    console.error(JSON.stringify({ error: 'Not a git repository', cwd: opts.cwd }));
    process.exit(1);
  }

  const logRaw = tryGit(
    ['log', `--since=${opts.since}`, '--pretty=format:%H%x09%ad%x09%s', '--date=short'],
    repoRoot
  );
  const commits = logRaw
    ? logRaw.split(/\r?\n/).map((line) => {
        const [sha, date, subject] = line.split('\t');
        return { sha, date, subject };
      })
    : [];

  const reverts = commits.filter((c) => /^revert\b|\brevert\b/i.test(c.subject));
  const fixes = commits.filter((c) => /^(fix|hotfix|bugfix)(\([^)]+\))?:/i.test(c.subject));

  const result = {
    repoRoot,
    since: opts.since,
    totalCommits: commits.length,
    revertCount: reverts.length,
    reverts: reverts.slice(0, 20),
    fixCommitCount: fixes.length,
    recentFixes: fixes.slice(0, 20),
    flakyScan: scanFlakyPatterns(repoRoot),
    ruleBloat: inspectBloat(repoRoot),
    commitCheckStats: inspectCheckLog(repoRoot),
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main();

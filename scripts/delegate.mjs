#!/usr/bin/env node
/**
 * Cross-Agent Delegation Runner (zero dependencies, harness-agnostic).
 *
 * Delegates a focused prompt to a locally installed CLI coding agent (`codex` or `claude`)
 * over stdin so long prompts and Windows/Unix shell escaping stay reliable.
 *
 * Usage:
 *   node scripts/delegate.mjs --check
 *   node scripts/delegate.mjs --agent codex --cwd <repoDir> --mode read-only --prompt-file <file> [--out <file>]
 *   node scripts/delegate.mjs --agent codex --review --base main --cwd <repoDir> --prompt-file <file> [--out <file>]
 *   node scripts/delegate.mjs --agent claude --cwd <repoDir> --mode read-only --prompt-file <file> [--out <file>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
  const opts = {
    agent: '',
    cwd: process.cwd(),
    mode: 'read-only',
    review: false,
    base: '',
    model: '',
    promptFile: '',
    out: '',
    maxTurns: '12',
    check: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--agent') opts.agent = argv[++i] || '';
    else if (a === '--cwd') opts.cwd = argv[++i] || process.cwd();
    else if (a === '--mode') opts.mode = argv[++i] || 'read-only';
    else if (a === '--review') opts.review = true;
    else if (a === '--base') opts.base = argv[++i] || '';
    else if (a === '--model') opts.model = argv[++i] || '';
    else if (a === '--prompt-file') opts.promptFile = argv[++i] || '';
    else if (a === '--out') opts.out = argv[++i] || '';
    else if (a === '--max-turns') opts.maxTurns = argv[++i] || '12';
    else if (a === '--check') opts.check = true;
  }
  return opts;
}

function quoteCmdArg(arg) {
  if (!/[\s"&|<>^()]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '\\"')}"`;
}

function detectCli(cmd) {
  const isWin = process.platform === 'win32';
  const probe = spawnSync(isWin ? 'where' : 'which', [cmd], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return probe.status === 0;
}

function runCodex(opts, prompt) {
  const isWin = process.platform === 'win32';
  const args = ['exec'];

  if (opts.review) {
    args.push('review');
    if (opts.base) args.push('--base', opts.base);
    if (opts.model) args.push('-m', opts.model);
    if (opts.out) args.push('-o', path.resolve(opts.out));
    args.push('-');
  } else {
    args.push('-C', path.resolve(opts.cwd));
    args.push('-s', opts.mode === 'workspace-write' ? 'workspace-write' : 'read-only');
    if (opts.model) args.push('-m', opts.model);
    if (opts.out) args.push('-o', path.resolve(opts.out));
    args.push('-');
  }

  if (isWin) {
    const cmdLine = ['codex', ...args.map(quoteCmdArg)].join(' ');
    return spawnSync('cmd.exe', ['/d', '/s', '/c', cmdLine], {
      cwd: opts.cwd,
      input: prompt,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
  }

  return spawnSync('codex', args, {
    cwd: opts.cwd,
    input: prompt,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function runClaude(opts, prompt) {
  const args = ['-p'];
  if (opts.model) args.push('--model', opts.model);
  if (opts.maxTurns) args.push('--max-turns', String(opts.maxTurns));

  if (opts.mode === 'read-only') {
    args.push(
      '--allowedTools',
      'Read,Glob,Grep,Bash(git diff *),Bash(git status*),Bash(git log *),Bash(git show *)'
    );
  }

  const res = spawnSync('claude', args, {
    cwd: opts.cwd,
    input: prompt,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  if (opts.out && res.stdout) {
    fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
    fs.writeFileSync(path.resolve(opts.out), res.stdout, 'utf8');
  }
  return res;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.check) {
    process.stdout.write(
      JSON.stringify(
        { codex: detectCli('codex'), claude: detectCli('claude'), gh: detectCli('gh') },
        null,
        2
      ) + '\n'
    );
    return;
  }

  if (!['codex', 'claude'].includes(opts.agent)) {
    console.error('Error: --agent must be "codex" or "claude" (or pass --check)');
    process.exit(2);
  }

  const prompt = opts.promptFile ? fs.readFileSync(opts.promptFile, 'utf8') : fs.readFileSync(0, 'utf8');
  if (!prompt.trim()) {
    console.error('Error: empty prompt');
    process.exit(2);
  }

  if (opts.out) {
    fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
  }

  const res = opts.agent === 'codex' ? runCodex(opts, prompt) : runClaude(opts, prompt);
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);

  if (res.error) {
    console.error(`Failed to launch ${opts.agent}: ${res.error.message}`);
    process.exit(1);
  }
  process.exit(res.status ?? 0);
}

main();

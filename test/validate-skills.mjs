#!/usr/bin/env node
/**
 * Validates skill manifests, frontmatter, JSON configs, and harness-agnostic hygiene.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function fail(msg) {
  errors.push(msg);
}

// 1. Validate JSON files
for (const rel of [
  'plugin.json',
  '.claude-plugin/plugin.json',
  'package.json',
  'examples/config.json',
  'examples/reliability-checklist.json',
]) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    fail(`Missing required file: ${rel}`);
    continue;
  }
  try {
    JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    fail(`Invalid JSON in ${rel}: ${err.message}`);
  }
}

// 2. Enforce zero hard-implanted hooks policy
for (const forbidden of ['hooks.json', 'hooks/hooks.json']) {
  if (fs.existsSync(path.join(ROOT, forbidden))) {
    fail(`Hard-implanted hook file is forbidden by design: ${forbidden}`);
  }
}

// 3. Validate skills frontmatter & harness-agnostic hygiene
const skillsDir = path.join(ROOT, 'skills');
const skillDirs = fs
  .readdirSync(skillsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

if (skillDirs.length < 5) {
  fail(`Expected at least 5 modular skills, found ${skillDirs.length}`);
}

const forbiddenHostPatterns = [
  { regex: /\bask_question\b/, label: 'host-specific tool name "ask_question"' },
  { regex: /\bPLUGIN_DATA\b/, label: 'host-specific env var "PLUGIN_DATA"' },
  { regex: /\bPreToolUse\b/, label: 'harness hook event "PreToolUse"' },
  { regex: /C:\\Users\\/i, label: 'hardcoded Windows user path' },
  { regex: /\/Users\/[a-z0-9_-]+\//i, label: 'hardcoded macOS user path' },
];

for (const dir of skillDirs) {
  const mdPath = path.join(skillsDir, dir, 'SKILL.md');
  if (!fs.existsSync(mdPath)) {
    fail(`Missing SKILL.md in skills/${dir}`);
    continue;
  }
  const content = fs.readFileSync(mdPath, 'utf8');
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    fail(`Missing YAML frontmatter in skills/${dir}/SKILL.md`);
    continue;
  }
  const fm = fmMatch[1];
  const nameMatch = fm.match(/^name:\s*([a-z0-9-]+)\s*$/m);
  if (!nameMatch) {
    fail(`Missing or invalid lowercase kebab-case "name" in skills/${dir}/SKILL.md`);
  } else if (nameMatch[1] !== dir) {
    fail(`Skill name "${nameMatch[1]}" does not match directory "${dir}"`);
  }
  if (!/^description:/m.test(fm)) {
    fail(`Missing "description" in skills/${dir}/SKILL.md`);
  }

  for (const check of forbiddenHostPatterns) {
    if (check.regex.test(content)) {
      fail(`skills/${dir}/SKILL.md contains ${check.label}`);
    }
  }
}

// 4. Validate all scripts for host-specific leakage
function walkScripts(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'test') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkScripts(full));
    else if (entry.name.endsWith('.mjs')) out.push(full);
  }
  return out;
}

for (const scriptPath of walkScripts(ROOT)) {
  const content = fs.readFileSync(scriptPath, 'utf8');
  const rel = path.relative(ROOT, scriptPath);
  for (const check of forbiddenHostPatterns) {
    if (check.regex.test(content)) {
      fail(`${rel} contains ${check.label}`);
    }
  }
}

if (errors.length > 0) {
  console.error('Skill validation failed:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`OK: validated ${skillDirs.length} skills, manifests, and harness-agnostic hygiene.`);

// Zero-install lint: syntax-checks every .mjs in the tree and enforces the
// house rules a test cannot see from inside a module.
//
//   node tools/lint.mjs
//
// Rules:
//   1. every .mjs parses (`node --check`)
//   2. every import is a `node:` builtin or a relative path — no npm packages
//   3. the pure modules (config, agent-doc, handler, vendor-domain) import no `node:` at all
//   4. no console.* in src/ — the server writes to process.stdout/stderr on purpose
//   5. no credential-shaped string anywhere in the tree

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PURE_MODULES = ['src/config.mjs', 'src/agent-doc.mjs', 'src/handler.mjs', 'src/vendor-domain.mjs'];
const SKIP_DIRS = new Set(['.git', 'node_modules']);

const CREDENTIAL_SHAPES = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
  /\bsk-[A-Za-z0-9]{32,}\b/,
  /\b[0-9]{8,10}:[A-Za-z0-9_-]{35}\b/,
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const problems = [];
const files = walk(ROOT);
const modules = files.filter((file) => file.endsWith('.mjs'));

for (const file of modules) {
  const rel = relative(ROOT, file);
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    problems.push(`${rel}: does not parse\n${error.stderr}`);
    continue;
  }

  const source = readFileSync(file, 'utf8');
  const specifiers = [...source.matchAll(/^\s*(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  for (const specifier of specifiers) {
    const builtin = specifier.startsWith('node:');
    const local = specifier.startsWith('./') || specifier.startsWith('../');
    if (!builtin && !local) problems.push(`${rel}: imports "${specifier}" — only node: builtins and relative paths are allowed`);
    if (builtin && PURE_MODULES.includes(rel)) problems.push(`${rel}: is a pure module and must not import ${specifier}`);
  }

  if (rel.startsWith('src/') && /\bconsole\.(log|warn|error|info)\b/.test(source)) {
    problems.push(`${rel}: uses console.* — write to process.stdout/stderr at the edge, nothing in the pure modules`);
  }
}

for (const file of files) {
  const rel = relative(ROOT, file);
  if (/\.(png|jpg|ico|woff2?)$/.test(rel)) continue;
  const text = readFileSync(file, 'utf8');
  for (const shape of CREDENTIAL_SHAPES) {
    if (shape.test(text)) problems.push(`${rel}: contains a credential-shaped string (${shape})`);
  }
}

if (problems.length) {
  process.stderr.write(`lint: ${problems.length} problem(s)\n  - ${problems.join('\n  - ')}\n`);
  process.exit(1);
}
process.stdout.write(`lint: ${modules.length} modules parse, imports are node:/relative only, no credential shapes in ${files.length} files\n`);

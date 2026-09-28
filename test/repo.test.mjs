// Repo gates: the claims the README and CLAUDE.md make about this tree,
// checked against the tree.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './fixtures.mjs';

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const pkg = JSON.parse(read('package.json'));

test('package.json: private, ESM, Node 22, no dependencies of any kind', () => {
  assert.equal(pkg.name, '@flashylabs/bastion');
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.engines.node, '>=22');
  for (const key of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    assert.equal(pkg[key], undefined, `${key} must not exist`);
  }
  assert.equal(pkg.scripts.start, 'node src/server.mjs examples/operator.config.json');
  assert.ok(!existsSync(join(ROOT, 'node_modules')), 'nothing to install, nothing installed');
});

test('no LICENSE file: the licence is declared once, in flashyos', () => {
  for (const name of readdirSync(ROOT)) {
    assert.ok(!/^licen[cs]e/i.test(name), `${name} must not exist here`);
  }
});

test('README ends on the exact licence line and carries the status and visibility lines', () => {
  const readme = read('README.md');
  const lines = readme.trimEnd().split('\n');
  assert.equal(lines.at(-1), 'Licence: proprietary; to be declared. The estate licence register in flashyos governs.');
  assert.ok(readme.includes('Status: v0 skeleton, in design'));
  assert.ok(readme.includes('Visibility: private-intended'));
});

test('README and CLAUDE.md name the three sibling specs and never redefine them', () => {
  for (const file of ['README.md', 'CLAUDE.md', 'ARCHITECTURE.md']) {
    const text = read(file);
    for (const spec of ['agent/1', 'delegation/1', 'pay-policy/1']) {
      assert.ok(text.includes(spec), `${file} must name ${spec}`);
    }
  }
});

test('CLAUDE.md carries the estate house rules verbatim', () => {
  const claude = read('CLAUDE.md');
  for (const rule of [
    '## House rules — true in every repository in this estate',
    '**`main` is not necessarily the default branch.** Ask, every time: `git symbolic-ref --short refs/remotes/origin/HEAD`.',
    '**Say which branch you measured.** Reading the working tree tells you about your checkout, not the repository.',
    '**Re-vendor before you trust a vendored change.** Files named `vendor-*.mjs` are byte-identical copies; a stale copy disagrees silently.',
    '**No secret in a file, a repo, or an artifact.** Secret Manager only.',
    '**The licence is declared once**, in `tools/estate-licences.mjs` in flashyos. Do not decide this repository\'s licence inside it.',
    '**A generated file is regenerated, never hand-edited.**',
    '**Report what happened, including when it is worse than expected.**',
  ]) {
    assert.ok(claude.includes(rule), `missing: ${rule}`);
  }
});

test('the pure modules import no node: builtin; only the server does', () => {
  const pure = ['src/config.mjs', 'src/agent-doc.mjs', 'src/handler.mjs', 'src/vendor-domain.mjs'];
  for (const rel of pure) {
    assert.ok(!/from\s+['"]node:/.test(read(rel)), `${rel} must stay pure`);
  }
  assert.ok(!/^\s*import\b/m.test(read('src/vendor-domain.mjs')), 'the vendored domain rule imports nothing at all');
  assert.ok(/from\s+['"]node:http['"]/.test(read('src/server.mjs')));
  const srcFiles = readdirSync(join(ROOT, 'src'));
  assert.deepEqual(srcFiles.sort(), ['agent-doc.mjs', 'config.mjs', 'handler.mjs', 'server.mjs', 'vendor-domain.mjs']);
});

test('the well-known path is /.well-known/agent and nothing else — no .json alternate anywhere in src', () => {
  for (const rel of ['src/config.mjs', 'src/agent-doc.mjs', 'src/handler.mjs', 'src/server.mjs']) {
    const text = read(rel);
    assert.ok(!text.includes('agent.json'), `${rel} must not name a .json spelling of the well-known path`);
  }
  assert.ok(read('src/agent-doc.mjs').includes("export const WELL_KNOWN_PATH = '/.well-known/agent';"));
});

test('the example operator is fictional and says so', () => {
  const example = read('examples/operator.config.json');
  assert.ok(example.includes('fictional'));
  assert.ok(/\.example\b/.test(example), 'example hosts stay on .example');
  assert.ok(!/\.(com|io|net|org|co\.uk)\b/.test(example), 'no real-looking TLD in the example');
});

test('no user-facing copy claims adoption or an audience', () => {
  for (const file of ['README.md', 'ARCHITECTURE.md', 'CLAUDE.md']) {
    const text = read(file);
    assert.ok(!/\b(millions|thousands) of (agents|customers|users|operators)\b/i.test(text), file);
    assert.ok(!/\btrusted by\b/i.test(text), file);
  }
});

test('CI runs lint and test with no install step', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.ok(ci.includes('actions/checkout@v4'));
  assert.ok(ci.includes('actions/setup-node@v4'));
  assert.ok(ci.includes("node-version: '22'") || ci.includes('node-version: 22'));
  assert.ok(ci.includes('npm run lint'));
  assert.ok(ci.includes('npm test'));
  assert.ok(!/npm (ci|install)\b/.test(ci), 'nothing to install');
});

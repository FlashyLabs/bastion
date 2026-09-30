// The README's institutional-front-door shape, held by a test — adapted from
// web4's readme.test.mjs for this property, a product rather than a spec. A reader
// arriving cold gets the mark beside the title, the "Where it sits in the stack"
// section the front door adds, the private-intended visibility, a dated status, and
// the Apache-2.0 licence line last. node: builtins only, no install.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');

const LICENCE_LINE = 'Licensed under Apache-2.0 (holder Flashy Labs); the estate register in flashyos `tools/estate-licences.mjs` is the authority.';

test('the H1 is the first line', () => {
  assert.ok(readme.startsWith('# Bastion'), 'the H1 must be the first line');
});

test('the bolt mark sits beside the H1 and is a file the brand manifest covers', () => {
  assert.match(readme, /<img src="brand\/assets\/bolt-gold\.svg" width="48" alt="">/);
  const manifest = readFileSync(join(ROOT, 'brand', 'MANIFEST.sha256'), 'utf8');
  assert.match(manifest, /assets\/bolt-gold\.svg$/m, 'the bolt the README shows is not in the brand manifest');
});

test('the README documents where the product sits in the stack', () => {
  assert.match(readme, /\n## Where it sits in the stack\n/);
  assert.ok(readme.includes('site.config.json'), 'the front-door section must name the config it is generated from');
  assert.ok(readme.includes('scripts/build-site.mjs'), 'the front-door section must name the generator');
});

test('the README carries the private-intended visibility and a dated status', () => {
  assert.ok(readme.includes('Visibility: private-intended'), 'a product-front-door README must state its intended visibility');
  assert.ok(readme.includes('Status: v0 skeleton, in design'), 'the v0 status must remain');
  assert.match(readme, /^Status:.*\b\d{4}-\d{2}-\d{2}\b/m, 'the status line must carry a measured date');
});

test('the Apache-2.0 licence line is the last line, exactly once', () => {
  assert.equal(readme.split(LICENCE_LINE).length - 1, 1, 'the licence line must appear exactly once');
  assert.equal(readme.trimEnd().split('\n').at(-1), LICENCE_LINE, 'the Apache-2.0 licence line must be the last line');
});

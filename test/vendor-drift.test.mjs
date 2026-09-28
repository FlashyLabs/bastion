// src/vendor-domain.mjs is a byte-identical copy of the canonical file in the
// agent-dns repository. When that repository is checked out beside this one,
// the copy is compared byte for byte; when it is not, the test reports
// UNKNOWN (skips) rather than passing — a comparison against nothing is not
// a pass, and this file never claims one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './fixtures.mjs';

const COPY = join(ROOT, 'src', 'vendor-domain.mjs');
const CANON = join(ROOT, '..', 'agent-dns', 'vendor-domain.mjs');

test('src/vendor-domain.mjs exists, imports nothing, and exports the three names the config validator relies on', () => {
  const src = readFileSync(COPY, 'utf8');
  assert.ok(!/^\s*import\b/m.test(src), 'the rule must stay import-free so it can live in a pure module');
  for (const name of ['normalizeDomain', 'isSameDomain', 'sameDomainUrl']) {
    assert.ok(src.includes(`export function ${name}(`), `exports ${name}`);
  }
});

test('src/vendor-domain.mjs is byte-identical to agent-dns/vendor-domain.mjs (unknown when no sibling checkout)', (t) => {
  if (!existsSync(CANON)) {
    t.skip(`unknown: ${CANON} is not checked out beside this repository — drift was not measured`);
    return;
  }
  assert.equal(readFileSync(COPY, 'utf8'), readFileSync(CANON, 'utf8'), 'src/vendor-domain.mjs has drifted from canon — re-vendor from agent-dns, never edit the copy');
});

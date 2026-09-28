// Shared fixtures. The example operator config is the canonical valid
// config; tests mutate a deep copy of it and never the file.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const EXAMPLE_PATH = join(ROOT, 'examples', 'operator.config.json');

export function exampleConfig() {
  return JSON.parse(readFileSync(EXAMPLE_PATH, 'utf8'));
}

export function fakeDeps() {
  const calls = [];
  return {
    calls,
    now: () => '2026-09-28T00:00:00.000Z',
    receiptSigner: (payload) => {
      calls.push(payload);
      return { alg: 'test-fake', value: `fake:${payload.length}` };
    },
  };
}

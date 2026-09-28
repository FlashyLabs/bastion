// The network edge, exercised over loopback on an OS-chosen port. This is the
// one suite that opens a socket; every behaviour it checks is the pure
// handler's, reached through node:http. It exists to prove the adapter wires
// method, path, headers, body and status through faithfully — not to re-test
// the handler.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

import { createServer, listen, defaultDeps, loadConfig, MAX_BODY_BYTES } from '../src/server.mjs';
import { deriveAgentDocument } from '../src/agent-doc.mjs';
import { exampleConfig, EXAMPLE_PATH } from './fixtures.mjs';

const config = exampleConfig();
const server = createServer(config);
const bound = await listen(server, { port: 0 });
const base = `http://${bound.host}:${bound.port}`;

after(() => bound.close());

test('loadConfig reads and validates the example', async () => {
  const loaded = await loadConfig(EXAMPLE_PATH);
  assert.equal(loaded.org, config.org);
});

test('createServer refuses an invalid config before listening', () => {
  const bad = exampleConfig();
  bad.origin = 'http://x.example';
  assert.throws(() => createServer(bad), /operator config refused/);
});

test('GET /.well-known/agent over loopback serves the derived document', async () => {
  const response = await fetch(`${base}/.well-known/agent`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(await response.json(), deriveAgentDocument(config));
});

test('an unknown path is 404 over loopback', async () => {
  const response = await fetch(`${base}/nowhere`);
  assert.equal(response.status, 404);
});

test('POST /capability/book over loopback is 501 with a receipt stub carrying an unkeyed digest', async () => {
  const response = await fetch(`${base}/capability/book`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quoteId: 'q-1' }),
  });
  assert.equal(response.status, 501);
  const body = await response.json();
  assert.equal(body.wouldProxyTo, 'https://origin.harbourlight.example/v1/bookings');
  assert.equal(body.receipt.signature.alg, 'sha256-digest-unsigned');
  assert.match(body.receipt.signature.value, /^[0-9a-f]{64}$/);
});

test('the default signer is a digest of the payload and is labelled as unsigned', () => {
  const deps = defaultDeps();
  const a = deps.receiptSigner('payload');
  const b = deps.receiptSigner('payload');
  assert.deepEqual(a, b);
  assert.equal(a.alg, 'sha256-digest-unsigned');
  assert.notEqual(deps.receiptSigner('other').value, a.value);
  assert.match(deps.now(), /^\d{4}-\d{2}-\d{2}T/);
});

test('a body over the cap is 413', async () => {
  const response = await fetch(`${base}/capability/quote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pad: 'x'.repeat(MAX_BODY_BYTES + 1) }),
  }).catch((error) => error);
  // Node may close the connection before the client has finished writing;
  // either a 413 or a reset connection is the server refusing the body.
  if (response instanceof Error) {
    assert.ok(response, 'connection refused mid-body');
  } else {
    assert.equal(response.status, 413);
  }
});

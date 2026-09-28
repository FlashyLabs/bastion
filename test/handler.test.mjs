import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handle, NotImplemented } from '../src/handler.mjs';
import { deriveAgentDocument } from '../src/agent-doc.mjs';
import { exampleConfig, fakeDeps } from './fixtures.mjs';

const config = exampleConfig();

function request(method, path, extra = {}) {
  return { method, path, headers: {}, body: undefined, ...extra };
}

function parse(response) {
  return JSON.parse(response.body);
}

test('GET /.well-known/agent serves the derived document as JSON', () => {
  const response = handle(request('GET', '/.well-known/agent'), config, fakeDeps());
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /^application\/json/);
  assert.deepEqual(parse(response), deriveAgentDocument(config));
});

test('HEAD /.well-known/agent answers with headers and no body', () => {
  const response = handle(request('HEAD', '/.well-known/agent'), config, fakeDeps());
  assert.equal(response.status, 200);
  assert.equal(response.body, '');
});

test('a query string does not change the route', () => {
  const response = handle(request('GET', '/.well-known/agent?foo=bar'), config, fakeDeps());
  assert.equal(response.status, 200);
});

test('POST /.well-known/agent is 405 with an Allow header', () => {
  const response = handle(request('POST', '/.well-known/agent'), config, fakeDeps());
  assert.equal(response.status, 405);
  assert.equal(response.headers.allow, 'GET, HEAD');
  assert.equal(parse(response).error, 'method_not_allowed');
});

test('an unknown path is 404 and points the agent at the well-known document', () => {
  for (const path of ['/', '/agent', '/.well-known/other', '/capabilities/quote']) {
    const response = handle(request('GET', path), config, fakeDeps());
    assert.equal(response.status, 404, path);
    assert.equal(parse(response).error, 'not_found');
    assert.match(parse(response).message, /\/\.well-known\/agent/);
  }
});

test('an unknown capability verb is 404', () => {
  for (const path of ['/capability/sales', '/capability/', '/capability/nope']) {
    const response = handle(request('POST', path), config, fakeDeps());
    assert.equal(response.status, 404, path);
    assert.equal(parse(response).error, 'unknown_capability');
  }
});

test('GET on a known capability is 405, POST only', () => {
  const response = handle(request('GET', '/capability/quote'), config, fakeDeps());
  assert.equal(response.status, 405);
  assert.equal(response.headers.allow, 'POST');
});

test('a malformed JSON body is 400 before any stage runs', () => {
  const deps = fakeDeps();
  const response = handle(request('POST', '/capability/quote', { body: '{not json' }), config, deps);
  assert.equal(response.status, 400);
  assert.equal(parse(response).error, 'malformed_body');
  assert.equal(deps.calls.length, 0, 'no receipt for a request that was never a call');
});

test('POST on a known capability is 501 NotImplemented and says where it would proxy', () => {
  const response = handle(request('POST', '/capability/book', { body: '{"quoteId":"q-1"}' }), config, fakeDeps());
  assert.equal(response.status, 501);
  const body = parse(response);
  assert.equal(body.error, 'not_implemented');
  assert.equal(body.verb, 'book');
  assert.equal(body.wouldProxyTo, 'https://origin.harbourlight.example/v1/bookings');
  assert.match(body.message, /not implemented in this skeleton/);
});

test('the 501 walks every stage and labels each honestly', () => {
  const body = parse(handle(request('POST', '/capability/track', { headers: { authorization: 'Delegation abc' } }), config, fakeDeps()));
  const byStage = Object.fromEntries(body.stages.map((s) => [s.stage, s]));
  assert.deepEqual(Object.keys(byStage), ['discover', 'authenticate', 'payment', 'proxy', 'receipt']);
  assert.equal(byStage.discover.status, 'implemented');
  assert.equal(byStage.authenticate.status, 'designed');
  assert.equal(byStage.authenticate.presented, true);
  assert.equal(byStage.authenticate.verified, false, 'v0 must never claim a chain was verified');
  assert.equal(byStage.payment.status, 'designed');
  assert.equal(byStage.payment.evaluated, false, 'v0 must never claim a policy was evaluated');
  assert.deepEqual(byStage.payment.price, { amount: 25, currency: 'GBP' });
  assert.equal(byStage.proxy.status, 'not_implemented');
  assert.equal(byStage.receipt.status, 'stub');
});

test('a receipt stub is present, signed by the injected signer, and says the call was not made', () => {
  const deps = fakeDeps();
  const body = parse(handle(request('POST', '/capability/quote'), config, deps));
  assert.equal(body.receipt.receipt, 'stub');
  assert.equal(body.receipt.org, 'org/harbourlight-freight');
  assert.equal(body.receipt.verb, 'quote');
  assert.equal(body.receipt.outcome, 'not_implemented');
  assert.equal(body.receipt.issuedAt, '2026-09-28T00:00:00.000Z');
  assert.equal(deps.calls.length, 1, 'exactly one receipt is signed per call');
  assert.deepEqual(body.receipt.signature, { alg: 'test-fake', value: `fake:${deps.calls[0].length}` });
  const signed = JSON.parse(deps.calls[0]);
  assert.equal(signed.signature, undefined, 'the signature is over the payload, not over itself');
});

test('the handler takes its clock and signer from deps and refuses to run without them', () => {
  assert.throws(() => handle(request('GET', '/.well-known/agent'), config, {}), TypeError);
  assert.throws(() => handle(request('GET', '/.well-known/agent'), config, undefined), TypeError);
});

test('a request with no method or path is 400, not a throw', () => {
  assert.equal(handle({}, config, fakeDeps()).status, 400);
  assert.equal(handle(null, config, fakeDeps()).status, 400);
});

test('NotImplemented is a named error with a stable code', () => {
  const error = new NotImplemented('proxy', 'would forward');
  assert.equal(error.name, 'NotImplemented');
  assert.equal(error.code, 'not_implemented');
  assert.equal(error.stage, 'proxy');
  assert.ok(error instanceof Error);
});

test('the handler is pure: same request, same deps, same bytes', () => {
  const a = handle(request('POST', '/capability/book'), config, fakeDeps());
  const b = handle(request('POST', '/capability/book'), config, fakeDeps());
  assert.deepEqual(a, b);
});

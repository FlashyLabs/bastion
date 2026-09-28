import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deriveAgentDocument, renderAgentDocument, AGENT_DOC_FORMAT } from '../src/agent-doc.mjs';
import { exampleConfig } from './fixtures.mjs';

const VERB = /^[a-z][a-z0-9-]{1,63}$/;

test('the derived document declares agent/1 and names the org and an accountable human', () => {
  const doc = deriveAgentDocument(exampleConfig());
  assert.equal(doc.agent, AGENT_DOC_FORMAT);
  assert.equal(doc.org, 'org/harbourlight-freight');
  assert.equal(typeof doc.accountable.name, 'string');
  assert.match(doc.accountable.contact, /^[^@\s?&,;]+@[^@\s?&,;]+$/);
});

test('every capability endpoint is https, on the edge, and named by a verb', () => {
  const config = exampleConfig();
  const doc = deriveAgentDocument(config);
  assert.equal(doc.capabilities.length, config.capabilities.length);
  for (const capability of doc.capabilities) {
    const url = new URL(capability.endpoint);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.origin, new URL(config.edge).origin);
    assert.match(capability.verb, VERB);
    assert.equal(url.pathname, `/capability/${capability.verb}`);
  }
});

test('every price is an integer in minor units with a currency code', () => {
  const doc = deriveAgentDocument(exampleConfig());
  for (const capability of doc.capabilities) {
    assert.ok(Number.isInteger(capability.price.amount), capability.verb);
    assert.ok(capability.price.amount >= 0);
    assert.match(capability.price.currency, /^[A-Z]{3}$/);
    assert.deepEqual(Object.keys(capability.price).sort(), ['amount', 'currency']);
  }
});

test('the document carries the auth and payment methods the config declares', () => {
  const doc = deriveAgentDocument(exampleConfig());
  assert.deepEqual(doc.auth, ['delegation/1']);
  assert.deepEqual(doc.payment, ['pay-policy/1']);
  assert.deepEqual(doc.receipts, { perAction: true });
});

test('the origin never appears in the derived document', () => {
  const config = exampleConfig();
  const text = renderAgentDocument(config);
  const originHost = new URL(config.origin).host;
  assert.ok(!text.includes(originHost), 'origin host leaked into the discovery document');
  assert.ok(!text.includes('/v1/'), 'origin path leaked into the discovery document');
  for (const capability of deriveAgentDocument(config).capabilities) {
    assert.deepEqual(Object.keys(capability).filter((k) => !k.startsWith('x-')).sort(), ['description', 'endpoint', 'method', 'price', 'verb']);
  }
});

test('the document says it is derived and from what', () => {
  const doc = deriveAgentDocument(exampleConfig());
  assert.deepEqual(doc.derived, { from: 'bastion-operator/1', by: '@flashylabs/bastion' });
});

test('derivation is deterministic: one config, byte-identical output', () => {
  assert.equal(renderAgentDocument(exampleConfig()), renderAgentDocument(exampleConfig()));
});

test('derivation refuses an invalid config rather than emitting a partial document', () => {
  const config = exampleConfig();
  config.capabilities[0].verb = 'marketing';
  assert.throws(() => deriveAgentDocument(config), /operator config refused/);
});

test('x- extensions travel through; unknown keys do not exist to travel', () => {
  const config = exampleConfig();
  config.capabilities[0]['x-region'] = 'north';
  const doc = deriveAgentDocument(config);
  assert.equal(doc.capabilities[0]['x-region'], 'north');
  assert.equal(typeof doc['x-note'], 'string');
});

test('a capability with no method is published as POST', () => {
  const config = exampleConfig();
  delete config.capabilities[0].method;
  assert.equal(deriveAgentDocument(config).capabilities[0].method, 'POST');
});

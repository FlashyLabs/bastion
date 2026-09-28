import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateConfig,
  assertConfig,
  DEPARTMENT_WORDS,
  originEndpoint,
  edgeEndpoint,
  findCapability,
} from '../src/config.mjs';
import { exampleConfig } from './fixtures.mjs';

test('the example operator config validates', () => {
  const result = validateConfig(exampleConfig());
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('a non-object is refused without throwing', () => {
  for (const bad of [null, undefined, 'config', 42, []]) {
    const result = validateConfig(bad);
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 1);
  }
});

test('a non-https origin is refused', () => {
  const config = exampleConfig();
  config.origin = 'http://origin.harbourlight.example';
  const result = validateConfig(config);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('origin must be an https URL')));
});

test('a non-https edge is refused', () => {
  const config = exampleConfig();
  config.edge = 'ftp://harbourlight.example';
  assert.ok(validateConfig(config).errors.some((e) => e.startsWith('edge must be an https URL')));
});

test('an origin carrying credentials is refused', () => {
  const config = exampleConfig();
  config.origin = 'https://user:pass@origin.harbourlight.example';
  assert.equal(validateConfig(config).valid, false);
});

test('a float price is refused; the unit is the minor integer', () => {
  const config = exampleConfig();
  config.capabilities[1].price.amount = 15.0 + 0.5;
  const result = validateConfig(config);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('capabilities[1].price.amount must be an integer in minor units')));
});

test('a string price is refused', () => {
  const config = exampleConfig();
  config.capabilities[0].price.amount = '0';
  assert.equal(validateConfig(config).valid, false);
});

test('a negative price is refused', () => {
  const config = exampleConfig();
  config.capabilities[0].price.amount = -1;
  assert.ok(validateConfig(config).errors.some((e) => e.includes('must not be negative')));
});

test('a lowercase currency is refused', () => {
  const config = exampleConfig();
  config.capabilities[0].price.currency = 'gbp';
  assert.ok(validateConfig(config).errors.some((e) => e.includes('three-letter uppercase currency code')));
});

test('a missing price is refused; free is stated as zero, not omitted', () => {
  const config = exampleConfig();
  delete config.capabilities[0].price;
  assert.ok(validateConfig(config).errors.some((e) => e.includes('capabilities[0].price is required')));
});

test('every department word is refused as a capability verb', () => {
  assert.equal(DEPARTMENT_WORDS.length, 8);
  for (const word of DEPARTMENT_WORDS) {
    const config = exampleConfig();
    config.capabilities[0].verb = word;
    const result = validateConfig(config);
    assert.equal(result.valid, false, `${word} should be refused`);
    assert.ok(result.errors.some((e) => e.includes(`"${word}" names a department`)), `${word}: ${result.errors}`);
  }
});

test('a verb must be a lowercase slug', () => {
  for (const bad of ['Quote', 'get quote', 'a', '', '-lead', 'quote!']) {
    const config = exampleConfig();
    config.capabilities[0].verb = bad;
    assert.equal(validateConfig(config).valid, false, JSON.stringify(bad));
  }
});

test('a duplicate verb is refused', () => {
  const config = exampleConfig();
  config.capabilities[1].verb = config.capabilities[0].verb;
  assert.ok(validateConfig(config).errors.some((e) => e.includes('declared more than once')));
});

test('a missing accountable human is refused', () => {
  const config = exampleConfig();
  delete config.accountable;
  const result = validateConfig(config);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('accountable is required')));
});

test('an accountable contact carrying mailto header separators is refused', () => {
  for (const bad of ['desk@host.example?bcc=someone@else.example', 'a@b.example&c=d', 'two@x.example,three@y.example', 'nobody']) {
    const config = exampleConfig();
    config.accountable.contact = bad;
    assert.equal(validateConfig(config).valid, false, bad);
  }
});

test('an unknown top-level key is refused unless x- prefixed', () => {
  const config = exampleConfig();
  config.pricing = {};
  const result = validateConfig(config);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('pricing is not a known key')));

  const extended = exampleConfig();
  extended['x-anything'] = { free: 'form' };
  assert.equal(validateConfig(extended).valid, true);
});

test('an unknown capability key is refused unless x- prefixed', () => {
  const config = exampleConfig();
  config.capabilities[0].cost = 5;
  assert.ok(validateConfig(config).errors.some((e) => e.includes('capabilities[0].cost is not a known key')));

  const extended = exampleConfig();
  extended.capabilities[0]['x-region'] = 'north';
  assert.equal(validateConfig(extended).valid, true);
});

test('unknown auth or payment methods are refused', () => {
  const config = exampleConfig();
  config.auth = ['api-key'];
  config.payment = ['card'];
  const result = validateConfig(config);
  assert.ok(result.errors.some((e) => e.startsWith('auth contains unknown method')));
  assert.ok(result.errors.some((e) => e.startsWith('payment contains unknown method')));
});

test('an empty capability list is refused: a gateway with nothing to call is invisible', () => {
  const config = exampleConfig();
  config.capabilities = [];
  assert.ok(validateConfig(config).errors.some((e) => e.startsWith('capabilities must be a non-empty array')));
});

test('an endpoint is a path on the origin or an https URL on the origin\'s domain — nothing else', () => {
  const config = exampleConfig();
  config.capabilities[0].endpoint = '//elsewhere.example/v1/quotes';
  assert.ok(validateConfig(config).errors.some((e) => e.includes('capabilities[0].endpoint must be a path')));
  for (const bad of ['v1/quotes', '', 42, 'http://origin.harbourlight.example/v1/quotes', 'https://user:pw@origin.harbourlight.example/v1/quotes']) {
    const c = exampleConfig();
    c.capabilities[0].endpoint = bad;
    const result = validateConfig(c);
    assert.equal(result.valid, false, JSON.stringify(bad));
    assert.ok(result.errors.some((e) => e.includes('capabilities[0].endpoint must be a path')), JSON.stringify(bad));
  }
});

test('an absolute endpoint on the origin host or a subdomain of it is valid, and resolves as written', () => {
  const same = exampleConfig();
  same.capabilities[0].endpoint = 'https://origin.harbourlight.example/v1/quotes';
  assert.deepEqual(validateConfig(same), { valid: true, errors: [] });

  const sub = exampleConfig();
  sub.capabilities[0].endpoint = 'https://eu.origin.harbourlight.example/v1/quotes';
  assert.deepEqual(validateConfig(sub), { valid: true, errors: [] });
  assert.equal(originEndpoint(sub, sub.capabilities[0]), 'https://eu.origin.harbourlight.example/v1/quotes');

  const cased = exampleConfig();
  cased.capabilities[0].endpoint = 'https://EU.Origin.Harbourlight.example./v1/quotes';
  assert.equal(validateConfig(cased).valid, true);
});

test('an endpoint on another domain, on the origin\'s parent, or on a sibling is refused as endpoint-cross-domain', () => {
  for (const bad of [
    'https://elsewhere.example/v1/quotes', // a stranger
    'https://harbourlight.example/v1/quotes', // the parent — the edge host, which is not the origin
    'https://api.harbourlight.example/v1/quotes', // a sibling of the origin
    'https://origin.harbourlight.example.evil.example/v1/quotes', // a lookalike
    'https://notorigin.harbourlight.example/v1/quotes', // a suffix match that is not a label match
  ]) {
    const config = exampleConfig();
    config.capabilities[0].endpoint = bad;
    const result = validateConfig(config);
    assert.equal(result.valid, false, bad);
    const error = result.errors.find((e) => e.includes('endpoint-cross-domain'));
    assert.ok(error, `${bad}: ${result.errors}`);
    assert.ok(error.startsWith('capabilities[0].endpoint is on'), error);
  }
});

test('a cross-domain endpoint is not reported when the origin itself is already refused — one fault, one message', () => {
  const config = exampleConfig();
  config.origin = 'http://origin.harbourlight.example';
  config.capabilities[0].endpoint = 'https://elsewhere.example/v1/quotes';
  const result = validateConfig(config);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('origin must be an https URL')));
  assert.ok(!result.errors.some((e) => e.includes('endpoint-cross-domain')));
});

test('policies are checked and receipts cannot be switched off', () => {
  const config = exampleConfig();
  config.policies.receipts.perAction = false;
  assert.ok(validateConfig(config).errors.some((e) => e.includes('perAction must be true')));

  const depth = exampleConfig();
  depth.policies.delegation.maxDepth = 0;
  assert.ok(validateConfig(depth).errors.some((e) => e.includes('maxDepth')));

  const mode = exampleConfig();
  mode.policies.payment.mode = 'maybe';
  assert.ok(validateConfig(mode).errors.some((e) => e.includes('payment.mode')));
});

test('every error is reported at once, not the first one found', () => {
  const config = exampleConfig();
  config.origin = 'http://x.example';
  delete config.accountable;
  config.capabilities[0].verb = 'sales';
  const result = validateConfig(config);
  assert.ok(result.errors.length >= 3, result.errors.join('\n'));
});

test('assertConfig throws one error carrying every message', () => {
  const config = exampleConfig();
  config.origin = 'http://x.example';
  config.capabilities[0].verb = 'hr';
  assert.throws(() => assertConfig(config), (error) => error.code === 'invalid_config' && error.errors.length === 2);
  assert.equal(assertConfig(exampleConfig()).org, 'org/harbourlight-freight');
});

test('origin and edge endpoints resolve to different hosts for one capability', () => {
  const config = exampleConfig();
  const capability = findCapability(config, 'book');
  assert.equal(originEndpoint(config, capability), 'https://origin.harbourlight.example/v1/bookings');
  assert.equal(edgeEndpoint(config, capability), 'https://harbourlight.example/capability/book');
  assert.equal(findCapability(config, 'sales'), undefined);
});

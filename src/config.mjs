// Bastion operator config — the one input everything else is derived from.
//
// An operator hands Bastion this shape and never hand-writes a discovery
// document, a route table or a price list anywhere else: `agent-doc.mjs`
// derives the `agent/1` document from it and `handler.mjs` routes from it.
// The parser refuses; it does not guess. A config that fails validation is
// not served in any degraded form.
//
// Pure: no I/O, no `node:` imports, no network. The one import is the
// same-domain rule, `./vendor-domain.mjs` — canonical in the agent-dns
// repository, vendored here byte-identically (test/vendor-drift.test.mjs),
// and itself import-free.

import { isSameDomain } from './vendor-domain.mjs';

export const CONFIG_FORMAT = 'bastion-operator/1';

// Words that name a department rather than an action. A capability is a verb
// an agent can invoke — `quote`, `book`, `lookup` — not a team it might email.
// Publishing `sales` as a capability is publishing an org chart, and an agent
// that reads it learns nothing it can call.
export const DEPARTMENT_WORDS = Object.freeze([
  'sales',
  'marketing',
  'engineering',
  'operations',
  'support',
  'finance',
  'legal',
  'hr',
]);

const TOP_LEVEL_KEYS = Object.freeze([
  'format',
  'org',
  'edge',
  'origin',
  'accountable',
  'auth',
  'payment',
  'capabilities',
  'policies',
]);

const ACCOUNTABLE_KEYS = Object.freeze(['name', 'contact']);
const CAPABILITY_KEYS = Object.freeze(['verb', 'endpoint', 'method', 'price', 'description']);
const PRICE_KEYS = Object.freeze(['amount', 'currency']);
const POLICY_KEYS = Object.freeze(['payment', 'delegation', 'receipts']);

// The methods and money rails this skeleton knows how to name. Each is an
// open sibling specification, referenced by name and not redefined here.
export const KNOWN_AUTH_METHODS = Object.freeze(['delegation/1']);
export const KNOWN_PAYMENT_METHODS = Object.freeze(['pay-policy/1']);

const VERB_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const ORG_PATTERN = /^org\/[a-z0-9][a-z0-9-]*$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const HTTP_METHODS = Object.freeze(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isExtension(key) {
  return typeof key === 'string' && key.startsWith('x-');
}

function unknownKeys(object, allowed) {
  return Object.keys(object).filter((key) => !allowed.includes(key) && !isExtension(key));
}

function httpsUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  return url;
}

// A contact must be one addressable human: a mailto-safe address with no
// header separators. `desk@host.org?bcc=someone@else.example` is a second
// recipient smuggled into a field whose whole promise is one named person.
function isContact(value) {
  if (typeof value !== 'string') return false;
  if (/[?&#\s,;<>]/.test(value)) return false;
  const at = value.indexOf('@');
  return at > 0 && at < value.length - 1 && value.indexOf('@', at + 1) === -1;
}

function validatePrice(price, where, errors) {
  if (!isPlainObject(price)) {
    errors.push(`${where}.price must be an object {amount, currency}`);
    return;
  }
  for (const key of unknownKeys(price, PRICE_KEYS)) {
    errors.push(`${where}.price.${key} is not a known key (prefix extensions with x-)`);
  }
  const { amount, currency } = price;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || !Number.isSafeInteger(amount)) {
    errors.push(`${where}.price.amount must be an integer in minor units (got ${JSON.stringify(amount)})`);
  } else if (amount < 0) {
    errors.push(`${where}.price.amount must not be negative`);
  }
  if (typeof currency !== 'string' || !CURRENCY_PATTERN.test(currency)) {
    errors.push(`${where}.price.currency must be a three-letter uppercase currency code`);
  }
}

// An endpoint is where Bastion forwards a capability call. Two shapes are
// accepted: a path (`/v1/quotes`), resolved against `origin`; or an absolute
// https URL whose host is the origin's host or a subdomain of it. Anything
// else is `endpoint-cross-domain`: a gateway that forwards to a host the
// operator does not control is a gateway to somebody else's API, and the
// same-domain rule (`isSameDomain`, vendored from agent-dns) is the one rule
// the whole neighbourhood uses to decide that — a subdomain, never a parent,
// a sibling or a "registrable domain" guess.
function validateEndpoint(endpoint, where, originHost, errors) {
  if (typeof endpoint !== 'string' || endpoint.length === 0) {
    errors.push(`${where}.endpoint must be a path on the origin starting with "/", or an https URL on the origin's domain`);
    return;
  }
  if (endpoint.startsWith('/') && !endpoint.startsWith('//')) return; // a path: always on the origin
  const url = httpsUrl(endpoint);
  if (!url) {
    errors.push(`${where}.endpoint must be a path on the origin starting with "/", or an https URL with no credentials on the origin's domain`);
    return;
  }
  if (originHost && !isSameDomain(url.hostname, originHost)) {
    errors.push(`${where}.endpoint is on ${url.hostname}, which is not ${originHost} or a subdomain of it (endpoint-cross-domain)`);
  }
}

function validateCapability(capability, index, seen, originHost, errors) {
  const where = `capabilities[${index}]`;
  if (!isPlainObject(capability)) {
    errors.push(`${where} must be an object`);
    return;
  }
  for (const key of unknownKeys(capability, CAPABILITY_KEYS)) {
    errors.push(`${where}.${key} is not a known key (prefix extensions with x-)`);
  }
  const { verb, endpoint, method, price, description } = capability;

  if (typeof verb !== 'string' || !VERB_PATTERN.test(verb)) {
    errors.push(`${where}.verb must be a lowercase verb slug (got ${JSON.stringify(verb)})`);
  } else if (DEPARTMENT_WORDS.includes(verb)) {
    errors.push(`${where}.verb "${verb}" names a department, not an action an agent can invoke`);
  } else if (seen.has(verb)) {
    errors.push(`${where}.verb "${verb}" is declared more than once`);
  } else {
    seen.add(verb);
  }

  validateEndpoint(endpoint, where, originHost, errors);

  if (method !== undefined && !HTTP_METHODS.includes(method)) {
    errors.push(`${where}.method must be one of ${HTTP_METHODS.join(', ')}`);
  }

  if (price === undefined) {
    errors.push(`${where}.price is required (use {amount: 0, currency} for a free capability)`);
  } else {
    validatePrice(price, where, errors);
  }

  if (description !== undefined && (typeof description !== 'string' || description.trim() === '')) {
    errors.push(`${where}.description must be a non-empty string when present`);
  }
}

function validateMethodList(list, known, field, errors) {
  if (!Array.isArray(list) || list.length === 0) {
    errors.push(`${field} must be a non-empty array`);
    return;
  }
  for (const item of list) {
    if (!known.includes(item)) {
      errors.push(`${field} contains unknown method ${JSON.stringify(item)} (known: ${known.join(', ')})`);
    }
  }
}

function validatePolicies(policies, errors) {
  if (policies === undefined) return;
  if (!isPlainObject(policies)) {
    errors.push('policies must be an object');
    return;
  }
  for (const key of unknownKeys(policies, POLICY_KEYS)) {
    errors.push(`policies.${key} is not a known key (prefix extensions with x-)`);
  }
  if (policies.payment !== undefined) {
    if (!isPlainObject(policies.payment) || !['per-call', 'free'].includes(policies.payment.mode)) {
      errors.push('policies.payment.mode must be "per-call" or "free"');
    }
  }
  if (policies.delegation !== undefined) {
    const depth = isPlainObject(policies.delegation) ? policies.delegation.maxDepth : undefined;
    if (!Number.isInteger(depth) || depth < 1) {
      errors.push('policies.delegation.maxDepth must be an integer >= 1');
    }
  }
  if (policies.receipts !== undefined) {
    if (!isPlainObject(policies.receipts) || policies.receipts.perAction !== true) {
      errors.push('policies.receipts.perAction must be true — a receipt per action is not optional');
    }
  }
}

/**
 * validateConfig(config) → { valid, errors }
 *
 * Every error is a sentence naming the field. `valid` is true only when
 * `errors` is empty. The function never throws on bad input.
 */
export function validateConfig(config) {
  const errors = [];

  if (!isPlainObject(config)) {
    return { valid: false, errors: ['config must be an object'] };
  }

  for (const key of unknownKeys(config, TOP_LEVEL_KEYS)) {
    errors.push(`${key} is not a known key (prefix extensions with x-)`);
  }

  if (config.format !== CONFIG_FORMAT) {
    errors.push(`format must be "${CONFIG_FORMAT}"`);
  }

  if (typeof config.org !== 'string' || !ORG_PATTERN.test(config.org)) {
    errors.push('org must be an identifier of the form org/<slug>');
  }

  const edge = httpsUrl(config.edge);
  if (!edge) {
    errors.push('edge must be an https URL with no credentials (the public host Bastion answers on)');
  }

  const origin = httpsUrl(config.origin);
  if (!origin) {
    errors.push('origin must be an https URL with no credentials (the operator endpoint Bastion proxies to)');
  }

  if (!isPlainObject(config.accountable)) {
    errors.push('accountable is required: one named human with a contact address');
  } else {
    for (const key of unknownKeys(config.accountable, ACCOUNTABLE_KEYS)) {
      errors.push(`accountable.${key} is not a known key (prefix extensions with x-)`);
    }
    if (typeof config.accountable.name !== 'string' || config.accountable.name.trim() === '') {
      errors.push('accountable.name must be a non-empty string');
    }
    if (!isContact(config.accountable.contact)) {
      errors.push('accountable.contact must be a single address with no mailto header separators');
    }
  }

  validateMethodList(config.auth, KNOWN_AUTH_METHODS, 'auth', errors);
  validateMethodList(config.payment, KNOWN_PAYMENT_METHODS, 'payment', errors);

  if (!Array.isArray(config.capabilities) || config.capabilities.length === 0) {
    errors.push('capabilities must be a non-empty array — a gateway with nothing to call is invisible');
  } else {
    const seen = new Set();
    const originHost = origin ? origin.hostname : null;
    config.capabilities.forEach((capability, index) => validateCapability(capability, index, seen, originHost, errors));
  }

  validatePolicies(config.policies, errors);

  return { valid: errors.length === 0, errors };
}

/**
 * assertConfig(config) → config
 *
 * Throws a single Error carrying every validation message. Used at the edges
 * (server start) where a bad config must stop the process.
 */
export function assertConfig(config) {
  const { valid, errors } = validateConfig(config);
  if (!valid) {
    const error = new Error(`operator config refused:\n  - ${errors.join('\n  - ')}`);
    error.code = 'invalid_config';
    error.errors = errors;
    throw error;
  }
  return config;
}

/**
 * findCapability(config, verb) → capability | undefined
 */
export function findCapability(config, verb) {
  return config.capabilities.find((capability) => capability.verb === verb);
}

/**
 * originEndpoint(config, capability) → absolute https URL on the origin's
 * domain: a path resolves against `origin`; an absolute endpoint (already
 * checked to be the origin host or a subdomain of it) is returned as is.
 * Private to the operator: this is what Bastion would proxy to, and it is
 * never placed in the derived discovery document.
 */
export function originEndpoint(config, capability) {
  return new URL(capability.endpoint, config.origin).href;
}

/**
 * edgeEndpoint(config, capability) → absolute https URL on the edge.
 * Public: this is what an agent is told to call.
 */
export function edgeEndpoint(config, capability) {
  return new URL(`/capability/${capability.verb}`, config.edge).href;
}

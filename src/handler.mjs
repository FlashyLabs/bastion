// The pure request handler. Everything the edge does that can be tested
// without a socket lives here.
//
//   handle(request, config, deps) → response
//
//   request  = { method, path, headers, body }   (body: string | undefined)
//   config   = a validated operator config (see config.mjs)
//   deps     = { now, receiptSigner }            (injected; nothing here reads a clock or a key)
//   response = { status, headers, body }         (body: string)
//
// The five-stage request path (ARCHITECTURE.md) is walked in order and every
// stage records what it did in `stages`, so a response says which parts of
// the path are real in this skeleton and which are designed only. Stage 4,
// the upstream proxy, is NotImplemented in v0 and says so with a 501 —
// rather than a 200 that pretends a call was made.
//
// No `node:` imports. No network. No I/O.

import { findCapability, originEndpoint } from './config.mjs';
import { renderAgentDocument, WELL_KNOWN_PATH } from './agent-doc.mjs';

const CAPABILITY_PREFIX = '/capability/';
const JSON_HEADERS = Object.freeze({ 'content-type': 'application/json; charset=utf-8' });

/**
 * Thrown by the stage of the request path that v0 does not implement.
 * The handler catches it and renders a 501; nothing else should catch it.
 */
export class NotImplemented extends Error {
  constructor(stage, detail) {
    super(`${stage} is not implemented in this skeleton: ${detail}`);
    this.name = 'NotImplemented';
    this.code = 'not_implemented';
    this.stage = stage;
  }
}

function json(status, body, extraHeaders = {}) {
  return {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
    body: `${JSON.stringify(body, null, 2)}\n`,
  };
}

function problem(status, code, message, extra = {}, extraHeaders = {}) {
  return json(status, { error: code, message, ...extra }, extraHeaders);
}

function methodNotAllowed(allowed) {
  return problem(405, 'method_not_allowed', `allowed: ${allowed.join(', ')}`, { allowed }, { allow: allowed.join(', ') });
}

function assertDeps(deps) {
  if (!deps || typeof deps.now !== 'function' || typeof deps.receiptSigner !== 'function') {
    throw new TypeError('handle() needs deps = { now(): ISO string, receiptSigner(payload): { alg, value } }');
  }
}

// Stage 2 — designed only. A `delegation/1` chain would be read from the
// request here and verified back to a root the operator trusts. In v0 the
// stage reports what it saw and verifies nothing, and says so.
function authenticate(request) {
  const header = request.headers?.authorization;
  return {
    stage: 'authenticate',
    status: 'designed',
    method: 'delegation/1',
    presented: typeof header === 'string' && header.length > 0,
    verified: false,
    note: 'v0 verifies no chain; the stage records whether a credential was presented and nothing else',
  };
}

// Stage 3 — designed only. A `pay-policy/1` evaluation would settle whether
// the caller may be charged the capability's price before the call is made.
function evaluatePayment(capability, config) {
  const mode = config.policies?.payment?.mode ?? 'per-call';
  return {
    stage: 'payment',
    status: 'designed',
    method: 'pay-policy/1',
    mode,
    price: { amount: capability.price.amount, currency: capability.price.currency },
    evaluated: false,
    note: 'v0 charges nothing and evaluates no policy; the price is what the derived document publishes',
  };
}

// Stage 4 — NotImplemented in v0. The one place the product would touch an
// operator's origin, and the one place this file refuses to pretend.
function proxyToOrigin(config, capability) {
  const target = originEndpoint(config, capability);
  throw new NotImplemented('proxy', `would forward to ${target}`);
}

// Stage 5 — a receipt stub. Real in shape, honest in content: `outcome`
// says the call was not made, and `signature` is whatever the injected
// signer produced (in v0's server that is an unkeyed digest, labelled as such).
function receipt(deps, config, capability, outcome) {
  const issuedAt = deps.now();
  const payload = {
    receipt: 'stub',
    org: config.org,
    verb: capability.verb,
    price: { amount: capability.price.amount, currency: capability.price.currency },
    outcome,
    issuedAt,
  };
  const signature = deps.receiptSigner(JSON.stringify(payload));
  return { ...payload, signature };
}

function handleWellKnown(request, config) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed(['GET', 'HEAD']);
  const body = renderAgentDocument(config);
  return {
    status: 200,
    headers: { ...JSON_HEADERS, 'cache-control': 'public, max-age=300' },
    body: request.method === 'HEAD' ? '' : body,
  };
}

function handleCapability(request, config, deps) {
  const verb = request.path.slice(CAPABILITY_PREFIX.length);
  const capability = verb ? findCapability(config, verb) : undefined;
  if (!capability) return problem(404, 'unknown_capability', `no capability "${verb}" — read ${WELL_KNOWN_PATH}`);
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  if (request.body !== undefined && request.body !== '') {
    try {
      JSON.parse(request.body);
    } catch {
      return problem(400, 'malformed_body', 'request body must be JSON when present');
    }
  }

  const stages = [
    { stage: 'discover', status: 'implemented', document: WELL_KNOWN_PATH },
    authenticate(request),
    evaluatePayment(capability, config),
  ];

  try {
    proxyToOrigin(config, capability);
  } catch (error) {
    if (!(error instanceof NotImplemented)) throw error;
    const target = originEndpoint(config, capability);
    stages.push({ stage: 'proxy', status: 'not_implemented', wouldProxyTo: target, method: capability.method ?? 'POST' });
    const stub = receipt(deps, config, capability, 'not_implemented');
    stages.push({ stage: 'receipt', status: 'stub', signature: stub.signature.alg });
    return json(501, {
      error: 'not_implemented',
      message: error.message,
      verb: capability.verb,
      wouldProxyTo: target,
      stages,
      receipt: stub,
    });
  }

  // Unreachable in v0: proxyToOrigin always throws. Kept so the shape of a
  // completed call is written down where the proxy will land.
  throw new Error('unreachable: proxyToOrigin returned in a skeleton that cannot proxy');
}

/**
 * handle(request, config, deps) → response
 */
export function handle(request, config, deps) {
  assertDeps(deps);
  if (!request || typeof request.method !== 'string' || typeof request.path !== 'string') {
    return problem(400, 'bad_request', 'request must carry a method and a path');
  }

  const path = request.path.split('?')[0];
  const normalised = { ...request, method: request.method.toUpperCase(), path, headers: request.headers ?? {} };

  if (path === WELL_KNOWN_PATH) return handleWellKnown(normalised, config);
  if (path.startsWith(CAPABILITY_PREFIX)) return handleCapability(normalised, config, deps);

  return problem(404, 'not_found', `no such path — agents start at ${WELL_KNOWN_PATH}`);
}

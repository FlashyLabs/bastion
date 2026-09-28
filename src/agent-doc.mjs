// Derive the `agent/1` discovery document from a validated operator config.
//
// This is the "derived, never hand-written" surface. The operator edits the
// config; Bastion computes what `/.well-known/agent` says. Two documents
// describing what an org does are two documents that will disagree, and the
// one a stranger reads is not the one anybody edits.
//
// `agent/1` is the open, vendor-neutral discovery document specified in the
// sibling `agent-wellknown` repository. This file emits it and does not
// redefine it: the field names below are the ones that spec owns, and the
// rules this file's tests hold (https endpoints, verb capabilities, minor
// units) are the ones this skeleton can check without the spec's own
// validator.
//
// Pure: no I/O, no `node:` imports, no network.

import { assertConfig, edgeEndpoint } from './config.mjs';

export const AGENT_DOC_FORMAT = 'agent/1';
export const WELL_KNOWN_PATH = '/.well-known/agent';

function extensions(object) {
  const out = {};
  for (const [key, value] of Object.entries(object)) {
    if (key.startsWith('x-')) out[key] = value;
  }
  return out;
}

/**
 * deriveAgentDocument(config) → agent/1 document (plain object)
 *
 * Refuses an invalid config by throwing — a discovery document derived from
 * a config that did not validate would be a claim nothing checked.
 *
 * What is deliberately NOT in the output: `origin` and every capability's
 * origin `endpoint`. The agent is told the edge URL it may call; where
 * Bastion forwards that call is the operator's business.
 */
export function deriveAgentDocument(config) {
  assertConfig(config);

  const capabilities = config.capabilities.map((capability) => ({
    verb: capability.verb,
    endpoint: edgeEndpoint(config, capability),
    method: capability.method ?? 'POST',
    price: { amount: capability.price.amount, currency: capability.price.currency },
    ...(capability.description ? { description: capability.description } : {}),
    ...extensions(capability),
  }));

  return {
    agent: AGENT_DOC_FORMAT,
    org: config.org,
    accountable: {
      name: config.accountable.name,
      contact: config.accountable.contact,
    },
    auth: [...config.auth],
    payment: [...config.payment],
    capabilities,
    receipts: { perAction: true },
    derived: {
      from: config.format,
      by: '@flashylabs/bastion',
    },
    ...extensions(config),
  };
}

/**
 * renderAgentDocument(config) → the JSON bytes the well-known path serves.
 * Stable key order comes from construction order above; two derivations of
 * one config are byte-identical.
 */
export function renderAgentDocument(config) {
  return `${JSON.stringify(deriveAgentDocument(config), null, 2)}\n`;
}

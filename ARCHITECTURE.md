# Architecture — the request path

Status: v0 skeleton, in design. This document describes five stages; one is
built, three are designed, one is a stub. The table at the end says which.

## The picture

```
agent ──HTTPS──▶ Bastion edge (company.com)
                  │
                  ├─ (1) GET /.well-known/agent
                  │       serve the agent/1 document DERIVED from operator config
                  │
                  └─ POST /capability/<verb>
                          (2) authenticate the caller's delegation/1 chain
                          (3) evaluate the pay-policy/1 payment policy
                          (4) proxy the call to the operator's origin endpoint
                          (5) emit a signed receipt, return the origin's answer
                                     │
                                     ▼
                       operator origin (origin.company.example/v1/…)
                       — private; never named in the discovery document
```

A human visiting `company.com` sees the site they always saw. An agent
visiting the same host finds one document that tells it what it may call,
how to prove who it is acting for, what each call costs, and that every call
will be receipted.

## Inputs

One file: the operator config (`src/config.mjs`, format
`bastion-operator/1`). It holds the public `edge` host, the private `origin`
host, the org identifier, one accountable human with a contact address, the
accepted auth methods (`delegation/1`) and payment methods (`pay-policy/1`),
the capabilities — a verb, an origin endpoint (a path on `origin`, or an
https URL on the origin's host or a subdomain of it — never another domain,
under the same-domain rule vendored in `src/vendor-domain.mjs`), a method, a
price in integer minor units with a currency — and policies. It is validated,
and a config that fails validation is not served in any form.

Everything an agent is shown is derived from this file. Nothing an agent is
shown is written by hand.

## The five stages

### 1. Resolve and serve `/.well-known/agent` — implemented

`deriveAgentDocument(config)` in `src/agent-doc.mjs` computes the `agent/1`
document: org, accountable human, auth and payment methods, capabilities with
`https://<edge>/capability/<verb>` endpoints and their prices, and a
`receipts.perAction: true` declaration. The origin host and every origin
path are absent by construction and by test. The handler serves the
rendered bytes at `GET /.well-known/agent` with a short public cache header;
`HEAD` is honoured; any other method is 405 with `Allow`.

`agent/1` itself is the sibling `agent-wellknown` specification. This file
emits it and does not redefine it. The structural rules the tests hold —
https endpoints, verb capabilities, minor units — are the subset of that
spec this skeleton can check without vendoring its validator, which is the
right next step once the spec publishes one.

### 2. Authenticate the caller's delegation chain — designed only

The caller presents a `delegation/1` chain: a root authority (a person or
org the operator trusts) delegating, through zero or more attenuating hops,
to the agent making the call. Bastion verifies every hop's signature, that
each hop's scope is a subset of its parent's (delegation is attenuation,
never inheritance), that the chain's depth is within
`policies.delegation.maxDepth`, and that the leaf is the caller. A chain
that fails any check is refused with a reason; a refused chain reaches no
later stage.

In v0 the stage records whether an `authorization` header was presented and
verifies nothing. The response body says `verified: false`. No code path
here may say otherwise until a verifier and its tests land.

### 3. Evaluate the payment policy — designed only

Each capability carries a price. `pay-policy/1` decides, before the call is
made, whether the caller may be charged that price: a free capability
passes; a priced one needs a payment authorisation the policy recognises,
bound to the caller the chain identified in stage 2 and to at most the
published amount. Bastion never prices a call itself: the price is what the
derived document published, and an agent that read the document knows what
it agreed to before it called.

In v0 the stage reports the published price and evaluates nothing. The
response body says `evaluated: false`. Nothing is charged.

### 4. Proxy the capability call to the origin — not implemented

The one place Bastion touches the operator's own systems. The design: map
`/capability/<verb>` to the configured origin path, forward the method and
JSON body over https with the verified caller identity and the payment
authorisation attached as headers the origin can trust because only Bastion
can reach it, apply a timeout and a body cap in both directions, and return
the origin's status and body.

In v0 `proxyToOrigin` throws `NotImplemented`. The handler renders that as
`501 Not Implemented` carrying `wouldProxyTo: <origin endpoint>`, the walked
stages, and a receipt stub. A 200 from a gateway that made no call would be
a fabricated receipt, so the skeleton refuses.

### 5. Emit a signed receipt — stub

Every capability call ends in a receipt: org, verb, price, outcome, issued
time, and a signature the operator or the agent can later verify against a
key Bastion publishes. Receipts are the audit trail the pitch rests on; the
config validator refuses a policy that turns them off.

In v0 the receipt has that shape and honest content: `outcome` is
`not_implemented`, and the signature is whatever the injected signer
produces. The server's default signer is an **unkeyed sha256 digest**,
labelled `sha256-digest-unsigned` so nobody reads it as a signature. It
proves the receipt's bytes have not changed since rendering; it proves
nothing about who rendered them. Key management, the verification endpoint
and the receipt's own format are the design work stage 5 still owes.

## Pure seams and network edges

| Piece | Kind | Touches |
|---|---|---|
| `src/config.mjs` — validate, resolve endpoints | pure | its arguments |
| `src/agent-doc.mjs` — derive the discovery document | pure | its arguments |
| `src/handler.mjs` — `handle(request, config, deps)` | pure | its arguments; `deps.now()` and `deps.receiptSigner()` are injected |
| `src/server.mjs` — `node:http` adapter, config loader, default deps | edge | socket, filesystem, clock, `node:crypto` |
| stage 4 proxy (future) | edge | the operator's origin over https |

The rule: a request's whole treatment is decided in the pure handler, with a
plain `{method, path, headers, body}` in and a plain `{status, headers,
body}` out, so every flow is walked by a test with no socket. The edge
translates between Node's request objects and those plain shapes and does
nothing else. When the proxy is built it sits behind `deps` too — the
handler asks for a `deps.forward(target, request)` and a test hands it a
fake — so the handler stays pure and the 501 path becomes the path taken
when no forwarder is injected.

## What is implemented in this skeleton vs designed only

| | Implemented | Designed only |
|---|---|---|
| Operator config validation | yes, `test/config.test.mjs` | |
| `agent/1` derivation and serving | yes, `test/agent-doc.test.mjs`, `test/handler.test.mjs` | validation against the spec's own checker |
| Routing: 200 / 404 / 405 / 400 / 501 | yes, `test/handler.test.mjs` | |
| `node:http` adapter, body cap, loopback | yes, `test/server.test.mjs` | TLS termination, real host binding, health endpoint |
| `delegation/1` verification | | whole stage |
| `pay-policy/1` evaluation | | whole stage |
| Upstream proxy | `NotImplemented` path, tested | whole stage |
| Signed receipts | stub with unkeyed digest, tested | keys, publication, verification, format |
| Multi-tenant config (many operators, one edge) | | whole concern |
| Rate limits, abuse controls, observability | | whole concern |

Nothing above the line claims more than a test asserts. Nothing below it is
running anywhere.

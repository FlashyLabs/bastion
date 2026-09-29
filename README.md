# Bastion

<img src="brand/assets/bolt-gold.svg" width="48" alt="">

Bastion is a commercial gateway that puts a secure, authenticated, discoverable, payable machine interface in front of an existing website or API, for operators who want agents to be able to use their business without rewriting it.

Give Bastion your existing company — its site, its API, the human who is
accountable for it — and it exposes the machine interface agents need, in
front of what you already run. A human keeps seeing `company.com`. An agent
gets `company.com/.well-known/agent` (the open `agent/1` discovery document),
authenticates with a delegated-authority chain (`delegation/1`), is gated by
a payment policy (`pay-policy/1`), and every action leaves a receipt for
audit. The name is the networking term: a bastion host is the hardened
single entry point through which you reach a protected network. Cloudflare
sits in front of your site for human traffic; Bastion is that position for
agent traffic.

**Visibility: private-intended.** This is a commercial product, not a
protocol; the protocols it implements are the open specs it links to below.
The repository is meant to stay private. Nothing in it is a standard, and
nothing a standard needs lives here.

**Status: v0 skeleton, in design.** Read "Implemented and designed" before
believing any sentence above of the code.

## Quick start

```bash
npm test
node -e 'import("./src/agent-doc.mjs").then(async m => console.log(m.renderAgentDocument(JSON.parse((await import("node:fs")).readFileSync("examples/operator.config.json","utf8")))))'
npm start   # then: curl -s http://127.0.0.1:8787/.well-known/agent
```

The second command prints the `agent/1` document derived from the fictional
example operator. The third serves it, and answers a
`POST /capability/book` with a `501 Not Implemented` that names the origin
endpoint it would have proxied to, walks the five stages of the request
path labelling each as implemented, designed or not implemented, and
attaches a receipt stub. No install; Node 22; `node:` builtins only.

## What makes it different

- **The discovery document is derived, never hand-written.** An operator
  edits one validated config (`src/config.mjs`). `/.well-known/agent` is
  computed from it (`src/agent-doc.mjs`) — two documents describing what an
  org does are two documents that will disagree, and the one a stranger
  reads is not the one anybody edits. The origin endpoints never appear in
  the derived document; a test proves it.
- **Authentication is a delegation chain, not an API key.** The caller
  presents `delegation/1` authority and Bastion verifies it back to a root
  the operator trusts. Designed; not built in v0.
- **Payment is a policy, not a paywall.** Every capability carries a price
  in integer minor units with a currency; `pay-policy/1` decides whether the
  caller may be charged before the call is made. Designed; not built in v0.
- **Every action leaves a receipt.** A receipt per capability call, signed
  by the edge, is not optional — the config validator refuses a policy that
  turns it off. In v0 the receipt is a stub whose `outcome` says the call
  was not made and whose "signature" is an unkeyed digest labelled as such.
- **The protocols underneath are vendor-neutral.** `agent/1`,
  `delegation/1` and `pay-policy/1` are open sibling specifications an
  operator could implement without Bastion. Bastion is one implementation,
  sold as a service. It refuses to redefine any of them.
- **The parser refuses; it does not guess.** Non-https origin, a float
  price, a capability named for a department (`sales`, `marketing`,
  `engineering`, `operations`, `support`, `finance`, `legal`, `hr`), a
  missing accountable human, a contact carrying mailto header separators, an
  unknown key without an `x-` prefix, a capability endpoint that is not on
  the origin's domain — each is refused with a sentence naming the field,
  all at once.
- **An endpoint is on the origin's domain, under one rule the whole
  neighbourhood shares.** A capability endpoint is a path on `origin`, or an
  https URL whose host is the origin's host or a subdomain of it; anything
  else — a stranger, the origin's parent, a sibling — is refused as
  `endpoint-cross-domain`. The rule is `src/vendor-domain.mjs`, a
  byte-identical copy of the same-domain rule canonical in the `agent-dns`
  repository and shared with `agent/1`; it is deliberately not a
  "registrable domain" guess, because without a Public Suffix List nothing
  can tell `co.uk` from `example.com`. Re-vendor, never edit the copy;
  `test/vendor-drift.test.mjs` compares it against canon when agent-dns is
  checked out beside this repository.

## Implemented and designed

| Stage | v0 |
|---|---|
| 1. Resolve and serve `/.well-known/agent` derived from operator config | **Implemented**, pure, tested |
| 2. Authenticate the caller's `delegation/1` chain | **Designed only.** The stage records whether a credential was presented and verifies nothing; the response says `verified: false` |
| 3. Evaluate the `pay-policy/1` payment policy | **Designed only.** The stage reports the published price and evaluates nothing; the response says `evaluated: false` |
| 4. Proxy the capability call to the operator's origin | **Not implemented.** A tested `NotImplemented` path answers 501 and names the endpoint it would call |
| 5. Emit a signed receipt | **Stub.** Right shape, honest content: `outcome: not_implemented`, `alg: sha256-digest-unsigned` |

`ARCHITECTURE.md` has the request path in full and the seams between what
is pure and what touches the network.

## Layout

| Path | What it is |
|---|---|
| `src/config.mjs` | Operator config shape and `validateConfig(config) → {valid, errors}`. Pure |
| `src/vendor-domain.mjs` | The same-domain rule (`isSameDomain`, `sameDomainUrl`, `normalizeDomain`). Vendored byte-identically from `agent-dns`; imports nothing. Re-vendor, never edit |
| `src/agent-doc.mjs` | `deriveAgentDocument(config)` → the `agent/1` document. Pure |
| `src/handler.mjs` | `handle(request, config, deps) → response`. The whole request path, pure; the proxy stage throws `NotImplemented` |
| `src/server.mjs` | The `node:http` adapter. The only file that touches a socket, a clock, a key or the filesystem |
| `test/` | `node --test`: config validation, document derivation, the pure handler, the loopback adapter, repo gates, and the drift check on the vendored domain rule (unknown, not passed, without a sibling `agent-dns` checkout) |
| `tools/lint.mjs` | Zero-install lint: `node --check` on every module, import discipline, credential-shape scan |
| `examples/operator.config.json` | A fictional operator, Harbourlight Freight. No real company, person or price |
| `ARCHITECTURE.md` | The request path, the pure/network split, implemented vs designed |

## Commands

```bash
npm test        # node --test 'test/*.test.mjs'
npm run lint    # node tools/lint.mjs
npm start       # node src/server.mjs examples/operator.config.json
```

## Links

- `agent/1` — the open discovery document, specified in the sibling
  `agent-wellknown` repository. Bastion emits it and does not redefine it.
- `delegation/1` — delegated-authority chains, a sibling specification.
- `pay-policy/1` — payment policy evaluation, a sibling specification.

## Where it sits in the stack

Bastion is the commercial product in the **Gateway** layer of [Web 4](https://github.com/FlashyLabs/web4), the estate's stack of open protocols for the agentic internet — the **"How do I connect to the old web?"** question. It is not a protocol: it implements the open `agent/1`, `delegation/1` and `pay-policy/1` specifications and never redefines them. This repository carries the same **institutional front door** the stack's protocol repositories serve, here as a product front door: `site/` is generated by one dependency-free, config-driven script (`scripts/build-site.mjs`), vendored byte-identical from the [web4](https://github.com/FlashyLabs/web4) hub and driven by this repository's own `site.config.json` (contract `site-config/1`, `schema/site-config-1.json`). It renders the nine-layer table from the served `.well-known/stack.json` copy and serves the mesh surfaces — the `flashyos/1` handshake, the AAO charter, and this org's `directory/1` node — all derived from `flashyos.roles.json` so they cannot disagree.

```bash
node scripts/build-site.mjs   # regenerate site/ from site.config.json + the vendored inputs
```

"Committed is not served": the authoritative check runs against the live domain after deploy (`npx @flashyos/conformance <domain> --level 2`). `vercel.json` sets the output directory to `site` with no framework; the canonical base is `https://flashylabs.github.io/bastion/` until the property has its own domain. **Visibility: private-intended** — the repository is meant to stay private, was measured public on 2026-09-28, and stack.json records both facts in its `x-note`.

## Status

Status: v0 skeleton, in design; the institutional front door was generated 2026-09-29. It is public while private-intended — measured public on 2026-09-28, meant to stay private once it ships, both recorded in stack.json's `x-note`. No customers, no deployments, no numbers.
Stages 2–4 of the request path are designed and not built; the code says so
on every response that reaches them.

Licence: proprietary; to be declared. The estate licence register in flashyos governs.

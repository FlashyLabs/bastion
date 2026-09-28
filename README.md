# Bastion

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
  unknown key without an `x-` prefix — each is refused with a sentence
  naming the field, all at once.

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
| `src/agent-doc.mjs` | `deriveAgentDocument(config)` → the `agent/1` document. Pure |
| `src/handler.mjs` | `handle(request, config, deps) → response`. The whole request path, pure; the proxy stage throws `NotImplemented` |
| `src/server.mjs` | The `node:http` adapter. The only file that touches a socket, a clock, a key or the filesystem |
| `test/` | `node --test`: config validation, document derivation, the pure handler, the loopback adapter, repo gates |
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

## Status

Status: v0 skeleton, in design. No customers, no deployments, no numbers.
Stages 2–4 of the request path are designed and not built; the code says so
on every response that reaches them.

Licence: proprietary; to be declared. The estate licence register in flashyos governs.
